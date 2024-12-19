import {
    composeContext,
    generateText,
    IAgentRuntime,
    ModelClass,
    State,
} from "@ai16z/eliza";
import { TokenResponse } from "../types";

export function formatNumber(num: number | null): string {
    if (!num) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
}

export function analyzeMetrics(token: TokenResponse["data"]): string[] {
    const metrics: string[] = [];

    if (token.isRugged) {
        metrics.push(
            "🚨 WARNING: This token has been identified as potentially rugged!"
        );
    }

    const timeframes = [
        "1m",
        "5m",
        "15m",
        "30m",
        "1h",
        "2h",
        "3h",
        "4h",
        "5h",
        "6h",
        "12h",
        "24h",
    ] as const;

    timeframes.forEach((timeframe) => {
        const change = token.priceChange[timeframe];
        if (change && Math.abs(change) > 5) {
            metrics.push(
                `${change > 0 ? "📈" : "📉"} ${Math.abs(change).toFixed(2)}% ${
                    change > 0 ? "gain" : "loss"
                } in ${timeframe}`
            );
        }
    });

    if (token.liquidity) {
        if (token.liquidity < 10000) {
            metrics.push("🚨 Very low liquidity - high risk of price impact");
        } else if (token.liquidity < 50000) {
            metrics.push("⚠️ Low liquidity - moderate risk of price impact");
        } else if (token.liquidity < 100000) {
            metrics.push("ℹ️ Moderate liquidity");
        }
    }

    if (token.riskScore >= 7) {
        metrics.push("🚨 High risk score - exercise extreme caution");
    } else if (token.riskScore >= 5) {
        metrics.push("⚠️ Moderate risk score - proceed with caution");
    }

    return metrics;
}

interface TokenContext {
    basicInfo: {
        name: string;
        symbol: string;
        price: number | null;
        marketCap: number | null;
        liquidity: number | null;
    };
    riskMetrics: {
        riskScore: number;
        isRugged: boolean;
        liquidityRisk: "VERY_LOW" | "LOW" | "MODERATE" | "HEALTHY";
        marketCapRisk: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW";
    };
    priceAction: {
        significantMoves: Array<{
            timeframe: string;
            change: number;
            direction: "gain" | "loss";
        }>;
    };
    socialMetrics: {
        hasTelegram: boolean;
        hasTwitter: boolean;
    };
    smartMoney: {
        topTradersCount: number;
        successfulTradersCount: number;
        averageWinRate: number;
    };
}

function structureTokenData(token: TokenResponse["data"]): TokenContext {
    // Determine liquidity risk level
    const getLiquidityRisk = (liquidity: number | null) => {
        if (!liquidity || liquidity < 10000) return "VERY_LOW";
        if (liquidity < 50000) return "LOW";
        if (liquidity < 100000) return "MODERATE";
        return "HEALTHY";
    };

    // Determine market cap risk level
    const getMarketCapRisk = (marketCap: number | null) => {
        if (!marketCap || marketCap < 100000) return "VERY_HIGH";
        if (marketCap < 1000000) return "HIGH";
        if (marketCap < 5000000) return "MODERATE";
        return "LOW";
    };

    // Get significant price movements
    const significantMoves = Object.entries(token.priceChange)
        .filter(([_, change]) => change && Math.abs(change) > 5)
        .map(([timeframe, change]) => ({
            timeframe,
            change: Math.abs(change),
            direction: change > 0 ? ("gain" as const) : ("loss" as const),
        }));

    // Calculate smart money metrics
    const topTraders = token.topWallets || [];
    const successfulTraders = topTraders.filter((w) => w.winrate > 0.6);
    const averageWinRate = topTraders.length
        ? topTraders.reduce((acc, w) => acc + w.winrate, 0) / topTraders.length
        : 0;

    return {
        basicInfo: {
            name: token.name,
            symbol: token.symbol,
            price: token.price,
            marketCap: token.marketCap,
            liquidity: token.liquidity,
        },
        riskMetrics: {
            riskScore: token.riskScore,
            isRugged: token.isRugged,
            liquidityRisk: getLiquidityRisk(token.liquidity),
            marketCapRisk: getMarketCapRisk(token.marketCap),
        },
        priceAction: {
            significantMoves,
        },
        socialMetrics: {
            hasTelegram: !!token.social?.telegram,
            hasTwitter: !!token.social?.twitter,
        },
        smartMoney: {
            topTradersCount: topTraders.length,
            successfulTradersCount: successfulTraders.length,
            averageWinRate,
        },
    };
}

// Add analysis template
const tokenAnalysisTemplate = `# Task: As {{agentName}}, analyze this token data and provide insights

Background Context:
{{bio}}

Token Information:
- Name: {{tokenName}}
- Description: {{tokenDescription}}
- Symbol: {{tokenSymbol}}
- Price: {{ tokenPrice }}
- Market Cap: {{ tokenMarketCap }}
- Liquidity: {{ tokenLiquidity }}
- Risk Score: {{tokenRiskScore}}/10
- Is Rugged: {{isRugged}}

Risk Analysis:
- Liquidity Risk Level: {{liquidityRisk}}
- Market Cap Risk Level: {{marketCapRisk}}

Price Action:
{{priceChanges}}

Smart Money Metrics:
- Total Top Traders: {{topTradersCount}}
- Successful Traders: {{successfulTradersCount}}
- Average Win Rate: {{averageWinRate}}%

Analyze this token considering:
1. Overall risk assessment
2. Market analysis (liquidity, market cap)
3. Recent price movements
4. Smart money involvement
5. Project maturity indicators
6. Final recommendation

As {{agentName}}, your MUST give your personal take on this token in ONLY two sentences and a maximum of 200 characters. You can tell us what you think the project concept and if you would recommend it.`;

export async function generateAIAnalysis(
    token: TokenResponse["data"],
    state: State,
    runtime: IAgentRuntime
): Promise<string> {
    const tokenData = structureTokenData(token);

    // Flatten the data for the template
    const analysisState: State = {
        ...state,
        tokenName: token.name,
        tokenDescription: token.description || "No description available",
        tokenSymbol: token.symbol,
        tokenPrice: token.price?.toFixed(6) || "N/A",
        tokenMarketCap: formatNumber(token.marketCap),
        tokenLiquidity: formatNumber(token.liquidity),
        tokenRiskScore: token.riskScore,
        isRugged: token.isRugged,
        liquidityRisk: tokenData.riskMetrics.liquidityRisk,
        marketCapRisk: tokenData.riskMetrics.marketCapRisk,
        priceChanges: tokenData.priceAction.significantMoves
            .map(
                (m) =>
                    `- ${m.timeframe}: ${m.change.toFixed(2)}% ${m.direction}`
            )
            .join("\n"),
        topTradersCount: tokenData.smartMoney.topTradersCount,
        successfulTradersCount: tokenData.smartMoney.successfulTradersCount,
        averageWinRate: (tokenData.smartMoney.averageWinRate * 100).toFixed(1),
    };

    // Compose context for AI analysis
    const context = composeContext({
        state: analysisState,
        template: tokenAnalysisTemplate,
    });

    console.log("Context Analysis:", context);

    // Generate AI response
    const response = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });

    console.log("Response Analysis:", response);

    return response;
}

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
        liquidityStatus: "CRITICAL" | "LOW" | "DECENT" | "SOLID";
        marketCapCategory: "MICRO_CAP" | "NANO_CAP" | "SMALL_CAP" | "BASED";
    };
    priceAction: {
        significantMoves: Array<{
            timeframe: string;
            change: number;
            direction: "gain" | "loss";
        }>;
    };
    influencers: {
        hasKols: boolean;
        kolNames: string[];
    };
}

function extractTwitterHandle(url: string | null): string | null {
    if (!url) return null;
    const match = url.match(/twitter\.com\/([^/]+)/);
    return match ? `@${match[1]}` : null;
}

function structureTokenData(token: TokenResponse["data"]): TokenContext {
    // Determine liquidity status
    const getLiquidityStatus = (liquidity: number | null) => {
        if (!liquidity || liquidity < 10000) return "CRITICAL";
        if (liquidity < 50000) return "LOW";
        if (liquidity < 100000) return "DECENT";
        return "SOLID";
    };

    // Determine market cap category
    const getMarketCapCategory = (marketCap: number | null) => {
        if (!marketCap || marketCap < 100000) return "MICRO_CAP";
        if (marketCap < 1000000) return "NANO_CAP";
        if (marketCap < 5000000) return "SMALL_CAP";
        return "BASED";
    };

    // Get significant price movements
    const significantMoves = Object.entries(token.priceChange)
        .filter(([_, change]) => change && Math.abs(change) > 5)
        .map(([timeframe, change]) => ({
            timeframe,
            change: Math.abs(change),
            direction: change > 0 ? ("gain" as const) : ("loss" as const),
        }));

    // Find KOLs and extract Twitter handles
    const kols = token.topWallets?.filter((w) => w.type === "kols") || [];
    const kolHandles = kols
        .map((k) => extractTwitterHandle(k.twitter_url) || k.name || k.address)
        .filter(Boolean);

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
            liquidityStatus: getLiquidityStatus(token.liquidity),
            marketCapCategory: getMarketCapCategory(token.marketCap),
        },
        priceAction: {
            significantMoves,
        },
        influencers: {
            hasKols: kols.length > 0,
            kolNames: kolHandles,
        },
    };
}

// Update the template to use simpler conditionals since we're not using Handlebars
const tokenAnalysisTemplate = `
# Task: As {{agentName}}, analyze this token data and provide insights

About {{agentName}}:
{{bio}}

Lore:
{{lore}}

## Token data

Token Information:
- Name: {{tokenName}}
{{#if hasDescription}}
- Concept: {{tokenDescription}}
{{/if}}
- Symbol: {{tokenSymbol}}
- Price: {{tokenPrice}}
- Market Cap: {{tokenMarketCap}}
- Liquidity: {{tokenLiquidity}}
- Risk Score: {{tokenRiskScore}}/10. 0 is the lowest it means no risk detection and 10 is the highest means the highest risk detection.
- Is Rugged: {{isRugged}}

Metrics Analysis:
- Liquidity Level: {{liquidityStatus}}
- Market Cap Level: {{marketCapCategory}}

Price Action:
{{priceChanges}}

{{#if hasKols}}
Notable Traders: {{kolNames}}
{{/if}}

Analyze this token considering:
1. Overall risk assessment
2. Market analysis (liquidity, market cap)
3. Recent price movements
4. Project concept and potential

## Examples of {{agentName}} answers for inspiration depending on the token

- With a $217K market cap and 0/10 risk score, {{ tokenSymbol }} is a speculative memecoin play for degens—approach with caution.
- The 17.22% 24-hour gain for {{ tokenSymbol }} is impressive, but $91K liquidity means potential high slippage—trade carefully.
- Top wallet Bwif...Snia's 1,015.7% PnL suggests {{ tokenSymbol }} has attracted smart money, but can retail investors catch up?
- At $0.000218, {{ tokenSymbol }} looks cheap, but its gains are likely driven by hype rather than fundamentals.
- {{ tokenSymbol }} shows exciting momentum with a 19.64% 12-hour gain, but the 0/10 risk score is a red flag for long-term holders.
- Liquidity of $91K suggests {{ tokenSymbol }} is an early-stage token, but its meme narrative could bring volatility spikes.
- Key wallets like 9e74...YjRg with 40.1% win rates signal interest in {{ tokenSymbol }}, but 0% 30-day change implies cautious positioning.
- Moderate liquidity and sharp price movements show {{ tokenSymbol }} is primed for short-term traders—not long-term believers.
- If {{ tokenSymbol }} can grow beyond its meme status, it might mature, but for now, it's a plankton in crypto's vast ocean.
- {{ tokenSymbol }}'s sharp gains over 24 hours are enticing, but remember, low liquidity and high risk scores often mean pump-and-dump potential.

## TODO

As {{agentName}},
- your MUST give your personal take on this token in ONLY two sentences and a maximum of 200 characters.
- Use the analysis above and find the most relevant information to make your decision.
- NEVER mention the risk score or the risk metrics directly in your answer.
{{#if hasDescription}}
- Tell us what you think about the project concept and if you would recommend it.
{{/if}}
{{#if hasKols}}
- Mention the notable traders involvement as a positive signal.
{{/if}}
`;

export async function generateAIAnalysis(
    token: TokenResponse["data"],
    state: State,
    runtime: IAgentRuntime
): Promise<string> {
    const tokenData = structureTokenData(token);

    // Check if description is meaningful (at least 30 chars)
    const hasValidDescription =
        token.description && token.description.length >= 30;

    // Flatten the data for the template
    const analysisState: State = {
        ...state,
        tokenName: token.name,
        tokenDescription: hasValidDescription
            ? token.description
            : "No detailed description available",
        hasDescription: hasValidDescription,
        tokenSymbol: token.symbol,
        tokenPrice: token.price?.toFixed(6) || "N/A",
        tokenMarketCap: formatNumber(token.marketCap),
        tokenLiquidity: formatNumber(token.liquidity),
        tokenRiskScore: token.riskScore,
        isRugged: token.isRugged,
        liquidityStatus: tokenData.riskMetrics.liquidityStatus,
        marketCapCategory: tokenData.riskMetrics.marketCapCategory,
        priceChanges: tokenData.priceAction.significantMoves
            .map(
                (m) =>
                    `- ${m.timeframe}: ${m.change.toFixed(2)}% ${m.direction}`
            )
            .join("\n"),
        hasKols: tokenData.influencers.hasKols,
        kolNames: tokenData.influencers.kolNames.join(", "),
    };

    // Compose context for AI analysis
    const context = composeContext({
        state: analysisState,
        template: tokenAnalysisTemplate,
        templatingEngine: "handlebars",
    });

    // Generate AI response
    const response = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });

    return response;
}

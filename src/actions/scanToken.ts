import {
    Action,
    Content,
    elizaLogger,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "@ai16z/eliza";
import { isAxiosError } from "axios";
import { TopWalletsAPI } from "../services/topwallets-api";
import { TokenResponse } from "../types";

function formatNumber(num: number | null): string {
    if (!num) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
}

function analyzeMetrics(token: TokenResponse["data"]): string[] {
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

export const scanTokenAction: Action = {
    name: "SCAN_TOKEN",
    similes: [
        "CHECK_TOKEN",
        "ANALYZE_TOKEN",
        "GET_TOKEN_INFO",
        "TOKEN_ANALYSIS",
    ],
    description:
        "Analyze a Solana token to get detailed price, liquidity, and risk metrics",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = (message.content as Content).text;
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

        elizaLogger.debug("Validating scanToken action", {
            text,
            hasText: !!text,
            isString: typeof text === "string",
            matchesRegex:
                text && typeof text === "string"
                    ? solanaAddressRegex.test(text)
                    : false,
            hasTokenSymbol:
                text && typeof text === "string"
                    ? /\$[A-Za-z]+/i.test(text)
                    : false,
            hasTokenKeywords:
                text && typeof text === "string"
                    ? /token|price|analysis/i.test(text)
                    : false,
        });

        if (!text || typeof text !== "string") {
            return false;
        }

        return (
            solanaAddressRegex.test(text) ||
            /\$[A-Za-z]+/i.test(text) ||
            /token|price|analysis/i.test(text)
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown } = {},
        callback?: HandlerCallback
    ): Promise<boolean> => {
        if (!callback) {
            throw new Error("Callback is required for scanToken action");
        }

        const text = (message.content as Content).text;
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
        const matches = text.match(solanaAddressRegex);

        elizaLogger.debug("Processing scanToken request", {
            text,
            matches,
            hasMatches: !!matches?.length,
        });

        if (!matches?.length) {
            await callback({
                text: "I couldn't find a valid token address. Please provide a valid Solana token address.",
                action: "TOKEN_SCAN_RESPONSE",
            });
            return true;
        }

        const address = matches[0];

        try {
            const api = TopWalletsAPI.getInstance();
            const response = await api.getTokenInfo(address);
            const tokenData = response.data;

            elizaLogger.debug("Token data received", {
                address,
                symbol: tokenData.symbol,
                hasPrice: !!tokenData.price,
                hasLiquidity: !!tokenData.liquidity,
                hasSocial: !!tokenData.social,
            });

            const metrics = analyzeMetrics(tokenData);
            const chartUrl = `https://dexscreener.com/solana/${address}`;

            let analysisText = `📊 Token Analysis: ${tokenData.symbol}\n\n`;

            analysisText += `Token Information:\n`;
            analysisText += `• Name: ${tokenData.name}\n`;
            analysisText += `• Address: ${address}\n`;
            if (tokenData.description) {
                analysisText += `• Description: ${tokenData.description}\n`;
            }

            analysisText += `\nFinancial Metrics:\n`;
            analysisText += `• Price: $${tokenData.price?.toFixed(6) || "N/A"}\n`;
            analysisText += `• Market Cap: $${formatNumber(tokenData.marketCap)}\n`;
            analysisText += `• Liquidity: $${formatNumber(tokenData.liquidity)}\n`;

            analysisText += `\nRisk Assessment:\n`;
            analysisText += `• Risk Score: ${tokenData.riskScore}/10\n`;
            if (tokenData.isRugged) {
                analysisText += `• 🚨 RUG PULL WARNING: This token has been flagged as potentially rugged!\n`;
            }

            if (metrics.length > 0) {
                analysisText += `\nKey Observations:\n${metrics.map((m) => `• ${m}`).join("\n")}\n`;
            }

            if (tokenData.social?.telegram || tokenData.social?.twitter) {
                analysisText += `\nSocial Links:\n`;
                if (tokenData.social.telegram) {
                    analysisText += `• Telegram: ${tokenData.social.telegram}\n`;
                }
                if (tokenData.social.twitter) {
                    analysisText += `• Twitter: ${tokenData.social.twitter}\n`;
                }
            }

            analysisText += `\n🔍 View detailed chart: ${chartUrl}`;

            await callback({
                text: analysisText,
                action: "TOKEN_SCAN_RESPONSE",
                source: message.content.source,
            });

            return true;
        } catch (error) {
            elizaLogger.error("Token scan error", {
                error,
                address,
                errorMessage: isAxiosError(error)
                    ? error.response?.data?.message || error.message
                    : error instanceof Error
                      ? error.message
                      : "Unknown error",
                isAxiosError: isAxiosError(error),
            });

            const errorMessage = isAxiosError(error)
                ? `Failed to scan token: ${error.response?.data?.message || error.message}`
                : "An unexpected error occurred while scanning the token.";

            console.log(error);

            await callback({
                text: errorMessage,
                action: "TOKEN_SCAN_RESPONSE",
            });

            return true;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you analyze this token: 97RggLo3zV5kFGYW4yoQTxr4Xkz4Vg2WPHzNYXXWpump",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll analyze that token for you. Here's what I found...",
                    action: "SCAN_TOKEN",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's do you think about this token: 97RggLo3zV5kFGYW4yoQTxr4Xkz4Vg2WPHzNYXXWpump",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me check the token information for you...",
                    action: "SCAN_TOKEN",
                },
            },
        ],
    ],
};

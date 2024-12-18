import {
    Action,
    composeContext,
    Content,
    elizaLogger,
    generateObject,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@ai16z/eliza";
import { isAxiosError } from "axios";
import { TopWalletsAPI } from "../services/topwallets-api";
import { TokenResponse } from "../types";

interface TokenInfo {
    contractAddress: string | null;
    symbol: string | null;
}

const tokenAddressTemplate = `# Task: Extract the Solana token address from the conversation.

Look for:
- Solana token addresses (MUST BE a 32 to 44 characters, alphanumeric)
- Token symbols or names mentioned with $ prefix
- Contract addresses mentioned in context of analysis requests
- if no token address is found, return null

Recent Messages:
{{recentMessages}}

Return in JSON format:
\`\`\`json
{
    "contractAddress": "string | null",
    "symbol": "string | null"
}
\`\`\``;

function formatNumber(num: number | null): string {
    if (!num) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
}

function analyzeMetrics(token: TokenResponse["data"]): string[] {
    const metrics: string[] = [];

    // Price changes analysis
    if (token.priceChange) {
        const changes = [
            { period: "1h", value: token.priceChange["1h"] },
            { period: "24h", value: token.priceChange["24h"] },
        ].filter((change) => change.value !== null);

        changes.forEach(({ period, value }) => {
            if (value && Math.abs(value) > 5) {
                metrics.push(
                    `${value > 0 ? "📈" : "📉"} ${Math.abs(value).toFixed(
                        2
                    )}% ${value > 0 ? "gain" : "loss"} in ${period}`
                );
            }
        });
    }

    // Liquidity analysis
    if (token.liquidity) {
        if (token.liquidity < 10000) {
            metrics.push("⚠️ Very low liquidity - high risk of price impact");
        } else if (token.liquidity < 50000) {
            metrics.push("⚠️ Low liquidity - moderate risk of price impact");
        }
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

        if (!text || typeof text !== "string") {
            return false;
        }

        // Check for token address or token-related keywords
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

        try {
            // Extract token information
            const lastMessage =
                state?.recentMessagesData?.[
                    state.recentMessagesData.length - 1
                ];
            const contextState = lastMessage
                ? {
                      ...state,
                      recentMessages: lastMessage.content.text,
                      recentMessagesData: [lastMessage],
                  }
                : state;
            const tokenContext = composeContext({
                state: contextState,
                template: tokenAddressTemplate,
            });

            const tokenInfo = (await generateObject({
                runtime,
                context: tokenContext,
                modelClass: ModelClass.MEDIUM,
            })) as unknown as TokenInfo;

            if (!tokenInfo.contractAddress) {
                await callback({
                    text: tokenInfo.symbol
                        ? `I'd be happy to analyze ${tokenInfo.symbol} for you, but I need the token address. Could you please provide that?`
                        : "I'd be happy to analyze this token for you, but I need the token address. Could you please provide that?",
                    action: "TOKEN_SCAN_RESPONSE",
                });
                return true;
            }

            const api = TopWalletsAPI.getInstance();
            const response = await api.getTokenInfo(tokenInfo.contractAddress);
            const tokenData = response.data;

            // Generate analysis message
            const metrics = analyzeMetrics(tokenData);
            const chartUrl = `https://dexscreener.com/solana/${tokenInfo.contractAddress}`;

            let analysisText = `📊 Token Analysis: ${tokenData.symbol}\n\n`;
            analysisText += `Current Metrics:\n`;
            analysisText += `• Price: $${tokenData.price?.toFixed(6) || "N/A"}\n`;
            analysisText += `• Market Cap: $${formatNumber(tokenData.marketCap)}\n`;
            analysisText += `• Liquidity: $${formatNumber(tokenData.liquidity)}\n`;
            analysisText += `• Risk Score: ${tokenData.riskScore}/10\n\n`;

            if (metrics.length > 0) {
                analysisText += `Analysis:\n${metrics.join("\n")}\n\n`;
            }

            if (tokenData.social?.telegram || tokenData.social?.twitter) {
                analysisText += `Social Links:\n`;
                if (tokenData.social.telegram) {
                    analysisText += `• Telegram: ${tokenData.social.telegram}\n`;
                }
                if (tokenData.social.twitter) {
                    analysisText += `• Twitter: ${tokenData.social.twitter}\n`;
                }
            }

            analysisText += `\n🔍 View chart: ${chartUrl}`;

            await callback({
                text: analysisText,
                action: "TOKEN_SCAN_RESPONSE",
                source: message.content.source,
            });

            return true;
        } catch (error) {
            elizaLogger.error("Token scan error", { error });

            const errorMessage = isAxiosError(error)
                ? `Failed to scan token: ${error.response?.data?.message || error.message}`
                : "An unexpected error occurred while scanning the token.";

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
                    text: "Can you analyze this token: So11111111111111111111111111111111111111112",
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
                    text: "What's the price of $BONK?",
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

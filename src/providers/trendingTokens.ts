import {
    composeContext,
    elizaLogger,
    generateObject,
    generateTrueOrFalse,
    IAgentRuntime,
    Memory,
    ModelClass,
    Provider,
    State,
} from "@ai16z/eliza";
import { TopWalletsAPI, validTimeframes } from "../services/topwallets-api";
import { TrendingTokenResponse } from "../types";

// Add this interface near the top of the file
interface TrendingTokenParams {
    timeframe: (typeof validTimeframes)[number];
    count: number;
}

const shouldShowTrendingTemplate = `# Task: Determine if the user is requesting trending or popular tokens information.

Look for messages that:
- Ask about trending tokens
- Request popular tokens list
- Ask about hot or new tokens
- Want to see what's trending
- Ask about market movements
- Request top performing tokens

Based on the last message, is this a request for trending tokens? YES or NO

Last Message:
{{lastMessage}}

Should I show trending tokens? YES or NO`;

const extractParamsTemplate = `# Task: Extract trending tokens request parameters from the conversation.

Look for:
- Time period mentions (5m, 15m, 30m, 1h, 2h, 3h, 4h, 5h, 6h, 12h, 24h)
- Number of tokens requested (1-20)
- Default to 24h timeframe and 5 tokens if not specified

Valid timeframes: ${validTimeframes.join(", ")}

Recent Messages:
{{recentMessages}}

Return in JSON format:
\`\`\`json
{
    "timeframe": "string (one of the valid timeframes)",
    "count": "number (1-20)"
}
\`\`\``;

export const trendingTokensProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Skip if message contains a Solana address
            const text = message.content.text;
            const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
            if (solanaAddressRegex.test(text)) {
                return "";
            }

            // Get last message for intent check
            const lastMessage =
                state?.recentMessagesData?.[
                    state.recentMessagesData.length - 1
                ];
            const contextState = lastMessage
                ? {
                      ...state,
                      lastMessage: lastMessage.content.text,
                      recentMessagesData: [lastMessage],
                  }
                : state;

            // Check if this is a trending tokens request
            const shouldShowContext = composeContext({
                state: contextState,
                template: shouldShowTrendingTemplate,
            });

            const shouldShowTrending = await generateTrueOrFalse({
                context: shouldShowContext,
                modelClass: ModelClass.SMALL,
                runtime,
            });

            if (!shouldShowTrending) {
                return "";
            }

            // Extract parameters if showing trending
            const paramsContext = composeContext({
                state: contextState,
                template: extractParamsTemplate,
            });

            const params = (await generateObject({
                runtime,
                context: paramsContext,
                modelClass: ModelClass.SMALL,
            })) as unknown as TrendingTokenParams;

            // Try to get from cache first
            const cacheKey = `trending-tokens-${params.timeframe}-${params.count}`;
            let trendingTokensResponse: TrendingTokenResponse =
                await runtime.cacheManager.get(cacheKey);

            if (!trendingTokensResponse) {
                const api = TopWalletsAPI.getInstance();
                trendingTokensResponse = await api.getTrendingTokens({
                    timeframe: params.timeframe,
                    count: Math.min(Math.max(1, params.count), 20), // Ensure count is between 1 and 20
                });

                // Cache for 1 minute for short timeframes, 5 minutes for longer ones
                const cacheTime = ["5m", "15m", "30m", "1h"].includes(
                    params.timeframe
                )
                    ? 60
                    : 300;
                await runtime.cacheManager.set(
                    cacheKey,
                    trendingTokensResponse,
                    {
                        expires: cacheTime,
                    }
                );
            }

            // Format the trending tokens
            const formattedTokens = trendingTokensResponse.data.tokens
                .map((token, index) => {
                    const price = token.price
                        ? `$${token.price.toFixed(4)}`
                        : "N/A";
                    const marketCap = token.marketCap
                        ? `$${(token.marketCap / 1000000).toFixed(2)}M`
                        : "N/A";
                    const liquidity = token.liquidity
                        ? `$${(token.liquidity / 1000).toFixed(2)}K`
                        : "N/A";
                    const dexScreenerUrl = `https://dexscreener.com/solana/${token.address}`;

                    return `${index + 1}. ${token.name} ($${token.symbol})
    • Price: ${price}
    • Market Cap: ${marketCap}
    • Liquidity: ${liquidity}
    • Risk Score: ${token.riskScore}/10
    • Chart: ${dexScreenerUrl}`;
                })
                .join("\n\n");

            return `
# Top ${params.count} Trending Solana Tokens (${params.timeframe} timeframe)

use these tokens to answer the user's question:

${formattedTokens}

Last updated: ${new Date().toLocaleTimeString()}
`.trim();
        } catch (error) {
            elizaLogger.error("Trending token provider error:", error);
            return "Trending token information temporarily unavailable";
        }
    },
};

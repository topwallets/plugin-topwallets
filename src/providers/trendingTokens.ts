import {
    composeContext,
    elizaLogger,
    generateTrueOrFalse,
    IAgentRuntime,
    Memory,
    ModelClass,
    Provider,
    State,
} from "@ai16z/eliza";
import { TopWalletsAPI } from "../services/topwallets-api";

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

export const trendingTokensProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Skip if message contains a Solana address
            const text = (message.content as any).text;
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

            // Try to get from cache first
            const cacheKey = "trending-tokens";
            let trendingTokensResponse =
                await runtime.cacheManager.get(cacheKey);

            if (!trendingTokensResponse) {
                const api = TopWalletsAPI.getInstance();
                trendingTokensResponse = await api.getTrendingTokens();

                // Cache for 5 minutes
                await runtime.cacheManager.set(
                    cacheKey,
                    trendingTokensResponse,
                    {
                        expires: 300,
                    }
                );
            }

            // Format the trending tokens
            const formattedTokens = trendingTokensResponse.data.tokens
                .slice(0, 5)
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
# Top 5 Trending Solana Tokens

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

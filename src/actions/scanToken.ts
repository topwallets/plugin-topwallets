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
import {
    analyzeMetrics,
    formatNumber,
    generateAIAnalysis,
} from "../utils/analysis";

function getMedalEmoji(index: number): string {
    switch (index) {
        case 0:
            return "🥇";
        case 1:
            return "🥈";
        case 2:
            return "🥉";
        default:
            return "•";
    }
}

function formatWalletName(
    wallet: TokenResponse["data"]["topWallets"][0]
): string {
    const name =
        wallet.name ||
        wallet.address.slice(0, 4) + "..." + wallet.address.slice(-4);
    return wallet.type === "kols" ? `⭐ ${name}` : name;
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

            if (tokenData.topWallets && tokenData.topWallets.length > 0) {
                analysisText += `\n📊 Top Wallets Trading This Token:\n`;
                tokenData.topWallets.slice(0, 5).forEach((wallet, index) => {
                    const medal = getMedalEmoji(index);
                    const name = formatWalletName(wallet);
                    const winrate = (wallet.winrate * 100).toFixed(1);

                    analysisText += `${medal} ${name}\n`;
                    analysisText += `   • Win Rate: ${winrate}%\n`;

                    if (wallet.historic30d) {
                        const pnl = wallet.historic30d.realizedPnl;
                        const change = wallet.historic30d.percentageChange;
                        const changeIcon = change >= 0 ? "📈" : "📉";
                        analysisText += `   • 30d PnL: ${pnl}\n`;
                        analysisText += `   • 30d Change: ${changeIcon} ${change.toFixed(1)}%\n`;
                    }
                    analysisText += "\n";
                });

                analysisText += `\n🔍 View more top wallets: https://www.topwallets.ai/solana/token/${address}\n`;
            }

            analysisText += `\n🔍 View detailed chart: ${chartUrl}`;

            analysisText += `\n\n${await generateAIAnalysis(tokenData, state, runtime)}\n`;

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

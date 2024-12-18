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

export const scanWalletAction: Action = {
    name: "SCAN_WALLET",
    similes: [
        "CHECK_WALLET",
        "ANALYZE_WALLET",
        "GET_WALLET_STATS",
        "GET_WALLET_PROFILE",
    ],
    description:
        "Scan a Solana wallet address to get detailed pnl statistics and profile information",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = (message.content as Content).text;
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

        if (!text || typeof text !== "string") {
            return false;
        }

        return solanaAddressRegex.test(text);
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown } = {},
        callback?: HandlerCallback
    ): Promise<boolean> => {
        if (!callback) {
            throw new Error("Callback is required for scanWallet action");
        }

        const text = (message.content as Content).text;
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
        const matches = text.match(solanaAddressRegex);

        if (!matches?.length) {
            await callback({
                text: "I couldn't find a valid Solana address in your message. Please provide a valid address.",
                action: "WALLET_SCAN_RESPONSE",
            });
            return true;
        }

        const address = matches[0];

        try {
            const api = TopWalletsAPI.getInstance();
            const response = await api.scanWallet(address);
            const walletData = response.data[0];

            const profileText = [
                "📊 Profile:",
                walletData.profile.name && `• Name: ${walletData.profile.name}`,
                walletData.profile.twitterUrl &&
                    `• Twitter: ${walletData.profile.twitterUrl}`,
            ]
                .filter(Boolean)
                .join("\n");

            const analysisText = `💰 Performance Analysis:
• Win Rate: ${walletData.stats.winrate}%
• Tokens Traded: ${walletData.stats.tokensTraded}
• Total PnL: ${walletData.stats.combinedPnl}
• ROI: ${walletData.stats.combinedRoi}
• Best Trade: ${walletData.stats.topTradePnl || "Unknown"}
• Total Invested: ${walletData.stats.totalInvested || "Unknown"}`;

            const responseText = `I've analyzed the wallet ${address}:

${profileText}

${analysisText}

🔍 View complete analysis: https://www.topwallets.ai/solana/wallet/${address}`;

            elizaLogger.log("Wallet scan successful", {
                address,
                profileText,
                analysisText,
            });

            await callback({
                text: responseText,
                action: "WALLET_SCAN_RESPONSE",
                source: message.content.source,
            });

            return true;
        } catch (error) {
            elizaLogger.error("Wallet scan error", { error });

            const errorMessage = isAxiosError(error)
                ? `Failed to scan wallet: ${error.response?.data?.message || error.message}`
                : "An unexpected error occurred while scanning the wallet.";

            await callback({
                text: errorMessage,
                action: "WALLET_SCAN_RESPONSE",
            });

            return true;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you analyze this wallet: DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll scan that wallet for you. Here's what I found...",
                    action: "SCAN_WALLET",
                },
            },
        ],
    ],
};

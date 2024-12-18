import { elizaLogger } from "@ai16z/eliza";
import axios, { AxiosInstance } from "axios";
import {
    BotScanWalletResponse,
    TokenResponse,
    TrendingTokenResponse,
} from "../types";

export class TopWalletsAPI {
    private client: AxiosInstance;
    private static instance: TopWalletsAPI;

    private constructor() {
        const API_KEY = process.env.TOPWALLETS_API_KEY;
        const API_URL = process.env.TOPWALLETS_API_URL;

        if (!API_KEY) {
            throw new Error(
                "Missing TOPWALLETS_API_KEY environment variable. Please set it in your .env file"
            );
        }

        this.client = axios.create({
            baseURL: API_URL || "https://www.topwallets.ai",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
        });
    }

    public static getInstance(): TopWalletsAPI {
        if (!TopWalletsAPI.instance) {
            TopWalletsAPI.instance = new TopWalletsAPI();
        }
        return TopWalletsAPI.instance;
    }

    async scanWallet(address: string): Promise<BotScanWalletResponse> {
        try {
            const response = await this.client.post<BotScanWalletResponse>(
                "/api/bot/solana/scan/wallet",
                { addresses: [address] }
            );

            if (!response.data.success) {
                elizaLogger.warn("Wallet scan failed", {
                    error: response.data.message,
                });
                throw new Error(response.data.message);
            }

            return response.data;
        } catch (error) {
            elizaLogger.error("Wallet scan error", { error });
            throw error;
        }
    }

    async getTrendingTokens(): Promise<TrendingTokenResponse> {
        try {
            const response = await this.client.get<TrendingTokenResponse>(
                "/api/bot/solana/trending-tokens"
            );

            if (!response.data.success) {
                elizaLogger.warn("Trending tokens fetch failed", {
                    error: response.data.message,
                });
                throw new Error(response.data.message);
            }

            return response.data;
        } catch (error) {
            elizaLogger.error("Trending tokens error", { error });
            throw error;
        }
    }

    async getTokenInfo(address: string): Promise<TokenResponse> {
        try {
            const response = await this.client.get<TokenResponse>(
                `/api/bot/solana/token?address=${address}`
            );

            if (!response.data.success) {
                elizaLogger.warn("Token info fetch failed", {
                    error: response.data.message,
                });
                throw new Error(response.data.message);
            }

            return response.data;
        } catch (error) {
            elizaLogger.error("Token info error", { error });
            throw error;
        }
    }
}

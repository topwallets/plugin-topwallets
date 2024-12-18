import { z } from "zod";
import { validTimeframes } from "./services/topwallets-api";

export interface WalletStats {
    realizedPnl: string;
    unrealizedPnl: string;
    combinedPnl: string;
    realizedRoi: string;
    unrealizedRoi: string;
    combinedRoi: string;
    winrate: number;
    tokensTraded: number;
    averageHoldingTime: string;
    totalInvested: string | null;
    averageBuyAmount: string | null;
    totalWins: number;
    totalLosses: number;
    lossPercentage: number;
    topTradePnl: string | null;
}

export interface WalletProfile {
    name: string | null;
    twitterUrl: string | null;
    pictureUrl: string | null;
    type: "normal" | "kols";
}

export interface WalletData {
    address: string;
    stats: WalletStats;
    profile: WalletProfile;
}

export interface BotScanWalletResponse {
    success: boolean;
    message: string;
    data: WalletData[];
}

export interface TrendingToken {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    description: string | null;
    riskScore: number;
    liquidity: number | null;
    price: number | null;
    marketCap: number | null;
}

export interface TrendingTokenResponse {
    success: boolean;
    message: string;
    data: {
        tokens: TrendingToken[];
    };
}

export interface TokenResponse {
    success: boolean;
    message: string;
    data: {
        name: string;
        symbol: string;
        address: string;
        decimals: number;
        description: string | null;
        image: string | null;
        social: {
            twitter?: string;
            telegram?: string;
        };
        price: number | null;
        marketCap: number | null;
        liquidity: number | null;
        priceChange: {
            "1h": number | null;
            "24h": number | null;
        };
        riskScore: number;
    };
}

export const TrendingTokenSchema = z.object({
    timeframe: z.enum(validTimeframes),
    count: z.number().min(1).max(20),
});

export const TokenInfoSchema = z.object({
    contractAddress: z.string().nullable(),
    symbol: z.string().nullable(),
});

export type TrendingTokenParams = z.infer<typeof TrendingTokenSchema>;
export type TokenInfo = z.infer<typeof TokenInfoSchema>;

export const isTrendingTokenParams = (
    object: unknown
): object is TrendingTokenParams => {
    if (TrendingTokenSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid trending token params:", object);
    return false;
};

export const isTokenInfo = (object: unknown): object is TokenInfo => {
    if (TokenInfoSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid token info:", object);
    return false;
};

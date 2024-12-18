import { z } from "zod";
import { validTimeframes } from "./services/topwallets-api";

export type TimeframeType = (typeof validTimeframes)[number];

export interface RecentToken {
    symbol: string;
    name: string;
    timestamp: string;
    holding: number;
    amount: string;
    firstBuyTime: string;
    realizedPnl: string;
    roi: string;
    imageUrl: string | null;
}

export interface WalletData {
    recentTokens: RecentToken[];
    score: number;
    winrateScore: number;
    pnlScore: number;
    roiScore: number;
    address: string;
    formattedAddress: string;
    winrate: number;
    tokenTraded: number;
    averageHoldingTime: string;
    realizedPnl: string;
    unrealizedPnl: string;
    realizedRoi: string;
    unrealizedRoi: string;
    combinedRoi: string;
    realizedPnlRaw: number;
    unrealizedPnlRaw: number;
    realizedRoiRaw: number;
    unrealizedRoiRaw: number;
    combinedRoiRaw: number;
    combinedPnlRaw: number;
    totalInvested: number | string | null;
    totalInvestedFormatted: string | null;
    averageBuyAmount: number | string | null;
    averageBuyAmountFormatted: string | null;
    totalWins: number | null | string;
    totalLosses: number | null | string;
    lossPercentage: number | null;
    name: string | null;
    twitter_url: string | null;
    picture_url: string | null;
    type: "normal" | "kols";
    isFavorite?: boolean;
    updatedAt: string;
}

export interface BotScanWalletResponse {
    success: boolean;
    message: string;
    data: WalletData;
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

import { Plugin } from "@ai16z/eliza";

import { scanWalletAction } from "./actions/scanWallet.ts";
import { trendingTokensProvider } from "./providers/trendingTokens.ts";
import { scanTokenAction } from "./actions/scanToken.ts";

export * as actions from "./actions";
export * as providers from "./providers";

export const topwalletsPlugin: Plugin = {
    name: "topwallets",
    description:
        "A plugin for Eliza that provides solana trading data and analysis.",
    actions: [scanWalletAction, scanTokenAction],
    evaluators: [],
    providers: [trendingTokensProvider],
};

import { Plugin } from "@elizaos/core";

import { scanTokenAction } from "./actions/scanToken.ts";
import { scanWalletAction } from "./actions/scanWallet.ts";
import { rulesProvider } from "./providers/rules.ts";
import { trendingTokensProvider } from "./providers/trendingTokens.ts";

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

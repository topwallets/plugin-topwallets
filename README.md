# @ai16z/plugin-topwallets

A plugin for Eliza that provides solana trading data and analysis.

_note: this plugin is currently in development, not yet published on npm. contact us if you have any questions or feedback: https://x.com/TopwalletsAI | https://t.me/TopWalletsAI_

## Features

### Actions

- `scanWalletAction`: Analyzes a Solana wallet address to get detailed statistics and profile information
    - Usage: Triggered when a user asks to analyze a wallet or posts a Solana wallet address
    - Returns: Wallet performance metrics, profile info, and copy trading options
- `scanTokenAction`: Analyzes a Solana token to get detailed price and risk metrics
    - Usage: Triggered when a user asks about a token price or posts a token address
    - Returns: Token price, market cap, liquidity, risk score and social links

### Providers

- `trendingTokensProvider`: Provides real-time information about trending tokens on Solana
    - Usage: Automatically responds to queries about trending or popular tokens
    - Returns: Top 5 trending tokens with price, market cap, liquidity, and risk metrics
    - Features:
        - Customizable timeframes (5m, 15m, 30m, 1h, 2h, 3h, 4h, 5h, 6h, 12h, 24h)
        - Adjustable number of tokens (1-20)
        - Intelligent timeframe detection from user queries
        - Smart caching based on timeframe (1min for short timeframes, 5min for longer)

## Installation

- For now, just clone it in your eliza project

## Configuration

The plugin requires the following environment variables:

```env
TOPWALLETS_API_URL=https://www.topwallets.ai
TOPWALLETS_API_KEY=your_api_key
```

contact us for an API key: https://x.com/TopwalletsAI | https://t.me/TopWalletsAI

## Usage

This plugin is part of a broader vision to develop autonomous AI trading agents. It follows the ai16z vision of autonomous trading agents. Read more here: https://ai16z.github.io/eliza/docs/advanced/autonomous-trading/

### Autonomous Trading Vision

The plugin serves as a data provider for building AI-powered trading agents that can:

1. **Market Analysis**

    - Collect and analyze real-time market data
    - Perform technical analysis using historical data
    - Monitor wallet behaviors and trading patterns

2. **Risk Management**

    - Validate tokens using multiple security checks
    - Implement position sizing based on liquidity
    - Monitor and manage trade positions

3. **Trade Execution**

    - Execute trades through Jupiter aggregator
    - Manage slippage and price impact
    - Handle transaction errors and recovery

4. **Position Management**
    - Track orders and positions
    - Calculate profit/loss metrics
    - Implement stop-loss and take-profit strategies

## Open Source Vision

While this plugin was initially developed in the context of TopWallets, it is designed as an open-source reference implementation that can be adapted for any data provider. The goal is to:

1. **Promote Standardization**: Establish common patterns for building trading-focused Eliza plugins
2. **Enable Customization**: Provide a flexible architecture that can be modified to work with different data sources
3. **Foster Innovation**: Share implementation examples that others can build upon

## Contributing

Contributions are welcome! Whether you're improving the existing implementation or adding new features, please feel free to submit pull requests.

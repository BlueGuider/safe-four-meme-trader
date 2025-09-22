# Price Tracking System Documentation

## Overview

The enhanced price tracking system automatically monitors token prices and executes sell orders based on predefined triggers. This system integrates seamlessly with the existing copy trading functionality to provide intelligent profit-taking mechanisms.

## Key Features

### 🎯 Automatic Selling Triggers
- **10% Increase Trigger**: Sells 50% of tokens when price increases by 10% within 10 seconds
- **50% Increase Trigger**: Sells 100% of tokens when price increases by 50% within 20 seconds
- **Copy Sell Integration**: Automatically sells when target wallets sell tokens

### 📈 Real-time Price Monitoring
- Continuous price updates every 2 seconds (configurable)
- Accurate price data using four.meme contract simulations
- Fallback to PancakeSwap for migrated tokens
- Price change percentage tracking
- Maximum price reached tracking

### 🔄 Smart Token Management
- Automatic token removal when fully sold
- Multi-wallet support for copy trading
- User-specific tracking per wallet
- Comprehensive transaction logging

## Architecture

### Core Services

#### 1. PriceTrackingService (`src/services/priceTrackingService.ts`)
Main service that manages token tracking and sell triggers.

**Key Methods:**
- `startTrackingToken()` - Start tracking a token after purchase
- `updateAllTokenPrices()` - Update prices for all tracked tokens
- `checkSellTriggers()` - Check if sell conditions are met
- `copySellToken()` - Execute copy sell when target wallet sells
- `removeTokenFromTracking()` - Remove token when fully sold

#### 2. Enhanced DirectPriceService (`src/services/directPriceService.ts`)
Enhanced with better price accuracy and additional data.

**New Methods:**
- `getRealTimePrice()` - Get comprehensive price data
- `checkTokenLiquidity()` - Check if token has sufficient liquidity
- `getPriceHistory()` - Placeholder for historical data

#### 3. Integrated CopyTradingService (`src/services/copyTrading.ts`)
Enhanced to automatically start price tracking for copied tokens.

**New Features:**
- Automatic price tracking setup after successful buys
- Copy sell integration with price tracking
- Price tracking management methods

## Configuration

### Price Tracking Settings

```typescript
interface PriceTrackingConfig {
  sellAt10Percent: boolean;     // Enable 10% trigger
  sellAt50Percent: boolean;     // Enable 50% trigger
  timeWindow10Percent: number;  // Time window for 10% check (seconds)
  timeWindow50Percent: number;  // Time window for 50% check (seconds)
  enabled: boolean;             // Enable/disable tracking
  updateInterval: number;       // Price update interval (milliseconds)
}
```

### Default Configuration
```typescript
{
  sellAt10Percent: true,
  sellAt50Percent: true,
  timeWindow10Percent: 10,  // 10 seconds
  timeWindow50Percent: 20,  // 20 seconds
  enabled: true,
  updateInterval: 2000      // 2 seconds
}
```

## Usage Examples

### 1. Basic Setup

```typescript
import { CopyTradingService } from './src/services/copyTrading';

// Setup copy trading (automatically enables price tracking)
await CopyTradingService.setupCopyTrading(
  'user123',                    // User ID
  '0x1234...',                 // Target wallet
  0.1,                         // Copy 10% of trades
  0.5,                         // Max 0.5 BNB per trade
  2000                         // 2 second delay
);

// Configure price tracking settings
CopyTradingService.updatePriceTrackingConfig({
  sellAt10Percent: true,
  sellAt50Percent: true,
  timeWindow10Percent: 10,
  timeWindow50Percent: 20,
  updateInterval: 2000
});
```

### 2. Manual Token Tracking

```typescript
import { PriceTrackingService } from './src/services/priceTrackingService';

const priceService = PriceTrackingService.getInstance();

// Start tracking a token after manual purchase
await priceService.startTrackingToken(
  '0xabcdef...',              // Token address
  0.000001,                   // Buy price (BNB)
  0.0003,                     // Buy price (USD)
  0.1,                        // BNB amount spent
  100000,                     // Token amount received
  'user123',                  // User ID
  '0x9876...'                 // Wallet address
);
```

### 3. Monitor Tracked Tokens

```typescript
// Get all tracked tokens for a user
const trackedTokens = CopyTradingService.getTrackedTokens('user123');

// Get all tracked tokens
const allTracked = CopyTradingService.getAllTrackedTokens();

// Get tracking statistics
const stats = CopyTradingService.getPriceTrackingStats();
console.log(`Tracking ${stats.activeTracked} tokens for ${stats.totalUsers} users`);
```

### 4. Manual Price Checking

```typescript
import { DirectPriceService } from './src/services/directPriceService';

const priceService = DirectPriceService.getInstance();

// Get exact current price
const priceResult = await priceService.getFourMemeExactPrice('0xabcdef...');
if (priceResult.success) {
  console.log(`Buy price: ${priceResult.data.buyPrice} BNB`);
  console.log(`Sell price: ${priceResult.data.sellPrice} BNB`);
  console.log(`Average: ${priceResult.data.avgPrice} BNB`);
  console.log(`USD: $${priceResult.data.priceUSD}`);
}

// Check token liquidity
const liquidityResult = await priceService.checkTokenLiquidity('0xabcdef...', 0.1);
if (liquidityResult.success) {
  console.log(`Has liquidity: ${liquidityResult.data.hasLiquidity}`);
  console.log(`Liquidity amount: ${liquidityResult.data.liquidityAmount} BNB`);
}
```

## Telegram Notifications

The system sends comprehensive Telegram notifications for:

### Price Tracking Alerts
- **Partial Sell**: When 50% is sold at 10% increase
- **Full Sell**: When 100% is sold at 50% increase
- **Copy Sell**: When copying a target wallet's sell

### Price Update Notifications
- Significant price changes (5% or more)
- Maximum price reached updates
- Current price and percentage change

## Data Structures

### TrackedToken Interface

```typescript
interface TrackedToken {
  tokenAddress: string;        // Token contract address
  buyPrice: number;           // Price when bought (BNB)
  buyPriceUSD: number;        // Price when bought (USD)
  buyAmount: number;          // BNB amount spent
  tokenAmount: number;        // Token amount received
  buyTime: Date;             // When token was bought
  currentPrice: number;       // Current price (BNB)
  currentPriceUSD: number;    // Current price (USD)
  priceChangePercent: number; // Price change percentage
  maxPriceReached: number;    // Highest price reached
  maxPriceReachedUSD: number; // Highest price in USD
  maxPriceChangePercent: number; // Max price increase %
  lastUpdated: Date;         // Last price update
  userId: string;            // User who owns the token
  walletAddress: string;     // Wallet holding the token
  isActive: boolean;         // Whether still being tracked
}
```

## Error Handling

The system includes comprehensive error handling:

- **Price Fetch Failures**: Graceful fallback to alternative price sources
- **Transaction Failures**: Detailed error logging and user notifications
- **Network Issues**: Automatic retry mechanisms
- **Invalid Tokens**: Automatic detection and handling of migrated tokens

## Performance Considerations

### Optimization Features
- **Efficient Price Updates**: Only updates active tokens
- **Configurable Intervals**: Adjustable update frequency
- **Memory Management**: Automatic cleanup of sold tokens
- **Error Recovery**: Robust error handling and recovery

### Resource Usage
- **Memory**: ~1KB per tracked token
- **Network**: ~2-3 API calls per token per update cycle
- **CPU**: Minimal impact with configurable intervals

## Monitoring and Debugging

### Console Logging
The system provides detailed console output:

```
📈 Started tracking token: 0xabcdef...
   💰 Buy price: 0.00000100 BNB ($0.0003)
   🪙 Amount: 100000.00 tokens
   👤 User: user123
   🏦 Wallet: 0x9876...5432

🎯 10% INCREASE TRIGGER ACTIVATED!
   Token: 0xabcdef...
   Price change: +12.45%
   Time since buy: 8.2s
   Action: Selling 50% of tokens

✅ Successfully sold 50% of tokens
   Transaction: 0x1234...
```

### Statistics Tracking
```typescript
const stats = CopyTradingService.getPriceTrackingStats();
// Returns:
// {
//   totalTracked: 15,
//   activeTracked: 12,
//   totalUsers: 3,
//   averagePriceChange: 8.5
// }
```

## Integration with Existing System

The price tracking system seamlessly integrates with:

1. **Copy Trading**: Automatic tracking setup and copy sell execution
2. **Trading Service**: Uses existing buy/sell mechanisms
3. **Wallet Service**: Multi-wallet support
4. **Telegram Bot**: Comprehensive notifications
5. **Contract Service**: Token balance and transaction management

## Future Enhancements

### Planned Features
- **Historical Price Data**: Price history tracking and analysis
- **Advanced Triggers**: Custom percentage and time-based triggers
- **Portfolio Analytics**: Comprehensive portfolio performance tracking
- **Risk Management**: Stop-loss and take-profit mechanisms
- **Backtesting**: Historical strategy testing capabilities

## Troubleshooting

### Common Issues

1. **Price Tracking Not Starting**
   - Check if copy trading is properly configured
   - Verify token address is valid
   - Ensure sufficient wallet balance

2. **Sell Triggers Not Working**
   - Verify price tracking configuration
   - Check if time windows are appropriate
   - Ensure token has sufficient liquidity

3. **Telegram Notifications Not Sending**
   - Verify Telegram bot configuration
   - Check bot token and chat ID
   - Ensure bot is properly initialized

### Debug Commands

```typescript
// Check if token is being tracked
const isTracked = CopyTradingService.getPriceTrackingService()
  .isTokenTracked(tokenAddress, userId, walletAddress);

// Get current configuration
const config = CopyTradingService.getPriceTrackingConfig();

// Manually remove a token from tracking
await CopyTradingService.removeTokenFromTracking(
  tokenAddress, userId, walletAddress
);
```

## Conclusion

The enhanced price tracking system provides intelligent, automated profit-taking mechanisms that work seamlessly with the existing copy trading functionality. It offers comprehensive monitoring, flexible configuration, and robust error handling to maximize trading efficiency and profitability.

For questions or issues, please refer to the console logs and Telegram notifications for detailed information about system operations.

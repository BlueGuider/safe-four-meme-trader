# 🚀 Live Pattern-Based Trading System

This is a comprehensive live trading system that monitors the BSC blockchain for token creation patterns and executes trades automatically based on predefined criteria.

## 🎯 Features

- **Real-time Block Monitoring**: Scans new blocks as they are mined
- **Pattern-Based Trading**: Uses sophisticated pattern matching to identify profitable opportunities
- **Binary Confidence System**: Either 100% match (all requirements met) or 0% match
- **Safety Limits**: Built-in protection against excessive trading
- **Test Mode**: Safe simulation mode for testing without real money
- **Live Mode**: Real trading with actual BNB
- **Configurable**: JSON-based configuration for easy customization

## 📁 Project Structure

```
safe-four-meme-trader/
├── src/                          # TypeScript source code
│   ├── services/
│   │   ├── patternBasedScanner.ts    # Core pattern matching logic
│   │   ├── trading.ts                # Trading execution service
│   │   └── ...
│   └── ...
├── dist/                         # Compiled JavaScript
├── patterns.json                 # Trading patterns configuration
├── live-scanner.js              # Main live scanner (production)
├── live-scanner-config.json     # Scanner configuration
├── test-*.js                    # Test scripts for historical analysis
└── README.md                    # This file
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- BSC RPC access (configured in environment)
- Private keys for trading wallets (if using live mode)

### 2. Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Copy environment template
cp env.template .env
# Edit .env with your configuration
```

### 3. Configuration

Edit `live-scanner-config.json`:

```json
{
  "scanner": {
    "scanInterval": 5000,           // 5 seconds between scans
    "maxRetries": 3,                // Max retry attempts
    "fourMemeContract": "0x5c952063c7fc8610ffdb798152d69f0b9550762b"
  },
  "trading": {
    "enabled": false,               // Set to true for live trading
    "testMode": true,               // Set to false for real trades
    "maxBuyAmount": 0.01,           // Max BNB per trade
    "maxSlippage": 5.0              // Max slippage percentage
  },
  "safety": {
    "maxTradesPerHour": 10,         // Safety limit
    "maxTradesPerDay": 50,          // Safety limit
    "emergencyStop": false          // Emergency stop switch
  }
}
```

### 4. Pattern Configuration

Edit `patterns.json` to define your trading patterns:

```json
{
  "id": "real_pattern_1",
  "name": "Real Pattern 1",
  "description": "Low gas price, specific gas limit range",
  "enabled": true,
  "priority": 1,
  "gasPrice": {
    "min": 0.1,
    "max": 0.12,
    "unit": "gwei"
  },
  "gasLimit": {
    "min": 1513000,
    "max": 1515000
  },
  "trading": {
    "buyAmount": 0.001,
    "holdTimeSeconds": 20,
    "maxSlippage": 5.0,
    "stopLossPercent": 10.0,
    "takeProfitPercent": 40.0
  },
  "filters": {
    "minTransactionValue": 0.01,
    "maxTransactionValue": 1.0,
    "requiredConfirmations": 1
  }
}
```

## 🧪 Testing

### Test Mode (Recommended First)

```bash
# Run in test mode (no real trades)
node live-scanner.js

# Or with custom config
node live-scanner.js custom-config.json
```

### Historical Analysis

```bash
# Test on historical blocks
node test-block-pattern-analysis.js

# Test single block
node test-single-block-pattern.js 62301305
```

## 💰 Live Trading

⚠️ **WARNING**: Live trading uses real money. Test thoroughly first!

### 1. Prepare for Live Trading

```bash
# 1. Test your patterns on historical data
node test-block-pattern-analysis.js

# 2. Run in test mode first
node live-scanner.js

# 3. Verify your configuration
cat live-scanner-config.json
```

### 2. Enable Live Trading

Edit `live-scanner-config.json`:

```json
{
  "trading": {
    "enabled": true,        // Enable trading
    "testMode": false,      // Disable test mode
    "maxBuyAmount": 0.001   // Start small!
  }
}
```

### 3. Start Live Trading

```bash
# Start live trading
node live-scanner.js

# Or with PM2 for production
pm2 start live-scanner.js --name "live-scanner"
pm2 logs live-scanner
```

## 📊 Monitoring

### Real-time Status

The scanner shows real-time status every 30 seconds:

```
📊 Live Scanner Status (120s uptime)
   🎯 Pattern matches: 3
   💰 Trades executed: 2
   📦 Last processed block: 62301450
   🛡️ Safety: 2/10 hour, 2/50 day
   ⏰ Next scan in 5s
```

### Logs

All trades are logged with detailed information:

```json
{
  "timestamp": "2025-01-24T10:30:45.123Z",
  "mode": "REAL",
  "blockNumber": 62301450,
  "tokenAddress": "0xc619d817efb2ac432bf2f546507fda8430c04444",
  "pattern": "Real Pattern 1",
  "confidence": 1.0,
  "buyAmount": 0.001,
  "tradeResult": true,
  "tradeTxHash": "0x1234...",
  "successCount": 1,
  "totalWallets": 1
}
```

## 🛡️ Safety Features

### Built-in Protections

1. **Trade Limits**: Max trades per hour/day
2. **Emergency Stop**: Instant stop switch
3. **Amount Limits**: Maximum buy amount per trade
4. **Pattern Validation**: Only trades on verified patterns
5. **Error Handling**: Automatic retry and recovery

### Safety Commands

```bash
# Check status
pm2 status live-scanner

# Stop trading
pm2 stop live-scanner

# View logs
pm2 logs live-scanner

# Emergency stop (edit config)
# Set "emergencyStop": true in live-scanner-config.json
```

## 🔧 Configuration Options

### Scanner Settings

- `scanInterval`: Milliseconds between block scans (default: 5000)
- `maxRetries`: Maximum retry attempts on errors (default: 3)
- `fourMemeContract`: Contract address to monitor

### Trading Settings

- `enabled`: Enable/disable trading (default: false)
- `testMode`: Simulation mode (default: true)
- `maxBuyAmount`: Maximum BNB per trade (default: 0.01)
- `maxSlippage`: Maximum slippage tolerance (default: 5.0)

### Safety Settings

- `maxTradesPerHour`: Hourly trade limit (default: 10)
- `maxTradesPerDay`: Daily trade limit (default: 50)
- `emergencyStop`: Emergency stop switch (default: false)

## 📈 Pattern Development

### Creating New Patterns

1. Edit `patterns.json`
2. Add your pattern with specific criteria
3. Test on historical data
4. Deploy to live scanner

### Pattern Criteria

- **Gas Price**: Min/max gas price in gwei
- **Gas Limit**: Min/max gas limit
- **Transaction Value**: Min/max BNB value
- **Trading Parameters**: Buy amount, hold time, stop loss, take profit

### Testing Patterns

```bash
# Test specific pattern
node test-single-block-pattern.js 62301305

# Test pattern on block range
node test-block-pattern-analysis.js
```

## 🚨 Troubleshooting

### Common Issues

1. **"Could not extract token address"**
   - Check RPC connection
   - Verify contract address
   - Check transaction logs

2. **"No patterns matched"**
   - Review pattern criteria
   - Check gas price/limit ranges
   - Verify transaction values

3. **"Trade blocked by safety limits"**
   - Check hourly/daily limits
   - Verify emergency stop status
   - Review trade history

### Debug Mode

```bash
# Enable debug logging
DEBUG=* node live-scanner.js

# Check specific block
node test-single-block-pattern.js BLOCK_NUMBER
```

## 📞 Support

- Check logs: `pm2 logs live-scanner`
- Review configuration: `cat live-scanner-config.json`
- Test patterns: `node test-block-pattern-analysis.js`
- Emergency stop: Set `"emergencyStop": true` in config

## ⚠️ Important Notes

1. **Always test first**: Use test mode before live trading
2. **Start small**: Begin with small amounts
3. **Monitor closely**: Watch the first few trades
4. **Set limits**: Use appropriate safety limits
5. **Keep backups**: Backup your configuration and patterns
6. **Stay updated**: Monitor for pattern effectiveness

## 🎯 Success Tips

1. **Pattern Quality**: Focus on high-confidence patterns
2. **Gas Optimization**: Monitor gas price trends
3. **Timing**: Consider market conditions
4. **Risk Management**: Use stop losses and position sizing
5. **Monitoring**: Regular review of performance

---

**Happy Trading! 🚀**

Remember: This is a high-risk trading system. Only trade with money you can afford to lose.

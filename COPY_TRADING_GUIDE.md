# 🤖 Copy Trading Guide

This guide shows you how to run copy trading with your four.meme trading bot.

## 🚀 Quick Start

### Method 1: Using the Simple Script (Recommended)

1. **Edit the configuration file:**
   ```bash
   nano copy-trading-config.json
   ```

2. **Update target wallet addresses:**
   ```json
   {
     "copyTradingConfigs": [
       {
         "name": "Whale Trader 1",
         "targetWallet": "0xREPLACE_WITH_ACTUAL_WALLET_ADDRESS",
         "copyRatio": 0.1,
         "maxPositionSize": 0.05,
         "delayMs": 2000,
         "enabled": true
       }
     ]
   }
   ```

3. **Start copy trading:**
   ```bash
   node start-copy-trading.js
   ```

### Method 2: Using the Advanced Script

1. **Run the advanced script:**
   ```bash
   node run-copy-trading.js
   ```

2. **Follow the interactive prompts**

## 📋 Configuration Options

### Copy Trading Settings

| Setting | Description | Example | Range |
|---------|-------------|---------|-------|
| `targetWallet` | Wallet address to copy | `0x1234...` | Valid BSC address |
| `copyRatio` | Percentage of target's trade to copy | `0.1` | 0.01 - 1.0 (1% - 100%) |
| `maxPositionSize` | Maximum BNB per trade | `0.05` | Any positive number |
| `delayMs` | Delay before executing copy | `2000` | 0 - 5000ms |
| `enabled` | Whether to copy this target | `true` | true/false |

### Safety Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `maxDailyLoss` | Stop copying if daily loss exceeds this | 1.0 BNB |
| `minPositionSize` | Minimum trade size | 0.001 BNB |
| `monitoring.intervalMs` | How often to check for new transactions | 3000ms |

## 🎯 How It Works

1. **Block Monitoring**: Checks new BSC blocks every 3 seconds
2. **Transaction Detection**: Scans for four.meme trading transactions
3. **Target Filtering**: Only processes transactions from your target wallets
4. **Analysis**: Determines if it's a buy or sell transaction
5. **Copy Execution**: Executes the same trade with your configured ratio
6. **Safety Checks**: Validates token, amounts, and safety limits

## 📊 Example Configurations

### Conservative Setup
```json
{
  "name": "Conservative Trader",
  "targetWallet": "0x...",
  "copyRatio": 0.05,      // Copy 5%
  "maxPositionSize": 0.01, // Max 0.01 BNB
  "delayMs": 3000,        // 3 second delay
  "enabled": true
}
```

### Aggressive Setup
```json
{
  "name": "Aggressive Trader", 
  "targetWallet": "0x...",
  "copyRatio": 0.2,       // Copy 20%
  "maxPositionSize": 0.1, // Max 0.1 BNB
  "delayMs": 1000,        // 1 second delay
  "enabled": true
}
```

### Multiple Targets
```json
{
  "copyTradingConfigs": [
    {
      "name": "Whale 1",
      "targetWallet": "0x...",
      "copyRatio": 0.1,
      "maxPositionSize": 0.05,
      "enabled": true
    },
    {
      "name": "Whale 2", 
      "targetWallet": "0x...",
      "copyRatio": 0.05,
      "maxPositionSize": 0.02,
      "enabled": true
    }
  ]
}
```

## 🛠️ Manual Control

### Start/Stop Monitoring
```javascript
const { CopyTradingService } = require('./dist/services/copyTrading');

// Start monitoring
CopyTradingService.startMonitoring();

// Stop monitoring  
CopyTradingService.stopMonitoring();
```

### Add/Remove Configurations
```javascript
// Add a new target
await CopyTradingService.setupCopyTrading(
  'user123',
  '0x...',  // Target wallet
  0.1,      // Copy 10%
  0.05,     // Max 0.05 BNB
  2000      // 2 second delay
);

// Remove a configuration
CopyTradingService.removeConfig('user123');

// Get all configurations
const configs = CopyTradingService.getConfigs();
```

## 📈 Monitoring Your Copy Trading

### What to Look For

✅ **Success Indicators:**
- `🎯 Four.meme transaction detected`
- `⚡ Copying trade...`
- `✅ Trade executed successfully`
- `📊 Trade copied: 0.01 BNB`

❌ **Warning Signs:**
- `❌ Error copying trade`
- `⚠️ Insufficient balance`
- `🚫 Token not allowed`
- `⏰ Transaction timeout`

### Log Analysis

The system logs all activities. Key log patterns:

```
🔍 Processing 3 new block(s) (61447458 to 61447461)
🎯 Four.meme transaction detected: 0x1234...
   Token: 0xabcd...1234
   BNB Amount: 0.05 BNB
⚡ Copying trade with 10% ratio...
✅ Trade executed: 0x5678...
```

## 🔧 Troubleshooting

### Common Issues

1. **No transactions detected:**
   - Check if target wallet is active
   - Verify wallet address is correct
   - Four.meme transactions are not frequent

2. **Copy trading not working:**
   - Ensure you have BNB in your wallets
   - Check if target wallet has recent activity
   - Verify configuration is enabled

3. **High gas fees:**
   - Reduce `maxPositionSize`
   - Increase `delayMs` to avoid gas wars
   - Check current network gas prices

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
LOG_LEVEL=debug node start-copy-trading.js
```

## ⚠️ Important Notes

1. **Start Small**: Begin with small amounts to test
2. **Monitor Closely**: Watch the first few trades carefully
3. **Set Limits**: Use `maxPositionSize` to limit risk
4. **Check Balances**: Ensure you have enough BNB
5. **Gas Management**: Monitor gas prices and adjust delays

## 🎯 Best Practices

1. **Target Selection**: Choose wallets with consistent, profitable trading patterns
2. **Risk Management**: Never risk more than you can afford to lose
3. **Diversification**: Copy multiple targets to spread risk
4. **Regular Monitoring**: Check performance and adjust settings
5. **Backup Strategy**: Have a plan for when copy trading stops

## 📞 Support

If you encounter issues:
1. Check the logs for error messages
2. Verify your configuration
3. Test with small amounts first
4. Check BSC network status

---

**Happy Copy Trading! 🚀**


# 🤖 Telegram Bot Setup Guide

This guide will help you set up Telegram integration for your copy trading bot, allowing you to:
- 📱 Receive real-time alerts when trades are copied
- 🛒 Execute manual buy/sell orders via Telegram
- 📊 Check wallet status and token balances
- ⚠️ Get funding alerts when wallets need BNB

## 📋 Prerequisites

1. **Telegram Account**: You need a Telegram account
2. **Bot Token**: You'll need to create a Telegram bot
3. **Chat ID**: You'll need your Telegram chat ID

## 🚀 Step 1: Create a Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather
3. **Send the command**: `/newbot`
4. **Follow the prompts**:
   - Choose a name for your bot (e.g., "My Copy Trading Bot")
   - Choose a username (e.g., "my_copy_trading_bot")
5. **Save the bot token** that BotFather gives you (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## 🔍 Step 2: Get Your Chat ID

1. **Search for** `@userinfobot` on Telegram
2. **Start a chat** with @userinfobot
3. **Send any message** (like "hi")
4. **Copy your Chat ID** from the response (looks like: `123456789`)

## ⚙️ Step 3: Configure Environment Variables

1. **Copy the template**:
   ```bash
   cp env.template .env
   ```

2. **Edit the .env file** with your credentials:
   ```bash
   nano .env
   ```

3. **Add your Telegram credentials**:
   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=123456789
   TELEGRAM_ENABLED=true
   ```

4. **Save and exit** (Ctrl+X, then Y, then Enter)

## 🧪 Step 4: Test the Bot

1. **Start the copy trading monitor**:
   ```bash
   node copy-trading-monitor.js
   ```

2. **Look for this message**:
   ```
   🤖 Initializing Telegram bot...
   ✅ Telegram bot ready for commands and alerts
   ```

3. **If you see an error**, check your bot token and chat ID

## 📱 Step 5: Test Telegram Commands

1. **Find your bot** on Telegram (search for the username you created)
2. **Start a chat** with your bot
3. **Send `/start`** to see the welcome message
4. **Try these commands**:
   - `/status` - Check wallet status
   - `/help` - Show all available commands

## 🛒 Available Telegram Commands

### 📊 Status & Information
- `/start` - Welcome message and introduction
- `/help` - Show all available commands
- `/status` - Check wallet balances and funding status
- `/balance <tokenAddress>` - Check token balances across all wallets

### 💰 Manual Trading
- `/buy <tokenAddress> <bnbAmount>` - Buy tokens with BNB
- `/sell <tokenAddress> <percentage>` - Sell percentage of token holdings

### 📝 Examples
```
/status
/buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001
/sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50
/balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444
```

## 🔔 Automatic Alerts

The bot will automatically send you:

### 📈 Copy Trading Alerts
- **🛒 Buy alerts** when a target wallet is copied
- **💸 Sell alerts** when a target wallet sells
- **Transaction details** including token, amount, and transaction hash

### ⚠️ Funding Alerts
- **Low balance warnings** when wallets need funding
- **Recommendations** for optimal wallet funding

## 🛠️ Troubleshooting

### Bot Not Responding
1. **Check your bot token** - Make sure it's correct
2. **Check your chat ID** - Make sure it's numeric
3. **Start the bot first** - Send `/start` to your bot
4. **Check console logs** for error messages

### Commands Not Working
1. **Make sure the bot is running** - Check console for "Telegram bot ready"
2. **Check command format** - Use exact syntax as shown in examples
3. **Verify token addresses** - Use valid contract addresses

### No Alerts Received
1. **Check TELEGRAM_ENABLED=true** in your .env file
2. **Make sure copy trading is active** - Bot must be monitoring wallets
3. **Check wallet funding** - Alerts only work with funded wallets

## 🔒 Security Notes

- **Never share your bot token** - Keep it private
- **Don't commit .env file** - It contains sensitive information
- **Use environment variables** - Don't hardcode credentials
- **Test with small amounts** - Start with minimal BNB amounts

## 📞 Support

If you encounter issues:
1. **Check the console logs** for error messages
2. **Verify your Telegram credentials** are correct
3. **Make sure your bot is properly configured** with BotFather
4. **Test with simple commands** like `/status` first

## 🎉 You're Ready!

Once everything is set up, you can:
- **Monitor copy trading** via Telegram alerts
- **Execute manual trades** from anywhere
- **Check wallet status** on the go
- **Get instant notifications** of all trading activity

Happy trading! 🚀

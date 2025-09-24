# Quick Setup Guide

## ✅ Environment Setup Complete!

The `.env` file has been created successfully. Now you need to update it with your actual values.

## 🔧 Required Configuration

Edit the `.env` file and update these required variables:

### 1. BOT_TOKEN (Required)
```bash
BOT_TOKEN=your_actual_bot_token_here
```
- Get this from [@BotFather](https://t.me/BotFather) on Telegram
- Create a new bot and copy the token

### 2. ENCRYPTION_KEY (Required)
```bash
ENCRYPTION_KEY=your_32_character_encryption_key_here
```
- Must be exactly 32 characters long
- Generate a random string like: `abc123def456ghi789jkl012mno345pqr`

### 3. BSC_RPC_URL (Already Set)
```bash
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
```
- This is already configured correctly

## 🚀 Quick Test

After updating the `.env` file, run:

```bash
# Test the scanner
node test-four-meme-scanner.js

# Or run the example
node four-meme-scanner-example.js
```

## 📊 Current Configuration

Your scanner is configured to monitor:
- **Wallet 1**: `0x815f173371323a3f8ea9bf15059e91c9577ef7a7`
- **Wallet 2**: `0x3ffec7beae34121288a5303262f45f05699ad2a8`

**Settings**:
- Buy amount: `0.0001` BNB per token
- Sell time: `7` seconds
- Scan interval: `500ms` (fast mode)
- Target contract: `0x5c952063c7fc8610ffdb798152d69f0b9550762b` (Four.meme V2)

## 🧪 Test Without Environment

If you want to test the core logic without setting up environment variables:

```bash
node test-scanner-simple.js
```

## 📝 Example .env File

Here's what your `.env` file should look like after updating:

```bash
# Required Environment Variables for Safe Four-Meme Trader

# BSC Network Configuration
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Telegram Bot Configuration
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Security Configuration
ENCRYPTION_KEY=abc123def456ghi789jkl012mno345pqr

# Optional Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Trading Configuration
GAS_PRICE_MULTIPLIER=1.0
MAX_GAS_PRICE=20
MIN_GAS_PRICE=0.1
MAX_SLIPPAGE=5.0

# Security Settings
MAX_WALLETS_PER_USER=10
MAX_TRANSACTION_AMOUNT=10
MIN_TRANSACTION_AMOUNT=0.000001
ENABLE_ENCRYPTION=true
ENABLE_RATE_LIMITING=true
ENABLE_INPUT_VALIDATION=true

# Auto Trading Configuration
AUTO_TRADING_ENABLED=true
MAX_AUTO_ORDERS_PER_USER=10
PRICE_CHECK_INTERVAL=30000
AUTO_TRADING_MAX_SLIPPAGE=5.0
AUTO_TRADING_MIN_AMOUNT=0.001
AUTO_TRADING_MAX_AMOUNT=1.0
```

## 🎯 What Happens Next

Once configured, the scanner will:

1. **Monitor** your two wallet addresses every 500ms
2. **Detect** when they call `createToken` on four.meme contract
3. **Buy** 0.0001 BNB worth of the new token immediately
4. **Sell** the token after 7 seconds

The system is now ready to automatically trade tokens created by your monitored wallets!



#!/bin/bash

# Start Live Scanner in Live Mode
# This script starts the live scanner with REAL TRADING ENABLED

echo "🚀 Starting Live Scanner in LIVE MODE"
echo "====================================="
echo "⚠️  REAL TRADING ENABLED - USE WITH CAUTION!"
echo "💰 This will execute real trades with real money"
echo ""

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ dist directory not found. Building project..."
    npm run build
fi

# Check if config exists
if [ ! -f "live-scanner-config.json" ]; then
    echo "❌ live-scanner-config.json not found. Creating default config..."
    cp live-scanner-config.json live-scanner-config.json.backup 2>/dev/null || true
fi

# Safety confirmation
echo "🛡️ SAFETY CHECK"
echo "==============="
echo "Before proceeding, please confirm:"
echo "1. You have tested the system in test mode"
echo "2. You have reviewed your pattern configuration"
echo "3. You have set appropriate safety limits"
echo "4. You are ready to trade with real money"
echo ""
read -p "Type 'YES' to confirm and start live trading: " confirmation

if [ "$confirmation" != "YES" ]; then
    echo "❌ Confirmation failed. Exiting for safety."
    exit 1
fi

# Enable live mode
echo "🔧 Enabling live trading mode..."
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('live-scanner-config.json', 'utf8'));
config.trading.enabled = true;
config.trading.testMode = false;
fs.writeFileSync('live-scanner-config.json', JSON.stringify(config, null, 2));
console.log('✅ Live trading mode enabled');
"

echo ""
echo "🚀 Starting live scanner with REAL TRADING..."
echo "Press Ctrl+C to stop"
echo ""

# Start the scanner
node live-scanner.js

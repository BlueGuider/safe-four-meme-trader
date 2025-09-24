#!/bin/bash

# Start Live Scanner in Test Mode
# This script starts the live scanner in safe test mode

echo "🧪 Starting Live Scanner in TEST MODE"
echo "====================================="
echo "⚠️  NO REAL TRADES WILL BE EXECUTED"
echo "📊 This will only show what trades WOULD be made"
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

# Ensure test mode is enabled
echo "🔧 Ensuring test mode is enabled..."
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('live-scanner-config.json', 'utf8'));
config.trading.enabled = false;
config.trading.testMode = true;
fs.writeFileSync('live-scanner-config.json', JSON.stringify(config, null, 2));
console.log('✅ Test mode enabled');
"

echo ""
echo "🚀 Starting live scanner..."
echo "Press Ctrl+C to stop"
echo ""

# Start the scanner
node live-scanner.js

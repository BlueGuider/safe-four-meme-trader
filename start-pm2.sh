#!/bin/bash

# Start Live Scanner with PM2 (Production)
# This script starts the live scanner using PM2 for production deployment

echo "🚀 Starting Live Scanner with PM2"
echo "================================="
echo "📊 Production deployment with process management"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing PM2..."
    npm install -g pm2
fi

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

# Create PM2 ecosystem file
echo "🔧 Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'live-scanner',
    script: 'live-scanner.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Stop existing process if running
echo "🛑 Stopping existing processes..."
pm2 stop live-scanner 2>/dev/null || true
pm2 delete live-scanner 2>/dev/null || true

# Start the scanner
echo "🚀 Starting live scanner with PM2..."
pm2 start ecosystem.config.js

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📋 Useful commands:"
echo "  pm2 status          - Check status"
echo "  pm2 logs live-scanner - View logs"
echo "  pm2 stop live-scanner  - Stop scanner"
echo "  pm2 restart live-scanner - Restart scanner"
echo "  pm2 monit          - Monitor dashboard"
echo ""

# Follow logs
echo "📝 Following logs (Ctrl+C to exit):"
pm2 logs live-scanner

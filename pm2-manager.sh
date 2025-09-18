#!/bin/bash

# PM2 Manager Script for Copy Trading Bot
# Usage: ./pm2-manager.sh [start|stop|restart|status|logs|delete]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

case "$1" in
    start)
        echo "🚀 Starting Copy Trading Bot with PM2..."
        pm2 start ecosystem.config.js --env production
        echo "✅ Bot started successfully!"
        echo "📊 Use './pm2-manager.sh status' to check status"
        echo "📝 Use './pm2-manager.sh logs' to view logs"
        ;;
    
    stop)
        echo "⏹️  Stopping Copy Trading Bot..."
        pm2 stop copy-trading-bot
        echo "✅ Bot stopped successfully!"
        ;;
    
    restart)
        echo "🔄 Restarting Copy Trading Bot..."
        pm2 restart copy-trading-bot
        echo "✅ Bot restarted successfully!"
        ;;
    
    status)
        echo "📊 Copy Trading Bot Status:"
        pm2 status copy-trading-bot
        ;;
    
    logs)
        echo "📝 Showing Copy Trading Bot logs (Press Ctrl+C to exit):"
        pm2 logs copy-trading-bot --lines 50
        ;;
    
    delete)
        echo "🗑️  Deleting Copy Trading Bot from PM2..."
        pm2 delete copy-trading-bot
        echo "✅ Bot deleted from PM2!"
        ;;
    
    update)
        echo "🔄 Updating and restarting Copy Trading Bot..."
        npm run build
        pm2 restart copy-trading-bot
        echo "✅ Bot updated and restarted!"
        ;;
    
    *)
        echo "🤖 Copy Trading Bot PM2 Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|delete|update}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the bot with PM2"
        echo "  stop    - Stop the bot"
        echo "  restart - Restart the bot"
        echo "  status  - Show bot status"
        echo "  logs    - Show bot logs"
        echo "  delete  - Remove bot from PM2"
        echo "  update  - Build and restart bot"
        echo ""
        echo "Examples:"
        echo "  ./pm2-manager.sh start    # Start the bot"
        echo "  ./pm2-manager.sh logs     # View logs"
        echo "  ./pm2-manager.sh restart  # Restart bot"
        ;;
esac

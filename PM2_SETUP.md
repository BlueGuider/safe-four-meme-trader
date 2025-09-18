# 🚀 PM2 Setup Guide for Copy Trading Bot

This guide will help you run your copy trading bot as a persistent service using PM2, so it won't close automatically.

## 📋 Prerequisites

1. **PM2 installed globally**:
   ```bash
   npm install -g pm2
   ```

2. **Environment configured**: Make sure your `.env` file is set up with Telegram credentials

## 🚀 Quick Start

### 1. Build the Project
```bash
npm run build
```

### 2. Start with PM2
```bash
./pm2-manager.sh start
```

### 3. Check Status
```bash
./pm2-manager.sh status
```

### 4. View Logs
```bash
./pm2-manager.sh logs
```

## 📱 PM2 Manager Commands

The `pm2-manager.sh` script provides easy management:

| Command | Description |
|---------|-------------|
| `./pm2-manager.sh start` | Start the bot with PM2 |
| `./pm2-manager.sh stop` | Stop the bot |
| `./pm2-manager.sh restart` | Restart the bot |
| `./pm2-manager.sh status` | Show bot status |
| `./pm2-manager.sh logs` | View bot logs |
| `./pm2-manager.sh delete` | Remove bot from PM2 |
| `./pm2-manager.sh update` | Build and restart bot |

## 🔧 Manual PM2 Commands

If you prefer to use PM2 directly:

```bash
# Start the bot
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

# View logs
pm2 logs copy-trading-bot

# Restart
pm2 restart copy-trading-bot

# Stop
pm2 stop copy-trading-bot

# Delete
pm2 delete copy-trading-bot

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 📊 Monitoring Features

PM2 provides several monitoring features:

### Real-time Monitoring
```bash
pm2 monit
```

### Process Information
```bash
pm2 show copy-trading-bot
```

### Log Management
```bash
# View last 100 lines
pm2 logs copy-trading-bot --lines 100

# Follow logs in real-time
pm2 logs copy-trading-bot --follow

# Clear logs
pm2 flush
```

## 🔄 Auto-restart Features

The bot will automatically restart if:
- ✅ **Memory limit exceeded** (1GB)
- ✅ **Process crashes** 
- ✅ **Unexpected exit**
- ✅ **System reboot** (with `pm2 startup`)

## 📁 Log Files

Logs are automatically saved to:
- `./logs/combined.log` - All logs combined
- `./logs/out.log` - Standard output
- `./logs/error.log` - Error logs

## 🛠️ Configuration

The `ecosystem.config.js` file contains:
- **Process management** settings
- **Environment variables**
- **Logging configuration**
- **Restart policies**
- **Memory limits**

## 🚨 Troubleshooting

### Bot Not Starting
1. Check if PM2 is installed: `pm2 --version`
2. Verify environment variables: `cat .env`
3. Check logs: `./pm2-manager.sh logs`

### Bot Keeps Restarting
1. Check error logs: `pm2 logs copy-trading-bot --err`
2. Verify wallet funding
3. Check Telegram bot configuration

### Memory Issues
1. Monitor memory: `pm2 monit`
2. Adjust memory limit in `ecosystem.config.js`
3. Check for memory leaks in logs

## 🔒 Security Best Practices

1. **Run as non-root user** (recommended)
2. **Use environment variables** for sensitive data
3. **Monitor logs regularly**
4. **Keep PM2 updated**

## 📱 Telegram Integration

With PM2 running, your Telegram bot will:
- ✅ **Stay online 24/7**
- ✅ **Receive copy trading alerts**
- ✅ **Respond to manual commands**
- ✅ **Auto-restart if needed**

## 🎯 Production Deployment

For production deployment:

1. **Setup auto-start on boot**:
   ```bash
   pm2 startup
   pm2 save
   ```

2. **Use reverse proxy** (nginx/apache) if needed

3. **Monitor with external tools** (optional)

4. **Setup log rotation** (optional)

## 🎉 You're Ready!

Your copy trading bot is now running as a persistent service! It will:
- 🚀 **Start automatically** with the system
- 🔄 **Restart automatically** if it crashes
- 📱 **Stay connected** to Telegram 24/7
- 📊 **Monitor wallets** continuously
- 💰 **Execute trades** automatically

Happy trading! 🚀

module.exports = {
  apps: [{
    name: 'copy-trading-bot',
    script: 'copy-trading-monitor.js',
    cwd: '/root/safe-four-meme-trader',
    
    // Process management
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      TELEGRAM_ENABLED: 'true'
    },
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart policy
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Advanced options
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Ignore certain files for watching
    ignore_watch: [
      'node_modules',
      'logs',
      'data',
      'dist',
      '.git'
    ],
    
    // Environment-specific settings
    env_production: {
      NODE_ENV: 'production',
      TELEGRAM_ENABLED: 'true'
    },
    
    env_development: {
      NODE_ENV: 'development',
      TELEGRAM_ENABLED: 'true'
    }
  }]
};
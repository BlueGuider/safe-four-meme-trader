const fs = require('fs');
const path = require('path');

/**
 * Setup script to create .env file with required environment variables
 */

console.log('🔧 Setting up environment variables for Safe Four-Meme Trader\n');

// Required environment variables
const envTemplate = `# Required Environment Variables for Safe Four-Meme Trader

# BSC Network Configuration
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Telegram Bot Configuration
# Get your bot token from @BotFather on Telegram
BOT_TOKEN=your_bot_token_here

# Security Configuration
# Generate a 32-character encryption key for wallet security
ENCRYPTION_KEY=your_32_character_encryption_key_here

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
`;

const envPath = path.join(__dirname, '.env');

try {
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists!');
    console.log('📝 Please update the following required variables in your .env file:');
    console.log('');
    console.log('   BSC_RPC_URL=https://bsc-dataseed1.binance.org/');
    console.log('   BOT_TOKEN=your_bot_token_here');
    console.log('   ENCRYPTION_KEY=your_32_character_encryption_key_here');
    console.log('');
    console.log('💡 You can get a BOT_TOKEN from @BotFather on Telegram');
    console.log('🔐 Generate a random 32-character string for ENCRYPTION_KEY');
  } else {
    // Create .env file
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env file successfully!');
    console.log('');
    console.log('📝 Please update the following required variables in your .env file:');
    console.log('');
    console.log('   BSC_RPC_URL=https://bsc-dataseed1.binance.org/');
    console.log('   BOT_TOKEN=your_bot_token_here');
    console.log('   ENCRYPTION_KEY=your_32_character_encryption_key_here');
    console.log('');
    console.log('💡 You can get a BOT_TOKEN from @BotFather on Telegram');
    console.log('🔐 Generate a random 32-character string for ENCRYPTION_KEY');
  }

  console.log('');
  console.log('🚀 After updating the .env file, you can run:');
  console.log('   node test-four-meme-scanner.js');
  console.log('   node four-meme-scanner-example.js');

} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('');
  console.log('📝 Please manually create a .env file with the following content:');
  console.log('');
  console.log(envTemplate);
}



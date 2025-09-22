const { CopyTradingService } = require('../dist/services/copyTrading');
const { WalletService } = require('../dist/services/wallet');
const { TradingService } = require('../dist/services/trading');
const { PancakeSwapService } = require('../dist/services/pancakeSwap');
const { TelegramBotService } = require('../dist/services/telegramBot');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Manual Trading Functions
async function showWalletStatus(userId = 'copy-trading-bot') {
  console.log('\n💰 WALLET STATUS');
  console.log('================');
  
  const balanceCheck = await WalletService.checkWalletBalances(userId);
  console.log(`📊 Total wallets: ${balanceCheck.totalWallets}`);
  console.log(`✅ Funded wallets: ${balanceCheck.fundedWallets}`);
  console.log(`💵 Total balance: ${balanceCheck.totalBalance.toFixed(6)} BNB`);
  console.log(`📈 Average balance: ${balanceCheck.averageBalance.toFixed(6)} BNB`);
  
  if (balanceCheck.recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`);
    balanceCheck.recommendations.forEach(rec => console.log(`   ${rec}`));
  }
  
  if (balanceCheck.unfundedWallets.length > 0) {
    console.log(`\n⚠️  Unfunded wallets:`);
    balanceCheck.unfundedWallets.forEach(addr => console.log(`   ${addr}`));
  }
  
  console.log('');
  return balanceCheck;
}

async function manualBuy(tokenAddress, bnbAmount, userId = 'copy-trading-bot') {
  console.log('\n🛒 MANUAL BUY');
  console.log('=============');
  
  console.log(`🪙 Token: ${tokenAddress}`);
  console.log(`💰 Amount: ${bnbAmount} BNB`);
  console.log(`👤 User: ${userId}`);
  
  // Check if token is migrated
  const platformInfo = await CopyTradingService.determineTradingPlatform(tokenAddress);
  console.log(`🏢 Platform: ${platformInfo.platform}`);
  console.log(`✅ Tradeable: ${platformInfo.isTradeable}`);
  
  if (!platformInfo.isTradeable) {
    console.log('❌ Token is not tradeable\n');
    return;
  }
  
  try {
    let result;
    if (platformInfo.platform === 'DEX') {
      console.log('🔄 Using PancakeSwap...');
      result = await PancakeSwapService.buyTokens(tokenAddress, bnbAmount, userId, 5.0);
    } else {
      console.log('🔄 Using four.meme...');
      result = await TradingService.buyTokens(tokenAddress, bnbAmount, userId);
    }
    
    if (result.success) {
      console.log(`✅ Buy successful!`);
      console.log(`📝 Transaction: ${result.data?.txHash}`);
      console.log(`👛 Wallets used: ${result.data?.successCount}/${result.data?.totalWallets}`);
    } else {
      console.log(`❌ Buy failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('');
}

async function manualSell(tokenAddress, sellPercentage, userId = 'copy-trading-bot') {
  console.log('\n💸 MANUAL SELL');
  console.log('==============');
  
  console.log(`🪙 Token: ${tokenAddress}`);
  console.log(`📊 Percentage: ${sellPercentage}%`);
  console.log(`👤 User: ${userId}`);
  
  // Check if token is migrated
  const platformInfo = await CopyTradingService.determineTradingPlatform(tokenAddress);
  console.log(`🏢 Platform: ${platformInfo.platform}`);
  console.log(`✅ Tradeable: ${platformInfo.isTradeable}`);
  
  if (!platformInfo.isTradeable) {
    console.log('❌ Token is not tradeable\n');
    return;
  }
  
  try {
    let result;
    if (platformInfo.platform === 'DEX') {
      console.log('🔄 Using PancakeSwap...');
      result = await PancakeSwapService.sellTokens(tokenAddress, sellPercentage, userId, 5.0);
    } else {
      console.log('🔄 Using four.meme...');
      result = await TradingService.sellTokens(tokenAddress, sellPercentage, userId);
    }
    
    if (result.success) {
      console.log(`✅ Sell successful!`);
      console.log(`📝 Transaction: ${result.data?.txHash}`);
      console.log(`👛 Wallets used: ${result.data?.successCount}/${result.data?.totalWallets}`);
    } else {
      console.log(`❌ Sell failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('');
}

async function showTokenBalances(tokenAddress, userId = 'copy-trading-bot') {
  console.log('\n📊 TOKEN BALANCES');
  console.log('=================');
  
  console.log(`🪙 Token: ${tokenAddress}`);
  console.log(`👤 User: ${userId}`);
  
  try {
    const result = await TradingService.getTokenBalances(tokenAddress, userId);
    
    if (result.success) {
      console.log(`📈 Total Balance: ${result.data?.totalBalance} tokens`);
      console.log(`👛 Wallets with tokens: ${result.data?.balances.length}\n`);
      
      result.data?.balances.forEach((balance, index) => {
        if (parseFloat(balance.balance) > 0) {
          console.log(`   ${index + 1}. ${balance.address}`);
          console.log(`      Balance: ${balance.balance} ${balance.tokenSymbol}`);
          console.log(`      Name: ${balance.tokenName}\n`);
        }
      });
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('');
}

async function startCopyTradingMonitor() {
  console.log('🚀 COPY TRADING MONITOR');
  console.log('=======================\n');

  // Initialize Telegram bot
  const telegramConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: process.env.TELEGRAM_ENABLED === 'true' && !!process.env.TELEGRAM_BOT_TOKEN
  };

  if (telegramConfig.enabled) {
    console.log('🤖 Initializing Telegram bot...');
    TelegramBotService.initialize(telegramConfig);
    console.log('✅ Telegram bot ready for commands and alerts\n');
  } else {
    console.log('📱 Telegram bot disabled (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable)\n');
  }

  // Initialize copy trading service
  const copyTrading = new CopyTradingService();

  // Add target wallets configuration
  const targetWallets = [
    // '0x56d5f3491c100b00b9823fa427d8b92cd6a6fcae',
    '0x345beee2ce2d8e3294ac7353cf19ece3ff61b507'
  ];
  
  console.log('📊 Configuration:');
  console.log(`   Target Wallets: ${targetWallets.length}`);
  targetWallets.forEach((wallet, index) => {
    console.log(`   ${index + 1}. ${wallet}`);
  });
  console.log(`   Mode: LIVE TRADING (Real trades will be executed)`);
  console.log(`   Copy Ratio: 10%`);
  console.log('');

  // Disable testing mode for live trading
  CopyTradingService.setTestingMode(false);

  try {
    // Create a dedicated copy trading user ID
    const copyTradingUserId = 'copy-trading-bot';
    
    // Check existing wallets and create only if needed
    console.log('🔧 Setting up copy trading bot wallets...');
    const existingWallets = WalletService.getWalletAddresses(copyTradingUserId);
    
    if (existingWallets.length === 0) {
      // No wallets exist, create 1
      console.log('📝 No wallets found, creating new wallet...');
      const walletResult = await WalletService.createWallets(copyTradingUserId, 1);
      if (walletResult.success) {
        console.log(`✅ Copy trading wallet created: ${walletResult.data?.wallets[0]?.address}`);
      } else {
        console.log(`⚠️  Wallet creation failed: ${walletResult.error}`);
      }
    } else {
      // Wallets already exist, just show them
      console.log(`✅ Found ${existingWallets.length} existing wallet(s):`);
      existingWallets.forEach((address, index) => {
        console.log(`   ${index + 1}. ${address}`);
      });
    }
    
    // Check wallet balance and provide funding guidance (for all wallets)
    const balanceCheck = await WalletService.checkWalletBalances(copyTradingUserId);
    console.log(`\n💰 Wallet Balance Check:`);
    console.log(`   Total wallets: ${balanceCheck.totalWallets}`);
    console.log(`   Funded wallets: ${balanceCheck.fundedWallets}`);
    console.log(`   Total balance: ${balanceCheck.totalBalance.toFixed(6)} BNB`);
    console.log(`   Average balance: ${balanceCheck.averageBalance.toFixed(6)} BNB`);
    
    if (balanceCheck.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      balanceCheck.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
    
    if (balanceCheck.unfundedWallets.length > 0) {
      console.log(`\n⚠️  Unfunded wallets:`);
      balanceCheck.unfundedWallets.forEach(addr => console.log(`   ${addr}`));
      console.log(`\n💡 Fund these wallets with BNB to enable copy trading`);
      
      // Send Telegram funding alert
      if (telegramConfig.enabled) {
        await TelegramBotService.sendFundingAlert({
          totalBalance: balanceCheck.totalBalance,
          fundedWallets: balanceCheck.fundedWallets,
          totalWallets: balanceCheck.totalWallets,
          unfundedWallets: balanceCheck.unfundedWallets
        });
      }
    }
    
    // Add all target wallets to monitor
    for (let i = 0; i < targetWallets.length; i++) {
      const wallet = targetWallets[i];
      await CopyTradingService.addTargetWallet(wallet, {
        copyRatio: 0.1, // 10% copy ratio
        maxPositionSize: 0.001, // 1 BNB max
        minPositionSize: 0.0005, // 0.001 BNB min
        enabled: true
      });
      console.log(`✅ Target wallet ${i + 1}/${targetWallets.length} added: ${wallet.slice(0, 10)}...${wallet.slice(-6)}`);
    }
    console.log('🔍 Starting live monitoring...\n');

    // Monitoring will start automatically when wallet is added

    // Keep the process running
    console.log('📡 Monitoring active. Press Ctrl+C to stop.\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping copy trading monitor...');
      CopyTradingService.stopMonitoring();
      console.log('✅ Copy trading monitor stopped');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start copy trading monitor:', error);
    process.exit(1);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'status') {
    await showWalletStatus();
    process.exit(0);
  } else if (command === 'buy') {
    if (args.length < 3) {
      console.log('❌ Usage: node copy-trading-monitor.js buy <tokenAddress> <bnbAmount>');
      process.exit(1);
    }
    await manualBuy(args[1], parseFloat(args[2]));
    process.exit(0);
  } else if (command === 'sell') {
    if (args.length < 3) {
      console.log('❌ Usage: node copy-trading-monitor.js sell <tokenAddress> <percentage>');
      process.exit(1);
    }
    await manualSell(args[1], parseInt(args[2]));
    process.exit(0);
  } else if (command === 'balance') {
    if (args.length < 2) {
      console.log('❌ Usage: node copy-trading-monitor.js balance <tokenAddress>');
      process.exit(1);
    }
    await showTokenBalances(args[1]);
    process.exit(0);
  } else if (command === 'help') {
    console.log('📖 MANUAL TRADING COMMANDS:');
    console.log('   node copy-trading-monitor.js status                    - Show wallet status');
    console.log('   node copy-trading-monitor.js buy <token> <bnbAmount>   - Buy tokens');
    console.log('   node copy-trading-monitor.js sell <token> <percentage> - Sell tokens');
    console.log('   node copy-trading-monitor.js balance <token>           - Show token balances');
    console.log('   node copy-trading-monitor.js help                      - Show this help');
    console.log('');
    console.log('📝 EXAMPLES:');
    console.log('   node copy-trading-monitor.js status');
    console.log('   node copy-trading-monitor.js buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001');
    console.log('   node copy-trading-monitor.js sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50');
    console.log('   node copy-trading-monitor.js balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444');
    console.log('');
    console.log('🚀 COPY TRADING:');
    console.log('   node copy-trading-monitor.js                          - Start copy trading monitor');
    process.exit(0);
  } else {
    // No command or unknown command - start copy trading monitor
    await startCopyTradingMonitor();
  }
}

// Start the application
main().catch((error) => {
  console.error('❌ Application failed:', error);
  process.exit(1);
});

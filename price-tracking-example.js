const { CopyTradingService } = require('./src/services/copyTrading');
const { PriceTrackingService } = require('./src/services/priceTrackingService');
const { DirectPriceService } = require('./src/services/directPriceService');

/**
 * Example usage of the enhanced price tracking system
 * This demonstrates how to use the new features for automatic selling
 */

async function demonstratePriceTracking() {
  console.log('🚀 Starting Price Tracking Demo\n');

  // 1. Setup copy trading (this will automatically start price tracking)
  console.log('📝 Setting up copy trading...');
  const copyResult = await CopyTradingService.setupCopyTrading(
    'user123', // User ID
    '0x1234567890123456789012345678901234567890', // Target wallet
    0.1, // Copy 10% of target's trades
    0.5, // Max 0.5 BNB per trade
    2000 // 2 second delay
  );

  if (copyResult.success) {
    console.log('✅ Copy trading setup successful');
  } else {
    console.log('❌ Copy trading setup failed:', copyResult.error);
    return;
  }

  // 2. Configure price tracking settings
  console.log('\n📊 Configuring price tracking...');
  CopyTradingService.updatePriceTrackingConfig({
    sellAt10Percent: true, // Sell 50% at 10% increase
    sellAt50Percent: true, // Sell 100% at 50% increase
    timeWindow10Percent: 10, // Within 10 seconds
    timeWindow50Percent: 20, // Within 20 seconds
    enabled: true,
    updateInterval: 2000 // Update every 2 seconds
  });

  console.log('✅ Price tracking configured');
  console.log('   - 10% increase → Sell 50% (within 10s)');
  console.log('   - 50% increase → Sell 100% (within 20s)');
  console.log('   - Update interval: 2 seconds');

  // 3. Manually start tracking a token (simulating a buy)
  console.log('\n🪙 Manually starting token tracking...');
  const tokenAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
  const buyPrice = 0.000001; // 0.000001 BNB per token
  const buyPriceUSD = 0.0003; // $0.0003 per token
  const buyAmount = 0.1; // 0.1 BNB spent
  const tokenAmount = 100000; // 100,000 tokens received

  const trackingResult = await CopyTradingService.getPriceTrackingService().startTrackingToken(
    tokenAddress,
    buyPrice,
    buyPriceUSD,
    buyAmount,
    tokenAmount,
    'user123',
    '0x9876543210987654321098765432109876543210' // Wallet address
  );

  if (trackingResult.success) {
    console.log('✅ Token tracking started');
  } else {
    console.log('❌ Token tracking failed:', trackingResult.error);
  }

  // 4. Monitor tracked tokens
  console.log('\n📈 Monitoring tracked tokens...');
  setInterval(() => {
    const trackedTokens = CopyTradingService.getAllTrackedTokens();
    console.log(`\n📊 Currently tracking ${trackedTokens.length} token(s):`);
    
    trackedTokens.forEach((token, index) => {
      const priceChangeEmoji = token.priceChangePercent > 0 ? '📈' : 
                              token.priceChangePercent < 0 ? '📉' : '➡️';
      
      console.log(`   ${index + 1}. ${token.tokenAddress.slice(0, 8)}...`);
      console.log(`      ${priceChangeEmoji} Price: ${token.currentPrice.toFixed(8)} BNB (${token.priceChangePercent > 0 ? '+' : ''}${token.priceChangePercent.toFixed(2)}%)`);
      console.log(`      💰 USD: $${token.currentPriceUSD.toFixed(4)}`);
      console.log(`      🏆 Max: ${token.maxPriceReached.toFixed(8)} BNB (+${token.maxPriceChangePercent.toFixed(2)}%)`);
      console.log(`      🪙 Amount: ${token.tokenAmount.toFixed(2)} tokens`);
      console.log(`      ⏰ Last update: ${token.lastUpdated.toLocaleTimeString()}`);
    });
  }, 10000); // Check every 10 seconds

  // 5. Demonstrate manual price checking
  console.log('\n🔍 Demonstrating manual price checking...');
  const priceService = DirectPriceService.getInstance();
  
  try {
    const priceResult = await priceService.getFourMemeExactPrice(tokenAddress);
    if (priceResult.success) {
      console.log('✅ Current price data:');
      console.log(`   Buy price: ${priceResult.data.buyPrice.toFixed(8)} BNB`);
      console.log(`   Sell price: ${priceResult.data.sellPrice.toFixed(8)} BNB`);
      console.log(`   Average: ${priceResult.data.avgPrice.toFixed(8)} BNB`);
      console.log(`   USD: $${priceResult.data.priceUSD.toFixed(4)}`);
    } else {
      console.log('❌ Failed to get price:', priceResult.error);
    }
  } catch (error) {
    console.log('❌ Error getting price:', error.message);
  }

  // 6. Show statistics
  console.log('\n📊 Price tracking statistics:');
  const stats = CopyTradingService.getPriceTrackingStats();
  console.log(`   Total tracked: ${stats.totalTracked}`);
  console.log(`   Active tracked: ${stats.activeTracked}`);
  console.log(`   Total users: ${stats.totalUsers}`);
  console.log(`   Average price change: ${stats.averagePriceChange.toFixed(2)}%`);

  // 7. Demonstrate copy sell trigger
  console.log('\n🔄 Demonstrating copy sell trigger...');
  setTimeout(async () => {
    console.log('Triggering copy sell for demonstration...');
    await CopyTradingService.getPriceTrackingService().copySellToken(
      tokenAddress,
      'user123',
      50 // Sell 50%
    );
  }, 15000); // Trigger after 15 seconds

  console.log('\n🎯 Price tracking system is now active!');
  console.log('   - Tokens will be automatically sold based on price increases');
  console.log('   - Copy trading will trigger sells when target wallets sell');
  console.log('   - Tokens will be removed from tracking when fully sold');
  console.log('   - All actions will be logged and sent via Telegram');
}

// Run the demonstration
if (require.main === module) {
  demonstratePriceTracking().catch(console.error);
}

module.exports = { demonstratePriceTracking };

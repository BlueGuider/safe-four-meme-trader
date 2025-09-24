const { TokenCreationScanner } = require('./dist/services/tokenCreationScanner');

/**
 * Example usage of the modified TokenCreationScanner
 * This script shows how to monitor creator wallets for four.meme token creation
 */

async function runFourMemeScanner() {
  console.log('🚀 Four.Meme Token Creation Scanner Example\n');

  try {
    // Create scanner instance
    const scanner = new TokenCreationScanner();

    // Add creator addresses to monitor
    const creatorsToMonitor = [
      '0x815f173371323a3f8ea9bf15059e91c9577ef7a7',
      '0x3ffec7beae34121288a5303262f45f05699ad2a8'
    ];

    // Add all creators to monitoring
    creatorsToMonitor.forEach(creator => {
      scanner.addMonitoredCreator(creator);
      console.log(`👤 Added creator to monitoring: ${creator.slice(0, 8)}...${creator.slice(-8)}`);
    });

    // Configure scanner settings (matching your configuration)
    scanner.setBuyAmount(0.0001); // Buy 0.0001 BNB worth of tokens (small amount)
    scanner.setSellTime(7); // Sell after 7 seconds

    console.log('\n📊 Scanner Configuration:');
    console.log(`   Monitored creators: ${scanner.getMonitoredCreators().length}`);
    console.log(`   Buy amount: ${scanner.getStatus().buyAmount} BNB per token`);
    console.log(`   Sell time: ${scanner.getStatus().sellTimeSeconds} seconds`);
    console.log(`   Target contract: 0x5c952063c7fc8610ffdb798152d69f0b9550762b (Four.meme V2)`);
    console.log('');

    // Start monitoring
    console.log('🚀 Starting token creation monitoring...');
    console.log('📡 The scanner will now monitor BSC blocks for createToken transactions');
    console.log('⚡ Scanning every 500ms (fast mode) for quick detection');
    console.log('💰 When a monitored creator creates a token, the bot will automatically:');
    console.log('   1. Buy the token immediately (0.0001 BNB)');
    console.log('   2. Sell the token after 7 seconds');
    console.log('');

    await scanner.startScanning();

    // Keep the process running
    console.log('✅ Scanner is now running! Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down scanner...');
      await scanner.stopScanning();
      console.log('✅ Scanner stopped successfully');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
runFourMemeScanner().catch(console.error);

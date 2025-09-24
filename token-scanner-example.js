/**
 * Token Creation Scanner Example
 * 
 * This example demonstrates how to use the Token Creation Scanner
 * to automatically buy tokens from monitored creators.
 */

const { TokenCreationScanner } = require('./src/services/tokenCreationScanner');

async function main() {
  try {
    console.log('🚀 Token Creation Scanner Example');
    console.log('==================================\n');

    // Initialize the scanner
    const scanner = new TokenCreationScanner();

    // Monitored creator addresses
    const creators = [
      '0x815f173371323a3f8ea9bf15059e91c9577ef7a7', // Creator 1
      '0x3ffec7beae34121288a5303262f45f05699ad2a8', // Creator 2
    ];

    console.log('📝 Adding creators to monitor...');
    
    // Add creators to monitoring
    for (const creator of creators) {
      scanner.addMonitoredCreator(creator);
      console.log(`✅ Added creator: ${creator.slice(0, 8)}...`);
    }

    // Configure scanner settings
    scanner.setBuyAmount(0.0001); // Buy 0.1 BNB worth
    scanner.setSellTime(7);    // Sell after 7 seconds

    console.log('\n⚙️ Scanner Configuration:');
    const status = scanner.getStatus();
    console.log(`   Buy amount: ${status.buyAmount} BNB`);
    console.log(`   Sell time: ${status.sellTimeSeconds} seconds`);
    console.log(`   Scan interval: ${status.scanInterval}ms`);

    console.log('\n🎯 Starting token creation scanner...');
    
    // Start the scanner
    await scanner.startScanning();
    
    console.log('✅ Token creation scanner started successfully!');
    console.log('🔍 The bot will now scan blocks for token creation transactions...');
    console.log('💰 Automatic trades will be executed when monitored creators create new tokens.\n');

    // Monitor for a period of time (in a real scenario, this would run indefinitely)
    console.log('⏰ Monitoring for 60 seconds...');
    console.log('   (In production, this would run indefinitely)\n');

    // Set up periodic status updates
    const statusInterval = setInterval(() => {
      const currentStatus = scanner.getStatus();
      
      console.log(`📊 Status Update:`);
      console.log(`   Running: ${currentStatus.isRunning ? '✅' : '❌'}`);
      console.log(`   Monitored creators: ${currentStatus.monitoredCreatorsCount}`);
      console.log(`   Last processed block: ${currentStatus.lastProcessedBlock}`);
      console.log(`   Buy amount: ${currentStatus.buyAmount} BNB`);
      console.log(`   Sell time: ${currentStatus.sellTimeSeconds} seconds`);
      console.log('');
    }, 10000); // Update every 10 seconds

    // Wait for 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Clean up
    clearInterval(statusInterval);

    console.log('🛑 Stopping token creation scanner...');
    await scanner.stopScanning();
    
    console.log('✅ Token creation scanner stopped successfully!');

    // Show final statistics
    console.log('\n📊 Final Statistics:');
    const finalStatus = scanner.getStatus();
    
    console.log(`   Monitored creators: ${finalStatus.monitoredCreatorsCount}`);
    console.log(`   Last processed block: ${finalStatus.lastProcessedBlock}`);
    console.log(`   Buy amount: ${finalStatus.buyAmount} BNB`);
    console.log(`   Sell time: ${finalStatus.sellTimeSeconds} seconds`);

    console.log('\n🎉 Example completed successfully!');
    console.log('\n💡 How It Works:');
    console.log('   1. Scanner monitors blockchain blocks every 3 seconds');
    console.log('   2. Detects contract creation transactions (new tokens)');
    console.log('   3. Checks if creator is in monitored list');
    console.log('   4. Verifies contract is a token (ERC20 functions)');
    console.log('   5. Automatically buys token through four.meme');
    console.log('   6. Sells token after specified time');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Replace example creator addresses with real ones');
    console.log('   2. Adjust buy amounts and sell times');
    console.log('   3. Use Telegram commands to manage the scanner');
    console.log('   4. Monitor console logs and Telegram notifications');

  } catch (error) {
    console.error('💥 Error running example:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

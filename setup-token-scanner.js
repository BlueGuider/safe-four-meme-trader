/**
 * Token Scanner Setup Script
 * 
 * This script automatically sets up the token scanner with the specified
 * creator addresses and configuration.
 */

const { TokenCreationScanner } = require('./src/services/tokenCreationScanner');
const { SimpleTokenScannerCLI } = require('./src/services/simpleTokenScannerCLI');

async function setupTokenScanner() {
  try {
    console.log('🚀 Setting up Token Creation Scanner');
    console.log('====================================\n');

    // Initialize the CLI
    const cli = new SimpleTokenScannerCLI();

    // Your specific creator addresses
    const creators = [
      '0x815f173371323a3f8ea9bf15059e91c9577ef7a7',
      '0x3ffec7beae34121288a5303262f45f05699ad2a8'
    ];

    console.log('📝 Adding monitored creators...');
    
    // Add creators to monitoring
    for (const creator of creators) {
      cli.addCreator(creator);
    }

    // Configure scanner settings
    cli.setBuyAmount(0.0001); // Buy 0.0001 BNB worth (as per your change)
    cli.setSellTime(7);        // Sell after 7 seconds

    console.log('\n⚙️ Scanner Configuration:');
    cli.showStatus();

    console.log('\n🎯 Starting token creation scanner...');
    
    // Start the scanner
    await cli.startScanning();
    
    console.log('✅ Token creation scanner started successfully!');
    console.log('\n📊 Monitoring Status:');
    // console.log('   🔍 Scanning blocks every 3 seconds');
    console.log('   💰 Will buy 0.0001 BNB worth of tokens');
    console.log('   ⏰ Will sell tokens after 7 seconds');
    console.log('   📱 Console notifications enabled');
    
    console.log('\n🎯 Monitored Creators:');
    creators.forEach((creator, index) => {
      console.log(`   ${index + 1}. ${creator}`);
    });

    console.log('\n💡 Next Steps:');
    console.log('   1. Monitor console logs for token detection');
    console.log('   2. Watch console notifications for trades');
    console.log('   3. Use cli.showStatus() to check status');
    console.log('   4. Use cli.stopScanning() to stop when needed');
    
    console.log('\n🚀 Scanner is now running! Press Ctrl+C to stop.');

    // Keep the script running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping token creation scanner...');
      await cli.stopScanning();
      console.log('✅ Scanner stopped successfully!');
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {
      // Just keep the process running
    }, 1000);

  } catch (error) {
    console.error('💥 Error setting up token scanner:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupTokenScanner().catch(console.error);
}

module.exports = { setupTokenScanner };

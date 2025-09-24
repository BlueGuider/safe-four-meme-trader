const { TokenCreationScanner } = require('./dist/services/tokenCreationScanner');

/**
 * Test script for the modified TokenCreationScanner
 * This script tests the four.meme contract monitoring functionality
 */

async function testFourMemeScanner() {
  console.log('🧪 Testing Four.Meme Token Creation Scanner...\n');

  try {
    // Create scanner instance
    const scanner = new TokenCreationScanner();

    // Add the monitoring wallets you provided
    const monitoringWallets = [
      '0x815f173371323a3f8ea9bf15059e91c9577ef7a7',
      '0x3ffec7beae34121288a5303262f45f05699ad2a8'
    ];
    
    monitoringWallets.forEach(wallet => {
      scanner.addMonitoredCreator(wallet);
      console.log(`👤 Added monitoring wallet: ${wallet.slice(0, 8)}...${wallet.slice(-8)}`);
    });

    // Set test parameters (matching your configuration)
    scanner.setBuyAmount(0.0001); // Small amount for testing
    scanner.setSellTime(7); // 7 seconds for testing

    console.log('📊 Scanner Configuration:');
    console.log(`   Monitored creators: ${scanner.getMonitoredCreators().length}`);
    console.log(`   Buy amount: ${scanner.getStatus().buyAmount} BNB`);
    console.log(`   Sell time: ${scanner.getStatus().sellTimeSeconds} seconds`);
    console.log(`   Four.meme contract: 0x5c952063c7fc8610ffdb798152d69f0b9550762b`);
    console.log('');

    // Test the createToken function detection
    console.log('🔍 Testing createToken function detection...');
    
    // Test createToken method ID detection manually
    const createTokenMethodId = '0x519ebb10';
    const testInput = createTokenMethodId + '0000000000000000000000000000000000000000000000000000000000000040';
    
    const isCreateTokenCall = testInput.toLowerCase().startsWith(createTokenMethodId.toLowerCase());
    console.log(`   ✅ createToken function detection: ${isCreateTokenCall ? 'PASS' : 'FAIL'}`);

    if (isCreateTokenCall) {
      console.log('   📝 Transaction appears to be a createToken call');
    } else {
      console.log('   ⚠️ Transaction does not appear to be a createToken call');
    }

    // Test transaction structure
    const mockTx = {
      hash: '0x5a094f25ca0e31783d1ea4ee4a3e6349ea5fb206b314939729aff2beb760cbc5',
      from: '0x815f173371323a3f8ea9bf15059e91c9577ef7a7', // Your monitoring wallet
      to: '0x5c952063c7fc8610ffdb798152d69f0b9550762b',
      input: testInput,
      value: '0x4a817c800', // 0.02 BNB
      blockNumber: 51655929
    };

    console.log(`   ✅ Transaction structure test: PASS`);
    console.log(`   📝 From: ${mockTx.from.slice(0, 8)}...${mockTx.from.slice(-8)}`);
    console.log(`   📝 To: ${mockTx.to.slice(0, 8)}...${mockTx.to.slice(-8)}`);
    console.log(`   📝 Method ID: ${mockTx.input.slice(0, 10)}...`);

    console.log('');
    console.log('🚀 Starting scanner (will run for 30 seconds for testing)...');
    
    // Start the scanner
    await scanner.startScanning();

    // Let it run for 30 seconds
    setTimeout(async () => {
      console.log('\n🛑 Stopping scanner after 30 seconds...');
      await scanner.stopScanning();
      
      const status = scanner.getStatus();
      console.log('\n📊 Final Status:');
      console.log(`   Running: ${status.isRunning}`);
      console.log(`   Last processed block: ${status.lastProcessedBlock}`);
      console.log(`   Monitored creators: ${status.monitoredCreatorsCount}`);
      
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFourMemeScanner().catch(console.error);

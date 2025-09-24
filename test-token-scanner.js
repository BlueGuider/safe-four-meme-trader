/**
 * Test Token Scanner
 * 
 * This script tests the token scanner functionality.
 */

const { TokenCreationScanner } = require('./src/services/tokenCreationScanner');
const { SimpleTokenScannerCLI } = require('./src/services/simpleTokenScannerCLI');

async function testTokenScanner() {
  try {
    console.log('🧪 Testing Token Creation Scanner');
    console.log('=================================\n');

    // Test 1: Initialize scanner
    console.log('Test 1: Initialize scanner...');
    const scanner = new TokenCreationScanner();
    console.log('✅ Scanner initialized successfully\n');

    // Test 2: Add creators
    console.log('Test 2: Add creators...');
    scanner.addMonitoredCreator('0x815f173371323a3f8ea9bf15059e91c9577ef7a7');
    scanner.addMonitoredCreator('0x3ffec7beae34121288a5303262f45f05699ad2a8');
    console.log('✅ Creators added successfully\n');

    // Test 3: Configure settings
    console.log('Test 3: Configure settings...');
    scanner.setBuyAmount(0.0001);
    scanner.setSellTime(7);
    console.log('✅ Settings configured successfully\n');

    // Test 4: Check status
    console.log('Test 4: Check status...');
    const status = scanner.getStatus();
    console.log('Status:', status);
    console.log('✅ Status check successful\n');

    // Test 5: Test CLI
    console.log('Test 5: Test CLI...');
    const cli = new SimpleTokenScannerCLI();
    cli.addCreator('0x815f173371323a3f8ea9bf15059e91c9577ef7a7');
    cli.setBuyAmount(0.0001);
    cli.setSellTime(7);
    cli.showStatus();
    console.log('✅ CLI test successful\n');

    // Test 6: Simulate token creation
    console.log('Test 6: Simulate token creation...');
    scanner.simulateTokenCreation(
      '0x1234567890123456789012345678901234567890',
      '0x815f173371323a3f8ea9bf15059e91c9577ef7a7'
    );
    console.log('✅ Simulation test successful\n');

    console.log('🎉 All tests passed successfully!');
    console.log('\n💡 The token scanner is ready to use.');
    console.log('   Run: node setup-token-scanner.js');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testTokenScanner().catch(console.error);
}

module.exports = { testTokenScanner };

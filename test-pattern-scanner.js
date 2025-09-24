const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');

/**
 * Test script for Pattern-Based Token Scanner
 * This script tests the gas pattern analysis and token selection logic
 */

async function testPatternScanner() {
  console.log('🧪 Testing Pattern-Based Token Scanner...\n');

  try {
    // Create scanner instance
    const scanner = new PatternBasedScanner();

    // Test pattern loading
    console.log('📋 Testing pattern loading...');
    const patterns = scanner.getPatterns();
    console.log(`   ✅ Loaded ${patterns.length} patterns`);
    
    patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern.name} (${pattern.id})`);
      console.log(`      Gas Price: ${pattern.gasPrice.min}-${pattern.gasPrice.max} ${pattern.gasPrice.unit}`);
      console.log(`      Gas Limit: ${pattern.gasLimit.min.toLocaleString()}-${pattern.gasLimit.max.toLocaleString()}`);
      console.log(`      Buy Amount: ${pattern.trading.buyAmount} BNB`);
      console.log(`      Hold Time: ${pattern.trading.holdTimeSeconds} seconds`);
      console.log(`      Enabled: ${pattern.enabled ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Test pattern matching
    console.log('🔍 Testing pattern matching...');
    scanner.testPatternMatching();

    // Test scanner status
    console.log('📊 Scanner Status:');
    const status = scanner.getStatus();
    console.log(`   Running: ${status.isRunning}`);
    console.log(`   Patterns: ${status.patternsCount}`);
    console.log(`   Scan Interval: ${status.scanInterval}ms`);
    console.log(`   Last Block: ${status.lastProcessedBlock}`);
    console.log('');

    // Test pattern performance
    console.log('📈 Pattern Performance:');
    const performance = scanner.getPatternPerformance();
    if (performance.length > 0) {
      performance.forEach((perf, index) => {
        console.log(`   ${index + 1}. ${perf.patternName}`);
        console.log(`      Matches: ${perf.matches}`);
        console.log(`      Trades: ${perf.trades}`);
        console.log(`      Success Rate: ${perf.successRate.toFixed(1)}%`);
        console.log(`      Avg Profit: ${perf.avgProfit.toFixed(4)} BNB`);
        console.log('');
      });
    } else {
      console.log('   No performance data available yet');
    }

    // Test simulation
    console.log('🧪 Testing token creation simulation...');
    scanner.simulateTokenCreation(
      '0x' + Math.random().toString(16).substr(2, 40),
      '0x' + Math.random().toString(16).substr(2, 40),
      8.5, // Gas price in gwei
      2500000, // Gas limit
      0.2 // Transaction value in BNB
    );

    console.log('\n✅ All pattern scanner tests completed successfully!');
    console.log('\n📝 To run the live scanner:');
    console.log('   1. Update .env file with your BOT_TOKEN and ENCRYPTION_KEY');
    console.log('   2. Run: node pattern-scanner-example.js');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPatternScanner().catch(console.error);

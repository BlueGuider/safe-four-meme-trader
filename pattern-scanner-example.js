const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');

/**
 * Example usage of Pattern-Based Token Scanner
 * This script shows how to use the gas pattern analysis system
 */

async function runPatternScanner() {
  console.log('🚀 Pattern-Based Token Scanner Example\n');

  try {
    // Create scanner instance
    const scanner = new PatternBasedScanner();

    // Display loaded patterns
    const patterns = scanner.getPatterns();
    console.log('📋 Loaded Trading Patterns:');
    patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern.name}`);
      console.log(`      ID: ${pattern.id}`);
      console.log(`      Gas Price: ${pattern.gasPrice.min}-${pattern.gasPrice.max} ${pattern.gasPrice.unit}`);
      console.log(`      Gas Limit: ${pattern.gasLimit.min.toLocaleString()}-${pattern.gasLimit.max.toLocaleString()}`);
      console.log(`      Buy Amount: ${pattern.trading.buyAmount} BNB`);
      console.log(`      Hold Time: ${pattern.trading.holdTimeSeconds} seconds`);
      console.log(`      Priority: ${pattern.priority}`);
      console.log(`      Enabled: ${pattern.enabled ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Display scanner configuration
    const status = scanner.getStatus();
    console.log('⚙️  Scanner Configuration:');
    console.log(`   Target Contract: 0x5c952063c7fc8610ffdb798152d69f0b9550762b (Four.meme V2)`);
    console.log(`   Scan Interval: ${status.scanInterval}ms (fast mode)`);
    console.log(`   Patterns Loaded: ${status.patternsCount}`);
    console.log(`   Last Processed Block: ${status.lastProcessedBlock}`);
    console.log('');

    // Start monitoring
    console.log('🚀 Starting pattern-based token monitoring...');
    console.log('📡 The scanner will now analyze gas patterns in real-time');
    console.log('🎯 When a token creation matches a pattern, the bot will:');
    console.log('   1. Analyze gas price and gas limit patterns');
    console.log('   2. Calculate confidence score for each pattern');
    console.log('   3. Select the best matching pattern');
    console.log('   4. Execute trading based on pattern settings');
    console.log('   5. Monitor and track pattern performance');
    console.log('');

    await scanner.startScanning();

    // Keep the process running
    console.log('✅ Pattern-based scanner is now running! Press Ctrl+C to stop.');
    
    // Display periodic status updates
    setInterval(() => {
      const performance = scanner.getPatternPerformance();
      if (performance.length > 0) {
        console.log('\n📈 Pattern Performance Update:');
        performance.slice(0, 3).forEach((perf, index) => {
          console.log(`   ${index + 1}. ${perf.patternName}: ${perf.matches} matches, ${perf.trades} trades (${perf.successRate.toFixed(1)}% success)`);
        });
      }
    }, 30000); // Every 30 seconds

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down pattern-based scanner...');
      await scanner.stopScanning();
      
      // Display final statistics
      console.log('\n📊 Final Pattern Statistics:');
      const finalPerformance = scanner.getPatternPerformance();
      finalPerformance.forEach((perf, index) => {
        console.log(`   ${index + 1}. ${perf.patternName}`);
        console.log(`      Matches: ${perf.matches}`);
        console.log(`      Trades: ${perf.trades}`);
        console.log(`      Success Rate: ${perf.successRate.toFixed(1)}%`);
        console.log(`      Avg Profit: ${perf.avgProfit.toFixed(4)} BNB`);
      });
      
      console.log('✅ Pattern-based scanner stopped successfully');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
runPatternScanner().catch(console.error);

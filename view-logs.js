const { DailyLogger } = require('./dist/services/dailyLogger');
const fs = require('fs');
const path = require('path');

/**
 * Simple Log Viewer
 * 
 * Quick way to view today's logs in a readable format
 */

function viewTodayLogs() {
  console.log('📊 Today\'s Trading Logs');
  console.log('========================\n');

  const trades = DailyLogger.getTodayTrades();
  const unmatchedPatterns = DailyLogger.getTodayUnmatchedPatterns();

  if (trades.length === 0 && unmatchedPatterns.length === 0) {
    console.log('No logs found for today.');
    return;
  }

  // Show trades
  if (trades.length > 0) {
    console.log('💰 TRADES:');
    console.log('==========');
    trades.forEach((trade, index) => {
      console.log(`\n${index + 1}. ${trade.type}`);
      console.log(`   Token: ${trade.tokenAddress}`);
      console.log(`   Pattern: ${trade.pattern}`);
      console.log(`   Amount: ${trade.buyAmount} BNB`);
      console.log(`   Gas Price: ${trade.gasPrice} gwei`);
      console.log(`   Gas Limit: ${trade.gasLimit.toLocaleString()}`);
      console.log(`   TX Value: ${trade.transactionValue} BNB`);
      console.log(`   Result: ${trade.tradeResult ? '✅ SUCCESS' : '❌ FAILED'}`);
      if (trade.tradeTxHash) {
        console.log(`   TX Hash: ${trade.tradeTxHash}`);
      }
      if (trade.error) {
        console.log(`   Error: ${trade.error}`);
      }
      console.log(`   Time: ${new Date(trade.timestamp).toLocaleString()}`);
    });
  }

  // Show unmatched patterns
  if (unmatchedPatterns.length > 0) {
    console.log('\n\n📊 UNMATCHED PATTERNS:');
    console.log('======================');
    unmatchedPatterns.forEach((pattern, index) => {
      console.log(`\n${index + 1}. Token: ${pattern.tokenAddress}`);
      console.log(`   Gas Price: ${pattern.gasPrice} gwei`);
      console.log(`   Gas Limit: ${pattern.gasLimit.toLocaleString()}`);
      console.log(`   TX Value: ${pattern.transactionValue} BNB`);
      console.log(`   Reason: ${pattern.reason}`);
      console.log(`   Time: ${new Date(pattern.timestamp).toLocaleString()}`);
    });
  }

  // Show summary
  const stats = DailyLogger.getTodayStats();
  console.log('\n\n📈 SUMMARY:');
  console.log('============');
  console.log(`Total trades: ${stats.totalTrades}`);
  console.log(`Successful: ${stats.successfulTrades}`);
  console.log(`Failed: ${stats.failedTrades}`);
  console.log(`Simulated: ${stats.simulatedTrades}`);
  console.log(`Unmatched patterns: ${stats.totalUnmatchedPatterns}`);
  console.log(`Total volume: ${stats.totalVolume.toFixed(6)} BNB`);
}

// Run the viewer
if (require.main === module) {
  viewTodayLogs();
}

module.exports = { viewTodayLogs };

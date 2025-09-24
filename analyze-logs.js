const { DailyLogger } = require('./dist/services/dailyLogger');
const fs = require('fs');
const path = require('path');

/**
 * Log Analysis Tool
 * 
 * This script helps you analyze the daily logs to:
 * - Review trading performance
 * - Analyze unmatched patterns
 * - Identify new pattern opportunities
 * - Generate reports
 */

class LogAnalyzer {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.tradesDir = path.join(this.logsDir, 'trades');
    this.patternsDir = path.join(this.logsDir, 'patterns');
  }

  /**
   * Analyze today's logs
   */
  analyzeToday() {
    console.log('📊 Today\'s Log Analysis');
    console.log('========================\n');

    const trades = DailyLogger.getTodayTrades();
    const unmatchedPatterns = DailyLogger.getTodayUnmatchedPatterns();
    const stats = DailyLogger.getTodayStats();

    // Trading analysis
    console.log('💰 TRADING ANALYSIS');
    console.log('==================');
    console.log(`Total trades: ${stats.totalTrades}`);
    console.log(`Successful: ${stats.successfulTrades}`);
    console.log(`Failed: ${stats.failedTrades}`);
    console.log(`Simulated: ${stats.simulatedTrades}`);
    console.log(`Total volume: ${stats.totalVolume.toFixed(6)} BNB`);
    console.log(`Success rate: ${stats.totalTrades > 0 ? ((stats.successfulTrades / stats.totalTrades) * 100).toFixed(1) : 0}%\n`);

    // Pattern analysis
    console.log('📈 PATTERN ANALYSIS');
    console.log('==================');
    console.log(`Unmatched patterns: ${stats.totalUnmatchedPatterns}`);
    
    if (unmatchedPatterns.length > 0) {
      this.analyzeUnmatchedPatterns(unmatchedPatterns);
    }

    // Recent trades
    if (trades.length > 0) {
      console.log('\n🔄 RECENT TRADES');
      console.log('================');
      const recentTrades = trades.slice(-5); // Last 5 trades
      recentTrades.forEach((trade, index) => {
        console.log(`${index + 1}. ${trade.type} - ${trade.tokenAddress.slice(0, 8)}...`);
        console.log(`   Pattern: ${trade.pattern}`);
        console.log(`   Amount: ${trade.buyAmount} BNB`);
        console.log(`   Result: ${trade.tradeResult ? 'SUCCESS' : 'FAILED'}`);
        console.log(`   Time: ${new Date(trade.timestamp).toLocaleTimeString()}\n`);
      });
    }
  }

  /**
   * Analyze unmatched patterns
   */
  analyzeUnmatchedPatterns(unmatchedPatterns) {
    console.log('\n🔍 UNMATCHED PATTERN ANALYSIS');
    console.log('==============================');

    // Group by reason
    const reasons = {};
    unmatchedPatterns.forEach(pattern => {
      if (!reasons[pattern.reason]) {
        reasons[pattern.reason] = [];
      }
      reasons[pattern.reason].push(pattern);
    });

    Object.entries(reasons).forEach(([reason, patterns]) => {
      console.log(`\n📊 ${reason}: ${patterns.length} occurrences`);
      
      // Show gas price distribution
      const gasPrices = patterns.map(p => p.gasPrice).sort((a, b) => a - b);
      const minGas = gasPrices[0];
      const maxGas = gasPrices[gasPrices.length - 1];
      const avgGas = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
      
      console.log(`   Gas Price: ${minGas.toFixed(2)} - ${maxGas.toFixed(2)} gwei (avg: ${avgGas.toFixed(2)})`);
      
      // Show gas limit distribution
      const gasLimits = patterns.map(p => p.gasLimit).sort((a, b) => a - b);
      const minLimit = gasLimits[0];
      const maxLimit = gasLimits[gasLimits.length - 1];
      const avgLimit = gasLimits.reduce((sum, limit) => sum + limit, 0) / gasLimits.length;
      
      console.log(`   Gas Limit: ${minLimit.toLocaleString()} - ${maxLimit.toLocaleString()} (avg: ${avgLimit.toLocaleString()})`);
      
      // Show transaction value distribution
      const txValues = patterns.map(p => p.transactionValue).sort((a, b) => a - b);
      const minValue = txValues[0];
      const maxValue = txValues[txValues.length - 1];
      const avgValue = txValues.reduce((sum, value) => sum + value, 0) / txValues.length;
      
      console.log(`   TX Value: ${minValue.toFixed(6)} - ${maxValue.toFixed(6)} BNB (avg: ${avgValue.toFixed(6)})`);
    });

    // Suggest new patterns
    this.suggestNewPatterns(unmatchedPatterns);
  }

  /**
   * Suggest new patterns based on unmatched data
   */
  suggestNewPatterns(unmatchedPatterns) {
    if (unmatchedPatterns.length < 5) {
      console.log('\n💡 Not enough data to suggest new patterns (need at least 5 unmatched patterns)');
      return;
    }

    console.log('\n💡 SUGGESTED NEW PATTERNS');
    console.log('==========================');

    // Analyze gas price patterns
    const gasPrices = unmatchedPatterns.map(p => p.gasPrice).sort((a, b) => a - b);
    const gasPriceRanges = this.findCommonRanges(gasPrices, 0.1);
    
    if (gasPriceRanges.length > 0) {
      console.log('\n⛽ Gas Price Patterns:');
      gasPriceRanges.forEach((range, index) => {
        console.log(`   Pattern ${index + 1}: ${range.min.toFixed(2)} - ${range.max.toFixed(2)} gwei (${range.count} occurrences)`);
      });
    }

    // Analyze gas limit patterns
    const gasLimits = unmatchedPatterns.map(p => p.gasLimit).sort((a, b) => a - b);
    const gasLimitRanges = this.findCommonRanges(gasLimits, 100000);
    
    if (gasLimitRanges.length > 0) {
      console.log('\n⛽ Gas Limit Patterns:');
      gasLimitRanges.forEach((range, index) => {
        console.log(`   Pattern ${index + 1}: ${range.min.toLocaleString()} - ${range.max.toLocaleString()} (${range.count} occurrences)`);
      });
    }

    // Analyze transaction value patterns
    const txValues = unmatchedPatterns.map(p => p.transactionValue).sort((a, b) => a - b);
    const txValueRanges = this.findCommonRanges(txValues, 0.01);
    
    if (txValueRanges.length > 0) {
      console.log('\n💰 Transaction Value Patterns:');
      txValueRanges.forEach((range, index) => {
        console.log(`   Pattern ${index + 1}: ${range.min.toFixed(6)} - ${range.max.toFixed(6)} BNB (${range.count} occurrences)`);
      });
    }
  }

  /**
   * Find common ranges in data
   */
  findCommonRanges(data, tolerance) {
    const ranges = [];
    let currentRange = { min: data[0], max: data[0], count: 1 };
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] - currentRange.max <= tolerance) {
        currentRange.max = data[i];
        currentRange.count++;
      } else {
        if (currentRange.count >= 3) { // Only include ranges with 3+ occurrences
          ranges.push(currentRange);
        }
        currentRange = { min: data[i], max: data[i], count: 1 };
      }
    }
    
    if (currentRange.count >= 3) {
      ranges.push(currentRange);
    }
    
    return ranges;
  }

  /**
   * Generate pattern JSON for new patterns
   */
  generatePatternJSON(unmatchedPatterns) {
    console.log('\n📝 GENERATED PATTERN JSON');
    console.log('=========================');

    const gasPrices = unmatchedPatterns.map(p => p.gasPrice).sort((a, b) => a - b);
    const gasLimits = unmatchedPatterns.map(p => p.gasLimit).sort((a, b) => a - b);
    const txValues = unmatchedPatterns.map(p => p.transactionValue).sort((a, b) => a - b);

    const suggestedPattern = {
      id: `suggested_pattern_${new Date().toISOString().split('T')[0]}`,
      name: `Suggested Pattern ${new Date().toLocaleDateString()}`,
      description: `Auto-generated pattern based on ${unmatchedPatterns.length} unmatched patterns`,
      enabled: false,
      priority: 2,
      gasPrice: {
        min: Math.max(0.01, gasPrices[Math.floor(gasPrices.length * 0.1)]),
        max: gasPrices[Math.floor(gasPrices.length * 0.9)],
        unit: "gwei"
      },
      gasLimit: {
        min: Math.max(1000000, gasLimits[Math.floor(gasLimits.length * 0.1)]),
        max: gasLimits[Math.floor(gasLimits.length * 0.9)]
      },
      trading: {
        buyAmount: 0.001,
        holdTimeSeconds: 20,
        maxSlippage: 5.0,
        stopLossPercent: 10.0,
        takeProfitPercent: 40.0
      },
      filters: {
        minTransactionValue: Math.max(0.001, txValues[Math.floor(txValues.length * 0.1)]),
        maxTransactionValue: txValues[Math.floor(txValues.length * 0.9)],
        requiredConfirmations: 1
      }
    };

    console.log(JSON.stringify(suggestedPattern, null, 2));
    console.log('\n💡 Copy this pattern to your patterns.json file to test it!');
  }

  /**
   * List available log files
   */
  listLogFiles() {
    console.log('📁 Available Log Files');
    console.log('======================\n');

    // List trade logs
    if (fs.existsSync(this.tradesDir)) {
      const tradeFiles = fs.readdirSync(this.tradesDir).filter(f => f.endsWith('.json')).sort();
      console.log('💰 Trade Logs:');
      tradeFiles.forEach(file => {
        const filePath = path.join(this.tradesDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`   ${file} (${size} KB)`);
      });
    }

    // List pattern logs
    if (fs.existsSync(this.patternsDir)) {
      const patternFiles = fs.readdirSync(this.patternsDir).filter(f => f.endsWith('.json')).sort();
      console.log('\n📊 Pattern Logs:');
      patternFiles.forEach(file => {
        const filePath = path.join(this.patternsDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`   ${file} (${size} KB)`);
      });
    }
  }
}

// Main execution
async function main() {
  const analyzer = new LogAnalyzer();
  const command = process.argv[2] || 'today';

  switch (command) {
    case 'today':
      analyzer.analyzeToday();
      break;
    case 'list':
      analyzer.listLogFiles();
      break;
    case 'suggest':
      const unmatchedPatterns = DailyLogger.getTodayUnmatchedPatterns();
      if (unmatchedPatterns.length > 0) {
        analyzer.generatePatternJSON(unmatchedPatterns);
      } else {
        console.log('No unmatched patterns found for today.');
      }
      break;
    default:
      console.log('Usage: node analyze-logs.js [today|list|suggest]');
      console.log('  today   - Analyze today\'s logs (default)');
      console.log('  list    - List available log files');
      console.log('  suggest - Generate new pattern suggestions');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LogAnalyzer };

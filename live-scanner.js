const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');
const { TradingService } = require('./dist/services/trading');
const { DailyLogger } = require('./dist/services/dailyLogger');
const { publicClient } = require('./dist/utils/web3');
const fs = require('fs');
const path = require('path');

/**
 * Live Pattern Scanner with Configuration Support
 * 
 * This script runs the pattern-based scanner in real-time with configurable settings.
 * It can run in test mode (simulation only) or live mode (real trading).
 */

class LiveScanner {
  constructor(configPath = './live-scanner-config.json') {
    this.config = this.loadConfig(configPath);
    this.scanner = new PatternBasedScanner();
    this.isRunning = false;
    this.lastProcessedBlock = null;
    this.retryCount = 0;
    this.tradeCount = 0;
    this.matchCount = 0;
    this.startTime = new Date();
    this.lastStatusTime = this.startTime.getTime();
    this.tradesThisHour = 0;
    this.tradesThisDay = 0;
    this.lastHourReset = this.startTime.getTime();
    this.lastDayReset = this.startTime.getTime();
    
    // Initialize daily logger
    DailyLogger.initialize();
  }

  /**
   * Load configuration from file
   */
  loadConfig(configPath) {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      } else {
        console.log('⚠️ Config file not found, using default settings');
        return this.getDefaultConfig();
      }
    } catch (error) {
      console.error('❌ Error loading config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      scanner: {
        scanInterval: 5000,
        maxRetries: 3,
        fourMemeContract: '0x5c952063c7fc8610ffdb798152d69f0b9550762b'
      },
      trading: {
        enabled: false,
        testMode: true,
        maxBuyAmount: 0.01,
        maxSlippage: 5.0
      },
      notifications: {
        enabled: true,
        console: {
          enabled: true,
          logLevel: 'info'
        }
      },
      patterns: {
        autoReload: true,
        reloadInterval: 30000
      },
      safety: {
        maxTradesPerHour: 10,
        maxTradesPerDay: 50,
        emergencyStop: false
      }
    };
  }

  /**
   * Start the live scanner
   */
  async start() {
    const mode = this.config.trading.testMode ? 'TEST MODE' : 'LIVE MODE';
    const tradingStatus = this.config.trading.enabled ? 'ENABLED' : 'DISABLED';
    
    console.log('🚀 Starting Live Pattern Scanner');
    console.log('=================================');
    console.log(`📊 Mode: ${mode}`);
    console.log(`💰 Trading: ${tradingStatus}`);
    console.log(`⏰ Scan interval: ${this.config.scanner.scanInterval}ms`);
    console.log(`🛡️ Safety limits: ${this.config.safety.maxTradesPerHour}/hour, ${this.config.safety.maxTradesPerDay}/day\n`);

    try {
      // Initialize scanner
      await this.scanner.startScanning();
      console.log('✅ Pattern scanner initialized');
      
      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();
      this.lastProcessedBlock = Number(currentBlock) - 1;
      
      console.log(`📍 Starting from block: ${this.lastProcessedBlock}`);
      console.log(`🎯 Monitoring four.meme contract: ${this.config.scanner.fourMemeContract}`);
      
      if (this.config.trading.testMode) {
        console.log('⚠️  NO REAL TRADES WILL BE EXECUTED (Test Mode)');
      } else if (this.config.trading.enabled) {
        console.log('💰 REAL TRADING ENABLED - USE WITH CAUTION!');
      } else {
        console.log('📊 Trading disabled - monitoring only');
      }
      console.log('');

      this.isRunning = true;
      this.startScanning();
      
    } catch (error) {
      console.error('❌ Failed to start live scanner:', error);
      throw error;
    }
  }

  /**
   * Start the scanning loop
   */
  startScanning() {
    if (!this.isRunning) return;

    this.scanForNewBlocks()
      .then(() => {
        // Schedule next scan
        setTimeout(() => this.startScanning(), this.config.scanner.scanInterval);
      })
      .catch((error) => {
        console.error('❌ Error in scanning loop:', error);
        this.handleError(error);
      });
  }

  /**
   * Scan for new blocks and process token creations
   */
  async scanForNewBlocks() {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const currentBlockNumber = Number(currentBlock);

      if (currentBlockNumber > this.lastProcessedBlock) {
        // console.log(`🔍 Scanning blocks ${this.lastProcessedBlock + 1} to ${currentBlockNumber}`);
        
        // Process each new block
        for (let blockNum = this.lastProcessedBlock + 1; blockNum <= currentBlockNumber; blockNum++) {
          await this.processBlock(blockNum);
        }
        
        this.lastProcessedBlock = currentBlockNumber;
        this.retryCount = 0;
      } else {
        // Show status periodically
        const now = new Date();
        if (now.getTime() - this.lastStatusTime > 30000) {
          this.showStatus();
          this.lastStatusTime = now.getTime();
        }
      }

      // Check safety limits
      this.checkSafetyLimits();
      
    } catch (error) {
      console.error('❌ Error scanning blocks:', error);
      throw error;
    }
  }

  /**
   * Process a single block for token creations
   */
  async processBlock(blockNumber) {
    try {
      const block = await publicClient.getBlock({
        blockNumber: BigInt(blockNumber),
        includeTransactions: true
      });

    //   console.log(`📦 Block ${blockNumber}: ${block.transactions.length} transactions`);

      let fourMemeTransactions = 0;
      let tokenCreations = 0;

      // Process each transaction in the block
      for (const tx of block.transactions) {
        try {
          // Check if this transaction is TO the four.meme contract
          if (tx.to && tx.to.toLowerCase() === this.config.scanner.fourMemeContract.toLowerCase()) {
            fourMemeTransactions++;
            
            // Check if this is a createToken function call
            const isCreateTokenCall = await this.isCreateTokenFunction(tx);
            if (isCreateTokenCall) {
              tokenCreations++;
              console.log(`🎯 Token creation detected in block ${blockNumber}: ${tx.hash}`);
              
              // Process the token creation
              await this.processTokenCreation(tx, blockNumber);
            }
          }
        } catch (error) {
          console.error(`⚠️ Error processing transaction ${tx.hash}:`, error);
        }
      }

      if (fourMemeTransactions > 0) {
        console.log(`   📊 Four.meme transactions: ${fourMemeTransactions}, Token creations: ${tokenCreations}`);
      }

    } catch (error) {
      console.error(`❌ Error processing block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Process a token creation transaction
   */
  async processTokenCreation(tx, blockNumber) {
    try {
      // Extract token address
      const tokenAddress = await this.scanner.extractTokenAddressFromLogs(tx);
      if (!tokenAddress) {
        console.log(`   ⚠️ Could not extract token address from ${tx.hash}`);
        return;
      }

      console.log(`   ✅ Token address: ${tokenAddress}`);

      // Calculate gas metrics
      const gasPriceGwei = Number(tx.gasPrice) / 1e9;
      const gasLimit = Number(tx.gas);
      const transactionValue = Number(tx.value) / 1e18;

      console.log(`   ⛽ Gas Price: ${gasPriceGwei.toFixed(2)} gwei`);
      console.log(`   ⛽ Gas Limit: ${gasLimit.toLocaleString()}`);
      console.log(`   💰 TX Value: ${transactionValue.toFixed(6)} BNB`);

      // Create token creation event for pattern analysis
      const tokenCreation = {
        tokenAddress: tokenAddress,
        creatorAddress: tx.from,
        blockNumber: blockNumber,
        transactionHash: tx.hash,
        timestamp: new Date(),
        gasPrice: gasPriceGwei,
        gasLimit: gasLimit,
        transactionValue: transactionValue
      };

      // Check for pattern matches
      const matches = await this.scanner.findMatchingPatterns(tokenCreation);
      
      if (matches.length > 0) {
        this.matchCount++;
        const bestMatch = matches[0];
        
        console.log(`   🎯 PATTERN MATCHED: ${bestMatch.pattern.name}`);
        console.log(`   📊 Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`);
        console.log(`   💰 Would buy: ${bestMatch.pattern.trading.buyAmount} BNB`);
        console.log(`   ⏰ Would hold: ${bestMatch.pattern.trading.holdTimeSeconds} seconds`);

        // Execute or simulate the trade
        if (this.config.trading.enabled && !this.config.trading.testMode) {
          await this.executeTrade(tokenCreation, bestMatch);
        } else {
          await this.simulateTrade(tokenCreation, bestMatch);
        }
      } else {
        console.log(`   ❌ No patterns matched`);
        
        // Log unmatched pattern for analysis
        this.logUnmatchedPattern(tokenCreation);
      }

    } catch (error) {
      console.error(`❌ Error processing token creation ${tx.hash}:`, error);
    }
  }

  /**
   * Execute a real trade
   */
  async executeTrade(tokenCreation, match) {
    try {
      // Check safety limits
      if (!this.canExecuteTrade()) {
        console.log(`   🛡️ Trade blocked by safety limits`);
        return;
      }

      console.log(`   🚀 EXECUTING REAL TRADE for ${tokenCreation.tokenAddress}`);
      
      const { pattern } = match;
      const buyAmount = Math.min(pattern.trading.buyAmount, this.config.trading.maxBuyAmount);
      const userId = this.config.trading.userId || 'copy-trading-bot';
      
      console.log(`   💰 Buying ${buyAmount} BNB worth of ${tokenCreation.tokenAddress}`);
      
      // Execute the buy order
      const result = await TradingService.buyTokens(
        tokenCreation.tokenAddress,
        buyAmount,
        userId
      );

      if (result.success) {
        this.tradeCount++;
        this.tradesThisHour++;
        this.tradesThisDay++;
        console.log(`   ✅ TRADE EXECUTED SUCCESSFULLY!`);
        console.log(`   📝 Transaction Hash: ${result.data.txHash}`);
        console.log(`   📊 Success Count: ${result.data.successCount}/${result.data.totalWallets}`);
        
        // Log to daily file
        DailyLogger.logTrade({
          type: 'TRADE_EXECUTED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: match.pattern.name,
          confidence: match.confidence,
          buyAmount: match.pattern.trading.buyAmount,
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: true,
          tradeTxHash: result.data.txHash,
          successCount: result.data.successCount,
          totalWallets: result.data.totalWallets
        });
        
      } else {
        console.log(`   ❌ TRADE FAILED: ${result.error}`);
        
        // Log failed trade
        DailyLogger.logTrade({
          type: 'TRADE_FAILED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: match.pattern.name,
          confidence: match.confidence,
          buyAmount: match.pattern.trading.buyAmount,
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error(`❌ Error executing trade:`, error);
    }
  }

  /**
   * Simulate a trade (TEST MODE)
   */
  async simulateTrade(tokenCreation, match) {
    try {
      console.log(`   🧪 SIMULATING TRADE for ${tokenCreation.tokenAddress}`);
      
      const { pattern } = match;
      const buyAmount = Math.min(pattern.trading.buyAmount, this.config.trading.maxBuyAmount);
      
      console.log(`   💰 Would buy ${buyAmount} BNB worth of ${tokenCreation.tokenAddress}`);
      console.log(`   🛡️ Stop loss: ${pattern.trading.stopLossPercent}%`);
      console.log(`   🎯 Take profit: ${pattern.trading.takeProfitPercent}%`);
      console.log(`   ⏰ Hold time: ${pattern.trading.holdTimeSeconds} seconds`);
      
      // Simulate trade execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.tradeCount++;
      console.log(`   ✅ TRADE SIMULATION COMPLETED!`);
      
      // Log simulated trade
      DailyLogger.logTrade({
        type: 'TRADE_SIMULATED',
        blockNumber: tokenCreation.blockNumber,
        tokenAddress: tokenCreation.tokenAddress,
        creatorAddress: tokenCreation.creatorAddress,
        transactionHash: tokenCreation.transactionHash,
        pattern: match.pattern.name,
        confidence: match.confidence,
        buyAmount: match.pattern.trading.buyAmount,
        gasPrice: tokenCreation.gasPrice,
        gasLimit: tokenCreation.gasLimit,
        transactionValue: tokenCreation.transactionValue,
        tradeResult: true,
        tradeTxHash: 'SIMULATED'
      });
      
    } catch (error) {
      console.error(`❌ Error simulating trade:`, error);
    }
  }

  /**
   * Check if trade can be executed based on safety limits
   */
  canExecuteTrade() {
    if (this.config.safety.emergencyStop) {
      console.log(`   🛑 Emergency stop activated`);
      return false;
    }

    if (this.tradesThisHour >= this.config.safety.maxTradesPerHour) {
      console.log(`   🛡️ Hourly trade limit reached: ${this.tradesThisHour}/${this.config.safety.maxTradesPerHour}`);
      return false;
    }

    if (this.tradesThisDay >= this.config.safety.maxTradesPerDay) {
      console.log(`   🛡️ Daily trade limit reached: ${this.tradesThisDay}/${this.config.safety.maxTradesPerDay}`);
      return false;
    }

    return true;
  }

  /**
   * Check and reset safety limits
   */
  checkSafetyLimits() {
    const now = new Date().getTime();
    
    // Reset hourly counter
    if (now - this.lastHourReset > 3600000) { // 1 hour
      this.tradesThisHour = 0;
      this.lastHourReset = now;
    }
    
    // Reset daily counter
    if (now - this.lastDayReset > 86400000) { // 24 hours
      this.tradesThisDay = 0;
      this.lastDayReset = now;
    }
  }

  /**
   * Log unmatched pattern for analysis
   */
  logUnmatchedPattern(tokenCreation) {
    try {
      // Load current patterns to analyze why it didn't match
      const patterns = this.scanner.getPatterns();
      const currentPattern = patterns[0]; // Use the first pattern for analysis
      
      if (currentPattern) {
        const gasPriceInGwei = tokenCreation.gasPrice;
        const gasPriceMatch = gasPriceInGwei >= currentPattern.gasPrice.min && gasPriceInGwei <= currentPattern.gasPrice.max;
        const gasLimitMatch = tokenCreation.gasLimit >= currentPattern.gasLimit.min && tokenCreation.gasLimit <= currentPattern.gasLimit.max;
        const transactionValueMatch = tokenCreation.transactionValue >= currentPattern.filters.minTransactionValue && 
                                     tokenCreation.transactionValue <= currentPattern.filters.maxTransactionValue;
        
        let reason = 'No patterns matched';
        if (!gasPriceMatch) reason = `Gas price ${gasPriceInGwei} gwei outside range ${currentPattern.gasPrice.min}-${currentPattern.gasPrice.max}`;
        else if (!gasLimitMatch) reason = `Gas limit ${tokenCreation.gasLimit} outside range ${currentPattern.gasLimit.min}-${currentPattern.gasLimit.max}`;
        else if (!transactionValueMatch) reason = `Transaction value ${tokenCreation.transactionValue} BNB outside range ${currentPattern.filters.minTransactionValue}-${currentPattern.filters.maxTransactionValue}`;
        
        DailyLogger.logUnmatchedPattern({
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          reason: reason,
          patternAnalysis: {
            gasPriceMatch,
            gasLimitMatch,
            transactionValueMatch,
            gasPriceRange: currentPattern.gasPrice,
            gasLimitRange: currentPattern.gasLimit,
            transactionValueRange: currentPattern.filters
          }
        });
      }
    } catch (error) {
      console.error('Error logging unmatched pattern:', error);
    }
  }

  /**
   * Check if transaction is a createToken function call
   */
  async isCreateTokenFunction(tx) {
    try {
      if (!tx.input || tx.input === '0x') {
        return false;
      }

      // Check for createToken function signature (0x519ebb10)
      const createTokenSignature = '0x519ebb10';
      return tx.input.startsWith(createTokenSignature);
    } catch (error) {
      console.error('⚠️ Error checking createToken function:', error);
      return false;
    }
  }

  /**
   * Show current status
   */
  showStatus() {
    const uptime = Math.floor((new Date() - this.startTime) / 1000);
    const todayStats = DailyLogger.getTodayStats();
    
    console.log(`\n📊 Live Scanner Status (${uptime}s uptime)`);
    console.log(`   🎯 Pattern matches: ${this.matchCount}`);
    console.log(`   💰 Trades executed: ${this.tradeCount}`);
    console.log(`   📦 Last processed block: ${this.lastProcessedBlock}`);
    console.log(`   🛡️ Safety: ${this.tradesThisHour}/${this.config.safety.maxTradesPerHour} hour, ${this.tradesThisDay}/${this.config.safety.maxTradesPerDay} day`);
    console.log(`   ⏰ Next scan in ${this.config.scanner.scanInterval/1000}s`);
    
    console.log(`\n📈 Today's Statistics:`);
    console.log(`   💰 Total trades: ${todayStats.totalTrades}`);
    console.log(`   ✅ Successful: ${todayStats.successfulTrades}`);
    console.log(`   ❌ Failed: ${todayStats.failedTrades}`);
    console.log(`   🧪 Simulated: ${todayStats.simulatedTrades}`);
    console.log(`   📊 Unmatched patterns: ${todayStats.totalUnmatchedPatterns}`);
    console.log(`   💵 Total volume: ${todayStats.totalVolume.toFixed(6)} BNB\n`);
  }

  /**
   * Handle errors with retry logic
   */
  handleError(error) {
    this.retryCount++;
    
    if (this.retryCount < this.config.scanner.maxRetries) {
      console.log(`⚠️ Error occurred, retrying in ${this.config.scanner.scanInterval * 2}ms (attempt ${this.retryCount}/${this.config.scanner.maxRetries})`);
      setTimeout(() => this.startScanning(), this.config.scanner.scanInterval * 2);
    } else {
      console.error('❌ Max retries reached, stopping scanner');
      this.stop();
    }
  }

  /**
   * Stop the live scanner
   */
  stop() {
    console.log('\n🛑 Stopping Live Pattern Scanner...');
    this.isRunning = false;
    this.scanner.stopScanning();
    
    const uptime = Math.floor((new Date() - this.startTime) / 1000);
    console.log(`📊 Final Statistics:`);
    console.log(`   ⏰ Uptime: ${uptime} seconds`);
    console.log(`   🎯 Pattern matches: ${this.matchCount}`);
    console.log(`   💰 Trades executed: ${this.tradeCount}`);
    console.log(`   📦 Last processed block: ${this.lastProcessedBlock}`);
    
    process.exit(0);
  }
}

// Main execution
async function main() {
  const configPath = process.argv[2] || './live-scanner-config.json';
  const scanner = new LiveScanner(configPath);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    scanner.stop();
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    scanner.stop();
  });

  try {
    await scanner.start();
  } catch (error) {
    console.error('❌ Failed to start live scanner:', error);
    process.exit(1);
  }
}

// Run the live scanner
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LiveScanner };
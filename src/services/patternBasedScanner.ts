import { publicClient } from '../utils/web3';
import { ContractService } from './contracts';
import { TradingService } from './trading';
import { DailyLogger } from './dailyLogger';
import { keccak256, toHex } from 'viem';
import fs from 'fs';
import path from 'path';

/**
 * Pattern-based Token Creation Scanner
 * 
 * This service monitors four.meme token creation transactions and analyzes
 * gas patterns to determine which tokens are worth trading based on
 * predefined patterns for different types of creators.
 */

export interface Pattern {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  gasPrice: {
    min: number;
    max: number;
    unit: 'gwei' | 'wei';
  };
  gasLimit: {
    min: number;
    max: number;
  };
  trading: {
    buyAmount: number;
    holdTimeSeconds: number;
    maxSlippage: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
  filters: {
    minTransactionValue: number;
    maxTransactionValue: number;
    requiredConfirmations: number;
  };
}

export interface PatternMatch {
  pattern: Pattern;
  confidence: number;
  gasPriceGwei: number;
  gasLimit: number;
  transactionValue: number;
}

export interface TokenCreationEvent {
  tokenAddress: string;
  creatorAddress: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  tokenName?: string;
  tokenSymbol?: string;
  matchedPattern?: PatternMatch;
  gasPrice: number;
  gasLimit: number;
  transactionValue: number;
}

export class PatternBasedScanner {
  private patterns: Pattern[] = [];
  private lastProcessedBlock: number = 0;
  private scanningInterval: any = null;
  private isRunning: boolean = false;
  private patternStats: Map<string, { matches: number; trades: number; profits: number }> = new Map();
  private readonly FOUR_MEME_CONTRACT = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
  private readonly SCAN_INTERVAL = 500; // 500ms for fast detection
  private readonly MAX_BLOCKS_PER_SCAN = 1;
  private readonly PATTERNS_FILE = path.join(__dirname, '../../patterns.json');

  constructor() {
    console.log('🔧 Pattern-Based Token Scanner initialized');
    console.log('📊 Will analyze gas patterns to select profitable tokens');
    this.loadPatterns();
  }

  /**
   * Load patterns from JSON file
   */
  private loadPatterns(): void {
    try {
      const patternsData = fs.readFileSync(this.PATTERNS_FILE, 'utf8');
      const parsed = JSON.parse(patternsData);
      this.patterns = parsed.patterns.filter((p: Pattern) => p.enabled);
      
      console.log(`📋 Loaded ${this.patterns.length} trading patterns`);
      this.patterns.forEach(pattern => {
        console.log(`   ${pattern.priority}. ${pattern.name} (${pattern.id})`);
        this.patternStats.set(pattern.id, { matches: 0, trades: 0, profits: 0 });
      });
    } catch (error) {
      console.error('❌ Error loading patterns:', error);
      this.patterns = [];
    }
  }

  /**
   * Reload patterns from file
   */
  reloadPatterns(): void {
    console.log('🔄 Reloading patterns...');
    this.loadPatterns();
  }

  /**
   * Start pattern-based scanning
   */
  async startScanning(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Pattern-based scanner is already running');
      return;
    }

    if (this.patterns.length === 0) {
      console.log('⚠️ No patterns configured for monitoring');
      return;
    }

    try {
      console.log('🚀 Starting pattern-based token scanner...');
      console.log(`📊 Monitoring ${this.patterns.length} patterns`);
      console.log(`🎯 Target contract: ${this.FOUR_MEME_CONTRACT}`);
      console.log(`⚡ Scan interval: ${this.SCAN_INTERVAL}ms`);

      // Get the latest block number to start from
      const latestBlock = await publicClient.getBlockNumber();
      this.lastProcessedBlock = Number(latestBlock) - 10;
      console.log(`📍 Starting from block: ${this.lastProcessedBlock}`);

      // Start scanning
      this.startScanningLoop();
      this.isRunning = true;
      console.log('✅ Pattern-based scanner started');

    } catch (error) {
      console.error('❌ Error starting pattern-based scanner:', error);
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Pattern-based scanner is not running');
      return;
    }

    try {
      console.log('🛑 Stopping pattern-based scanner...');

      if (this.scanningInterval) {
        clearInterval(this.scanningInterval);
        this.scanningInterval = null;
      }

      this.isRunning = false;
      console.log('✅ Pattern-based scanner stopped');

    } catch (error) {
      console.error('❌ Error stopping pattern-based scanner:', error);
      throw error;
    }
  }

  /**
   * Start the scanning loop
   */
  private startScanningLoop(): void {
    this.scanningInterval = setInterval(async () => {
      await this.scanForTokenCreations();
    }, this.SCAN_INTERVAL);
  }

  /**
   * Scan for token creation transactions and analyze patterns
   */
  private async scanForTokenCreations(): Promise<void> {
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const currentBlock = Number(latestBlock);

      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(currentBlock, this.lastProcessedBlock + this.MAX_BLOCKS_PER_SCAN);

      // console.log(`🔍 Scanning blocks ${fromBlock} to ${toBlock} for pattern-based token analysis...`);

      // Scan blocks for token creation transactions
      const tokenCreations = await this.scanBlocksForTokenCreations(fromBlock, toBlock);

      // Process each token creation with pattern matching
      for (const tokenCreation of tokenCreations) {
        await this.processTokenCreationWithPatterns(tokenCreation);
      }

      this.lastProcessedBlock = toBlock;

    } catch (error) {
      console.error('❌ Error scanning for token creations:', error);
    }
  }

  /**
   * Scan blocks for token creation transactions
   */
  private async scanBlocksForTokenCreations(fromBlock: number, toBlock: number): Promise<TokenCreationEvent[]> {
    const tokenCreations: TokenCreationEvent[] = [];

    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
      try {
        const blockTokenCreations = await this.scanBlockForTokenCreations(blockNum);
        tokenCreations.push(...blockTokenCreations);
      } catch (error) {
        console.log(`⚠️ Error scanning block ${blockNum}: ${error}`);
      }
    }

    return tokenCreations;
  }

  /**
   * Scan a single block for token creation transactions
   */
  private async scanBlockForTokenCreations(blockNumber: number): Promise<TokenCreationEvent[]> {
    const tokenCreations: TokenCreationEvent[] = [];

    try {
      const block = await publicClient.getBlock({
        blockNumber: BigInt(blockNumber),
        includeTransactions: true
      });

      for (const tx of block.transactions) {
        try {
          // Check if this transaction is TO the four.meme contract
          if (tx.to && tx.to.toLowerCase() === this.FOUR_MEME_CONTRACT.toLowerCase()) {
            const tokenCreation = await this.analyzeFourMemeTransaction(tx, blockNumber);
            if (tokenCreation) {
              tokenCreations.push(tokenCreation);
            }
          }
        } catch (error) {
          console.log(`⚠️ Error analyzing transaction ${tx.hash}: ${error}`);
        }
      }

    } catch (error) {
      console.log(`⚠️ Error getting block ${blockNumber}: ${error}`);
    }

    return tokenCreations;
  }

  /**
   * Analyze a four.meme transaction for token creation
   */
  private async analyzeFourMemeTransaction(tx: any, blockNumber: number): Promise<TokenCreationEvent | null> {
    try {
      // Check if this is a createToken function call
      const isCreateTokenCall = await this.isCreateTokenFunction(tx);
      if (!isCreateTokenCall) {
        return null;
      }

      // Get the created token address from transaction logs
      const tokenAddress = await this.extractTokenAddressFromLogs(tx);
      if (!tokenAddress) {
        return null;
      }

      // Verify this is actually a token contract
      const isTokenContract = await this.verifyTokenContract(tokenAddress);
      if (!isTokenContract) {
        return null;
      }

      // Calculate gas metrics
      const gasPriceGwei = Number(tx.gasPrice) / 1e9; // Convert wei to gwei
      const gasLimit = Number(tx.gas);
      const transactionValue = Number(tx.value) / 1e18; // Convert wei to BNB

      const tokenCreation: TokenCreationEvent = {
        tokenAddress: tokenAddress,
        creatorAddress: tx.from,
        blockNumber,
        transactionHash: tx.hash,
        timestamp: new Date(),
        gasPrice: gasPriceGwei,
        gasLimit: gasLimit,
        transactionValue: transactionValue
      };

      console.log(`🎯 Token creation detected!`);
      console.log(`   Token: ${tokenAddress}`);
      console.log(`   Creator: ${tx.from.slice(0, 8)}...${tx.from.slice(-8)}`);
      console.log(`   Gas Price: ${gasPriceGwei.toFixed(2)} gwei`);
      console.log(`   Gas Limit: ${gasLimit.toLocaleString()}`);
      console.log(`   TX Value: ${transactionValue.toFixed(6)} BNB`);

      return tokenCreation;

    } catch (error) {
      console.log(`⚠️ Error analyzing four.meme transaction: ${error}`);
      return null;
    }
  }

  /**
   * Process token creation with pattern matching
   */
  private async processTokenCreationWithPatterns(tokenCreation: TokenCreationEvent): Promise<void> {
    try {
      // Find matching patterns
      const matches = this.findMatchingPatterns(tokenCreation);
      
      if (matches.length === 0) {
        console.log(`   ❌ No patterns matched for token ${tokenCreation.tokenAddress.slice(0, 8)}...`);
        
        // Log unmatched pattern for analysis
        this.logUnmatchedPattern(tokenCreation);
        return;
      }

      // Sort by priority and confidence
      matches.sort((a, b) => {
        if (a.pattern.priority !== b.pattern.priority) {
          return a.pattern.priority - b.pattern.priority;
        }
        return b.confidence - a.confidence;
      });

      const bestMatch = matches[0];
      tokenCreation.matchedPattern = bestMatch;

      console.log(`   ✅ Pattern matched: ${bestMatch.pattern.name}`);
      console.log(`   📊 Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`);
      console.log(`   💰 Buy amount: ${bestMatch.pattern.trading.buyAmount} BNB`);
      console.log(`   ⏰ Hold time: ${bestMatch.pattern.trading.holdTimeSeconds} seconds`);

      // Update pattern stats
      const stats = this.patternStats.get(bestMatch.pattern.id);
      if (stats) {
        stats.matches++;
        this.patternStats.set(bestMatch.pattern.id, stats);
      }

      // Execute trading based on pattern
      await this.executePatternTrading(tokenCreation, bestMatch);

    } catch (error) {
      console.error(`❌ Error processing token creation with patterns: ${error}`);
    }
  }

  /**
   * Find patterns that match the token creation
   */
  private findMatchingPatterns(tokenCreation: TokenCreationEvent): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      const confidence = this.calculatePatternConfidence(tokenCreation, pattern);
      
      if (confidence === 1.0) { // Perfect match - all requirements met
        matches.push({
          pattern,
          confidence,
          gasPriceGwei: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue
        });
      }
    }

    return matches;
  }

  /**
   * Calculate pattern confidence score - Binary match (1.0 if all requirements met, 0.0 otherwise)
   */
  private calculatePatternConfidence(tokenCreation: TokenCreationEvent, pattern: Pattern): number {
    // Convert gas price to gwei if needed
    const gasPriceInGwei = pattern.gasPrice.unit === 'gwei' ? tokenCreation.gasPrice : tokenCreation.gasPrice / 1e9;
    
    // Check if ALL requirements are met
    const gasPriceMatch = gasPriceInGwei >= pattern.gasPrice.min && gasPriceInGwei <= pattern.gasPrice.max;
    const gasLimitMatch = tokenCreation.gasLimit >= pattern.gasLimit.min && tokenCreation.gasLimit <= pattern.gasLimit.max;
    const transactionValueMatch = tokenCreation.transactionValue >= pattern.filters.minTransactionValue && 
                                 tokenCreation.transactionValue <= pattern.filters.maxTransactionValue;
    
    // Return 1.0 if ALL requirements are met, 0.0 otherwise
    return (gasPriceMatch && gasLimitMatch && transactionValueMatch) ? 1.0 : 0.0;
  }

  /**
   * Execute trading based on matched pattern
   */
  private async executePatternTrading(tokenCreation: TokenCreationEvent, match: PatternMatch): Promise<void> {
    try {
      const pattern = match.pattern;
      
      console.log(`💰 Executing pattern-based trade for ${tokenCreation.tokenAddress.slice(0, 8)}...`);
      console.log(`   Pattern: ${pattern.name}`);
      console.log(`   Buy amount: ${pattern.trading.buyAmount} BNB`);
      console.log(`   Hold time: ${pattern.trading.holdTimeSeconds} seconds`);

      // Get token information
      try {
        const [tokenName, tokenSymbol] = await Promise.allSettled([
          ContractService.getTokenName(tokenCreation.tokenAddress),
          ContractService.getTokenSymbol(tokenCreation.tokenAddress)
        ]);
        
        if (tokenName.status === 'fulfilled') {
          tokenCreation.tokenName = tokenName.value;
        }
        if (tokenSymbol.status === 'fulfilled') {
          tokenCreation.tokenSymbol = tokenSymbol.value;
        }
        
        console.log(`   Name: ${tokenCreation.tokenName || 'Unknown'}`);
        console.log(`   Symbol: ${tokenCreation.tokenSymbol || 'Unknown'}`);
      } catch (error) {
        console.log(`   ⚠️ Could not get token name/symbol: ${error}`);
      }

      // Execute buy transaction
      const buyResult = await TradingService.buyTokens(
        tokenCreation.tokenAddress,
        pattern.trading.buyAmount,
        'copy-trading-bot'
      );

      if (buyResult.success) {
        console.log(`✅ Successfully bought token ${tokenCreation.tokenAddress.slice(0, 8)}...`);
        console.log(`   Amount: ${pattern.trading.buyAmount} BNB`);
        console.log(`   TX: ${buyResult.data?.txHash || 'N/A'}`);

        // Log successful trade
        DailyLogger.logTrade({
          type: 'TRADE_EXECUTED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: pattern.name,
          confidence: 1.0,
          buyAmount: pattern.trading.buyAmount,
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: true,
          tradeTxHash: buyResult.data?.txHash,
          successCount: buyResult.data?.successCount || 1,
          totalWallets: buyResult.data?.totalWallets || 1
        });

        // Update pattern stats
        const stats = this.patternStats.get(pattern.id);
        if (stats) {
          stats.trades++;
          this.patternStats.set(pattern.id, stats);
        }

        // Schedule sell after the specified time
        setTimeout(async () => {
          await this.sellTokenWithPattern(tokenCreation, pattern);
        }, pattern.trading.holdTimeSeconds * 1000);

        // Send notification
        await this.sendPatternNotification(tokenCreation, match, 'BUY', buyResult.data?.txHash);

      } else {
        console.log(`❌ Failed to buy token ${tokenCreation.tokenAddress.slice(0, 8)}...: ${buyResult.error}`);
        
        // Log failed trade
        DailyLogger.logTrade({
          type: 'TRADE_FAILED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: pattern.name,
          confidence: 1.0,
          buyAmount: pattern.trading.buyAmount,
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: false,
          error: buyResult.error
        });
        
        await this.sendPatternNotification(tokenCreation, match, 'BUY_FAILED', undefined, buyResult.error);
      }

    } catch (error) {
      console.error(`❌ Error executing pattern trading: ${error}`);
    }
  }

  /**
   * Sell token based on pattern
   */
  private async sellTokenWithPattern(tokenCreation: TokenCreationEvent, pattern: Pattern): Promise<void> {
    try {
      console.log(`💰 Selling token ${tokenCreation.tokenAddress.slice(0, 8)}... after ${pattern.trading.holdTimeSeconds} seconds`);

      const sellResult = await TradingService.sellTokens(
        tokenCreation.tokenAddress,
        100, // Sell 100% of tokens
        'copy-trading-bot'
      );

      if (sellResult.success) {
        console.log(`✅ Successfully sold token ${tokenCreation.tokenAddress.slice(0, 8)}...`);
        console.log(`   TX: ${sellResult.data?.txHash || 'N/A'}`);

        // Log successful sell
        DailyLogger.logTrade({
          type: 'TRADE_EXECUTED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: pattern.name,
          confidence: 1.0,
          buyAmount: 0, // This is a sell operation
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: true,
          tradeTxHash: sellResult.data?.txHash,
          successCount: sellResult.data?.successCount || 1,
          totalWallets: sellResult.data?.totalWallets || 1
        });

        await this.sendPatternNotification(tokenCreation, { pattern, confidence: 1, gasPriceGwei: 0, gasLimit: 0, transactionValue: 0 }, 'SELL', sellResult.data?.txHash);

      } else {
        console.log(`❌ Failed to sell token ${tokenCreation.tokenAddress.slice(0, 8)}...: ${sellResult.error}`);
        
        // Log failed sell
        DailyLogger.logTrade({
          type: 'TRADE_FAILED',
          blockNumber: tokenCreation.blockNumber,
          tokenAddress: tokenCreation.tokenAddress,
          creatorAddress: tokenCreation.creatorAddress,
          transactionHash: tokenCreation.transactionHash,
          pattern: pattern.name,
          confidence: 1.0,
          buyAmount: 0, // This is a sell operation
          gasPrice: tokenCreation.gasPrice,
          gasLimit: tokenCreation.gasLimit,
          transactionValue: tokenCreation.transactionValue,
          tradeResult: false,
          error: sellResult.error
        });
        
        await this.sendPatternNotification(tokenCreation, { pattern, confidence: 1, gasPriceGwei: 0, gasLimit: 0, transactionValue: 0 }, 'SELL_FAILED', undefined, sellResult.error);
      }

    } catch (error) {
      console.error(`❌ Error selling token: ${error}`);
    }
  }

  /**
   * Check if a transaction is calling the createToken function
   */
  private async isCreateTokenFunction(tx: any): Promise<boolean> {
    try {
      if (!tx.input || tx.input === '0x') {
        return false;
      }

      const createTokenMethodId = '0x519ebb10';
      return tx.input.toLowerCase().startsWith(createTokenMethodId.toLowerCase());
    } catch (error) {
      console.log(`⚠️ Error checking createToken function: ${error}`);
      return false;
    }
  }

  /**
   * Extract the created token address from transaction logs
   * Updated with working extraction method based on actual four.meme contract logs
   */
  public async extractTokenAddressFromLogs(tx: any): Promise<string | null> {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: tx.hash
      });

      if (!receipt || !receipt.logs) {
        return null;
      }

      // Look for logs from four.meme contract
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.FOUR_MEME_CONTRACT.toLowerCase()) {
          // The token address is in the data field, specifically in 32-byte chunks
          // Extract from the second 32-byte chunk and get the last 20 bytes (40 hex chars)
          if (log.data && log.data.length >= 130) { // At least 2 * 32 bytes
            const secondChunk = log.data.slice(66, 130); // 32 bytes = 64 hex chars
            const tokenAddress = '0x' + secondChunk.slice(24); // Last 20 bytes = 40 hex chars
            
            // Validate it's a proper address (not all zeros and proper length)
            if (tokenAddress !== '0x0000000000000000000000000000000000000000' && 
                tokenAddress.length === 42) {
              console.log(`✅ Found token address in data: ${tokenAddress}`);
              return tokenAddress.toLowerCase();
            }
          }
          
          // Also try the first chunk as fallback
          if (log.data && log.data.length >= 66) {
            const firstChunk = log.data.slice(2, 66); // 32 bytes = 64 hex chars
            const tokenAddress = '0x' + firstChunk.slice(24); // Last 20 bytes = 40 hex chars
            
            if (tokenAddress !== '0x0000000000000000000000000000000000000000' && 
                tokenAddress.length === 42) {
              console.log(`✅ Found token address in first chunk: ${tokenAddress}`);
              return tokenAddress.toLowerCase();
            }
          }
        }
      }

      // Fallback: Look for TokenCreate event logs (original method)
      const tokenCreateEventHash = keccak256(toHex('TokenCreate(address,address,uint256,string,string,uint256,uint256)'));
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.FOUR_MEME_CONTRACT.toLowerCase()) {
          if (log.topics.length >= 3 && log.topics[0] === tokenCreateEventHash) {
            const tokenAddress = '0x' + log.topics[2]?.slice(26) || '';
            if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
              console.log(`✅ Found TokenCreate event with token address: ${tokenAddress}`);
              return tokenAddress.toLowerCase();
            }
          }
        }
      }

      // Final fallback: contract address from receipt
      if (receipt.contractAddress) {
        console.log(`✅ Found contract address in receipt: ${receipt.contractAddress}`);
        return receipt.contractAddress.toLowerCase();
      }

      return null;
    } catch (error) {
      console.log(`⚠️ Error extracting token address from logs: ${error}`);
      return null;
    }
  }

  /**
   * Verify if a contract is a token contract
   */
  private async verifyTokenContract(contractAddress: string): Promise<boolean> {
    try {
      const [name, symbol, decimals] = await Promise.allSettled([
        ContractService.getTokenName(contractAddress),
        ContractService.getTokenSymbol(contractAddress),
        ContractService.getTokenDecimals(contractAddress)
      ]);

      const successCount = [name, symbol, decimals].filter(result => 
        result.status === 'fulfilled'
      ).length;

      return successCount >= 2;
    } catch (error) {
      console.log(`⚠️ Error verifying token contract ${contractAddress}: ${error}`);
      return false;
    }
  }

  /**
   * Send pattern-based notification
   */
  private async sendPatternNotification(
    tokenCreation: TokenCreationEvent, 
    match: PatternMatch, 
    type: 'BUY' | 'SELL' | 'BUY_FAILED' | 'SELL_FAILED', 
    txHash?: string, 
    error?: string
  ): Promise<void> {
    try {
      let message = '';
      
      if (type === 'BUY') {
        message = `🎯 PATTERN-BASED TRADE - BUY EXECUTED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Creator: ${tokenCreation.creatorAddress.slice(0, 8)}...\n` +
          `Pattern: ${match.pattern.name}\n` +
          `Confidence: ${(match.confidence * 100).toFixed(1)}%\n` +
          `Gas Price: ${tokenCreation.gasPrice.toFixed(2)} gwei\n` +
          `Gas Limit: ${tokenCreation.gasLimit.toLocaleString()}\n` +
          `Amount: ${match.pattern.trading.buyAmount} BNB\n` +
          `Hold Time: ${match.pattern.trading.holdTimeSeconds} seconds\n` +
          `TX: ${txHash || 'N/A'}`;
      } else if (type === 'SELL') {
        message = `💰 PATTERN-BASED TRADE - SELL EXECUTED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Pattern: ${match.pattern.name}\n` +
          `Held for: ${match.pattern.trading.holdTimeSeconds} seconds\n` +
          `TX: ${txHash || 'N/A'}`;
      } else if (type === 'BUY_FAILED') {
        message = `❌ PATTERN-BASED TRADE - BUY FAILED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Pattern: ${match.pattern.name}\n` +
          `Error: ${error || 'Unknown error'}`;
      } else if (type === 'SELL_FAILED') {
        message = `❌ PATTERN-BASED TRADE - SELL FAILED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Pattern: ${match.pattern.name}\n` +
          `Error: ${error || 'Unknown error'}`;
      }

      console.log(message);

    } catch (error) {
      console.error('Error sending pattern notification:', error);
    }
  }

  /**
   * Get pattern statistics
   */
  getPatternStats(): Map<string, { matches: number; trades: number; profits: number }> {
    return this.patternStats;
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    lastProcessedBlock: number;
    patternsCount: number;
    scanInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      patternsCount: this.patterns.length,
      scanInterval: this.SCAN_INTERVAL
    };
  }

  /**
   * Get all patterns
   */
  getPatterns(): Pattern[] {
    return this.patterns;
  }

  /**
   * Add a new pattern
   */
  addPattern(pattern: Pattern): void {
    this.patterns.push(pattern);
    this.patternStats.set(pattern.id, { matches: 0, trades: 0, profits: 0 });
    this.savePatterns();
    console.log(`✅ Added pattern: ${pattern.name} (${pattern.id})`);
  }

  /**
   * Update an existing pattern
   */
  updatePattern(patternId: string, updates: Partial<Pattern>): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index === -1) {
      console.log(`❌ Pattern not found: ${patternId}`);
      return false;
    }

    this.patterns[index] = { ...this.patterns[index], ...updates };
    this.savePatterns();
    console.log(`✅ Updated pattern: ${patternId}`);
    return true;
  }

  /**
   * Remove a pattern
   */
  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index === -1) {
      console.log(`❌ Pattern not found: ${patternId}`);
      return false;
    }

    const pattern = this.patterns[index];
    this.patterns.splice(index, 1);
    this.patternStats.delete(patternId);
    this.savePatterns();
    console.log(`✅ Removed pattern: ${pattern.name} (${patternId})`);
    return true;
  }

  /**
   * Enable/disable a pattern
   */
  togglePattern(patternId: string, enabled: boolean): boolean {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (!pattern) {
      console.log(`❌ Pattern not found: ${patternId}`);
      return false;
    }

    pattern.enabled = enabled;
    this.savePatterns();
    console.log(`✅ ${enabled ? 'Enabled' : 'Disabled'} pattern: ${pattern.name}`);
    return true;
  }

  /**
   * Save patterns to file
   */
  private savePatterns(): void {
    try {
      const patternsData = {
        patterns: this.patterns,
        globalSettings: {
          maxPatterns: 20,
          defaultPriority: 10,
          patternMatchingTimeout: 5000,
          enablePatternLogging: true,
          patternStatsEnabled: true
        }
      };

      fs.writeFileSync(this.PATTERNS_FILE, JSON.stringify(patternsData, null, 2));
    } catch (error) {
      console.error('❌ Error saving patterns:', error);
    }
  }

  /**
   * Get pattern performance statistics
   */
  getPatternPerformance(): Array<{
    patternId: string;
    patternName: string;
    matches: number;
    trades: number;
    successRate: number;
    avgProfit: number;
  }> {
    const performance: Array<{
      patternId: string;
      patternName: string;
      matches: number;
      trades: number;
      successRate: number;
      avgProfit: number;
    }> = [];

    for (const [patternId, stats] of this.patternStats) {
      const pattern = this.patterns.find(p => p.id === patternId);
      if (pattern) {
        performance.push({
          patternId,
          patternName: pattern.name,
          matches: stats.matches,
          trades: stats.trades,
          successRate: stats.matches > 0 ? (stats.trades / stats.matches) * 100 : 0,
          avgProfit: stats.trades > 0 ? stats.profits / stats.trades : 0
        });
      }
    }

    return performance.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Reset pattern statistics
   */
  resetPatternStats(): void {
    for (const [patternId] of this.patternStats) {
      this.patternStats.set(patternId, { matches: 0, trades: 0, profits: 0 });
    }
    console.log('✅ Pattern statistics reset');
  }

  /**
   * Simulate a token creation for testing
   */
  simulateTokenCreation(
    tokenAddress: string, 
    creatorAddress: string, 
    gasPriceGwei: number, 
    gasLimit: number, 
    transactionValue: number
  ): void {
    const simulatedEvent: TokenCreationEvent = {
      tokenAddress,
      creatorAddress,
      blockNumber: this.lastProcessedBlock + 1,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      timestamp: new Date(),
      gasPrice: gasPriceGwei,
      gasLimit: gasLimit,
      transactionValue: transactionValue
    };

    console.log('🧪 Simulating token creation for pattern testing...');
    this.processTokenCreationWithPatterns(simulatedEvent);
  }

  /**
   * Test pattern matching with sample data
   */
  testPatternMatching(): void {
    console.log('🧪 Testing pattern matching...\n');

    const testCases = [
      {
        name: 'Whale Creator Test',
        gasPrice: 10.0,
        gasLimit: 3000000,
        transactionValue: 0.5
      },
      {
        name: 'Smart Money Test',
        gasPrice: 5.0,
        gasLimit: 2000000,
        transactionValue: 0.1
      },
      {
        name: 'Bot Creator Test',
        gasPrice: 1.5,
        gasLimit: 5000000,
        transactionValue: 0.05
      }
    ];

    testCases.forEach((testCase, index) => {
      console.log(`Test ${index + 1}: ${testCase.name}`);
      console.log(`   Gas Price: ${testCase.gasPrice} gwei`);
      console.log(`   Gas Limit: ${testCase.gasLimit.toLocaleString()}`);
      console.log(`   TX Value: ${testCase.transactionValue} BNB`);

      const mockTokenCreation: TokenCreationEvent = {
        tokenAddress: '0x' + Math.random().toString(16).substr(2, 40),
        creatorAddress: '0x' + Math.random().toString(16).substr(2, 40),
        blockNumber: this.lastProcessedBlock + 1,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        timestamp: new Date(),
        gasPrice: testCase.gasPrice,
        gasLimit: testCase.gasLimit,
        transactionValue: testCase.transactionValue
      };

      const matches = this.findMatchingPatterns(mockTokenCreation);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log(`   ✅ Matched: ${bestMatch.pattern.name}`);
        console.log(`   📊 Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`);
        console.log(`   💰 Buy Amount: ${bestMatch.pattern.trading.buyAmount} BNB`);
        console.log(`   ⏰ Hold Time: ${bestMatch.pattern.trading.holdTimeSeconds} seconds`);
      } else {
        console.log(`   ❌ No patterns matched`);
      }
      console.log('');
    });
  }

  /**
   * Log unmatched pattern for analysis
   */
  private logUnmatchedPattern(tokenCreation: TokenCreationEvent): void {
    try {
      const currentPattern = this.patterns[0]; // Use the first pattern for analysis
      
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
            transactionValueRange: {
              min: currentPattern.filters.minTransactionValue,
              max: currentPattern.filters.maxTransactionValue
            }
          }
        });
      }
    } catch (error) {
      console.error('Error logging unmatched pattern:', error);
    }
  }
}
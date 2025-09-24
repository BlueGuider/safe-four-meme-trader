import { publicClient } from '../utils/web3';
import { ContractService } from './contracts';
import { TradingService } from './trading';
import { keccak256, toHex } from 'viem';
// TelegramBotService import removed - using console logging instead

/**
 * Token Creation Event Data
 */
export interface TokenCreationEvent {
  tokenAddress: string;
  creatorAddress: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  tokenName?: string;
  tokenSymbol?: string;
}

/**
 * Token Creation Scanner Service
 * 
 * This service monitors transactions between creator wallets and the four.meme contract,
 * specifically looking for createToken function calls, and automatically buys tokens
 * from monitored creators.
 */
export class TokenCreationScanner {
  private monitoredCreators: Set<string> = new Set();
  private lastProcessedBlock: number = 0;
  private scanningInterval: any = null;
  private isRunning: boolean = false;
  private buyAmount: number = 0.0001; // Default buy amount in BNB
  private sellTimeSeconds: number = 7; // Default sell time in seconds

  // Configuration
  private readonly SCAN_INTERVAL = 500; // Scan every 3 seconds
  private readonly MAX_BLOCKS_PER_SCAN = 1; // Process max 5 blocks per scan
  private readonly FOUR_MEME_CONTRACT = '0x5c952063c7fc8610ffdb798152d69f0b9550762b'; // Four.meme V2 contract

  constructor() {
    console.log('🔧 Token Creation Scanner initialized');
    console.log('📊 Will monitor transactions to four.meme contract for createToken calls');
    console.log(`🎯 Monitoring four.meme contract: ${this.FOUR_MEME_CONTRACT}`);
  }

  /**
   * Add a creator to monitor
   */
  addMonitoredCreator(creatorAddress: string): void {
    const normalizedAddress = creatorAddress.toLowerCase();
    this.monitoredCreators.add(normalizedAddress);
    console.log(`👤 Added creator to monitoring: ${normalizedAddress.slice(0, 8)}...`);
  }

  /**
   * Remove a creator from monitoring
   */
  removeMonitoredCreator(creatorAddress: string): void {
    const normalizedAddress = creatorAddress.toLowerCase();
    this.monitoredCreators.delete(normalizedAddress);
    console.log(`❌ Removed creator from monitoring: ${normalizedAddress.slice(0, 8)}...`);
  }

  /**
   * Get list of monitored creators
   */
  getMonitoredCreators(): string[] {
    return Array.from(this.monitoredCreators);
  }

  /**
   * Set buy amount for all creators
   */
  setBuyAmount(amount: number): void {
    if (amount <= 0 || amount > 10) {
      throw new Error('Buy amount must be between 0.001 and 10 BNB');
    }
    this.buyAmount = amount;
    console.log(`💰 Set buy amount to: ${amount} BNB`);
  }

  /**
   * Set sell time for all creators
   */
  setSellTime(seconds: number): void {
    if (seconds <= 0 || seconds > 3600) {
      throw new Error('Sell time must be between 1 and 3600 seconds');
    }
    this.sellTimeSeconds = seconds;
    console.log(`⏰ Set sell time to: ${seconds} seconds`);
  }

  /**
   * Start scanning for token creation transactions
   */
  async startScanning(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Token creation scanner is already running');
      return;
    }

    if (this.monitoredCreators.size === 0) {
      console.log('⚠️ No creators configured for monitoring');
      return;
    }

    try {
      console.log('🚀 Starting token creation scanner...');
      console.log(`📊 Monitoring ${this.monitoredCreators.size} creators`);
      console.log(`🎯 Target contract: ${this.FOUR_MEME_CONTRACT}`);
      console.log(`💰 Buy amount: ${this.buyAmount} BNB`);
      console.log(`⏰ Sell time: ${this.sellTimeSeconds} seconds`);
      console.log(`🔍 Scan interval: ${this.SCAN_INTERVAL}ms`);

      // Get the latest block number to start from
      const latestBlock = await publicClient.getBlockNumber();
      this.lastProcessedBlock = Number(latestBlock) - 10; // Start from 10 blocks ago
      console.log(`📍 Starting from block: ${this.lastProcessedBlock}`);

      // Start scanning
      this.startScanningLoop();

      this.isRunning = true;
      console.log('✅ Token creation scanner started');

    } catch (error) {
      console.error('❌ Error starting token creation scanner:', error);
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Token creation scanner is not running');
      return;
    }

    try {
      console.log('🛑 Stopping token creation scanner...');

      if (this.scanningInterval) {
        clearInterval(this.scanningInterval);
        this.scanningInterval = null;
      }

      this.isRunning = false;
      console.log('✅ Token creation scanner stopped');

    } catch (error) {
      console.error('❌ Error stopping token creation scanner:', error);
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
   * Scan for token creation transactions
   */
  private async scanForTokenCreations(): Promise<void> {
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const currentBlock = Number(latestBlock);

      // Only process if we have new blocks
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      // Limit the number of blocks to process in one scan
      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(currentBlock, this.lastProcessedBlock + this.MAX_BLOCKS_PER_SCAN);

      // console.log(`🔍 Scanning blocks ${fromBlock} to ${toBlock} for four.meme createToken transactions...`);

      // Scan blocks for token creation transactions
      const tokenCreations = await this.scanBlocksForTokenCreations(fromBlock, toBlock);

      // Process each token creation
      for (const tokenCreation of tokenCreations) {
        await this.processTokenCreation(tokenCreation);
      }

      // Update last processed block
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
   * Scan a single block for token creation transactions on four.meme contract
   */
  private async scanBlockForTokenCreations(blockNumber: number): Promise<TokenCreationEvent[]> {
    const tokenCreations: TokenCreationEvent[] = [];

    try {
      // Get the block with transactions
      const block = await publicClient.getBlock({
        blockNumber: BigInt(blockNumber),
        includeTransactions: true
      });

      // Check each transaction in the block
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
   * Analyze a four.meme transaction to determine if it's a createToken call from a monitored creator
   */
  private async analyzeFourMemeTransaction(tx: any, blockNumber: number): Promise<TokenCreationEvent | null> {
    try {
      const creatorAddress = tx.from.toLowerCase();

      // Check if the creator is in our monitored list
      if (!this.monitoredCreators.has(creatorAddress)) {
        return null;
      }

      // Check if this is a createToken function call
      const isCreateTokenCall = await this.isCreateTokenFunction(tx);
      if (!isCreateTokenCall) {
        return null;
      }

      // Get the created token address from transaction logs
      const tokenAddress = await this.extractTokenAddressFromLogs(tx);
      if (!tokenAddress) {
        console.log(`⚠️ Could not extract token address from transaction ${tx.hash}`);
        return null;
      }

      // Verify this is actually a token contract by checking if it has ERC20 functions
      const isTokenContract = await this.verifyTokenContract(tokenAddress);
      if (!isTokenContract) {
        console.log(`⚠️ Contract ${tokenAddress.slice(0, 8)}... is not a token contract`);
        return null;
      }

      const tokenCreation: TokenCreationEvent = {
        tokenAddress: tokenAddress,
        creatorAddress: tx.from,
        blockNumber,
        transactionHash: tx.hash,
        timestamp: new Date()
      };

      console.log(`🎯 Token creation detected from monitored creator!`);
      console.log(`   Token: ${tokenAddress}`);
      console.log(`   Creator: ${creatorAddress}`);
      console.log(`   Block: ${blockNumber}`);
      console.log(`   TX: ${tx.hash}`);

      return tokenCreation;

    } catch (error) {
      console.log(`⚠️ Error analyzing four.meme transaction: ${error}`);
      return null;
    }
  }

  /**
   * Check if a transaction is calling the createToken function on four.meme contract
   */
  private async isCreateTokenFunction(tx: any): Promise<boolean> {
    try {
      if (!tx.input || tx.input === '0x') {
        return false;
      }

      // createToken function signature: createToken(bytes code, bytes poolsCode)
      // Method ID: 0x519ebb10
      const createTokenMethodId = '0x519ebb10';
      
      // Check if the input data starts with the createToken method ID
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
  private async extractTokenAddressFromLogs(tx: any): Promise<string | null> {
    try {
      // Get transaction receipt to access logs
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
          // Check if this is a TokenCreate event
          if (log.topics.length >= 3 && log.topics[0] === tokenCreateEventHash) {
            // Extract token address from the second indexed parameter
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

      console.log(`⚠️ No token address found in transaction logs`);
      return null;
    } catch (error) {
      console.log(`⚠️ Error extracting token address from logs: ${error}`);
      return null;
    }
  }

  /**
   * Verify if a contract is a token contract by checking ERC20 functions
   */
  private async verifyTokenContract(contractAddress: string): Promise<boolean> {
    try {
      // Try to call basic ERC20 functions to verify it's a token
      const [name, symbol, decimals] = await Promise.allSettled([
        ContractService.getTokenName(contractAddress),
        ContractService.getTokenSymbol(contractAddress),
        ContractService.getTokenDecimals(contractAddress)
      ]);

      // If we can get at least 2 out of 3 basic token properties, it's likely a token
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
   * Process a token creation event - buy the token through four.meme
   */
  private async processTokenCreation(tokenCreation: TokenCreationEvent): Promise<void> {
    try {
      console.log(`💰 Processing token creation - attempting to buy token...`);
      console.log(`   Token: ${tokenCreation.tokenAddress}`);
      console.log(`   Creator: ${tokenCreation.creatorAddress}`);
      console.log(`   Buy amount: ${this.buyAmount} BNB`);

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

      // Attempt to buy the token through four.meme
      const buyResult = await TradingService.buyTokens(
        tokenCreation.tokenAddress,
        this.buyAmount,
        'token-scanner' // Use a default user ID for the scanner
      );

      if (buyResult.success) {
        console.log(`✅ Successfully bought token ${tokenCreation.tokenAddress.slice(0, 8)}...`);
        console.log(`   Amount: ${this.buyAmount} BNB`);
        console.log(`   TX: ${buyResult.data?.txHash || 'N/A'}`);

        // Schedule sell after the specified time
        setTimeout(async () => {
          await this.sellToken(tokenCreation.tokenAddress, tokenCreation);
        }, this.sellTimeSeconds * 1000);

        // Send notification
        await this.sendNotification(tokenCreation, 'BUY', buyResult.data?.txHash);

      } else {
        console.log(`❌ Failed to buy token ${tokenCreation.tokenAddress.slice(0, 8)}...: ${buyResult.error}`);
        await this.sendNotification(tokenCreation, 'BUY_FAILED', undefined, buyResult.error);
      }

    } catch (error) {
      console.error(`❌ Error processing token creation: ${error}`);
    }
  }

  /**
   * Sell a token
   */
  private async sellToken(tokenAddress: string, tokenCreation: TokenCreationEvent): Promise<void> {
    try {
      console.log(`💰 Selling token ${tokenAddress.slice(0, 8)}... after ${this.sellTimeSeconds} seconds`);

      const sellResult = await TradingService.sellTokens(
        tokenAddress,
        100, // Sell 100% of tokens
        'token-scanner'
      );

      if (sellResult.success) {
        console.log(`✅ Successfully sold token ${tokenAddress.slice(0, 8)}...`);
        console.log(`   TX: ${sellResult.data?.txHash || 'N/A'}`);

        await this.sendNotification(tokenCreation, 'SELL', sellResult.data?.txHash);

      } else {
        console.log(`❌ Failed to sell token ${tokenAddress.slice(0, 8)}...: ${sellResult.error}`);
        await this.sendNotification(tokenCreation, 'SELL_FAILED', undefined, sellResult.error);
      }

    } catch (error) {
      console.error(`❌ Error selling token: ${error}`);
    }
  }

  /**
   * Send notification via console (Telegram integration can be added later)
   */
  private async sendNotification(tokenCreation: TokenCreationEvent, type: 'BUY' | 'SELL' | 'BUY_FAILED' | 'SELL_FAILED', txHash?: string, error?: string): Promise<void> {
    try {
      let message = '';
      
      if (type === 'BUY') {
        message = `🎯 TOKEN CREATION SCANNER - BUY EXECUTED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Creator: ${tokenCreation.creatorAddress.slice(0, 8)}...\n` +
          `Name: ${tokenCreation.tokenName || 'Unknown'}\n` +
          `Symbol: ${tokenCreation.tokenSymbol || 'Unknown'}\n` +
          `Amount: ${this.buyAmount} BNB\n` +
          `Sell in: ${this.sellTimeSeconds} seconds\n` +
          `TX: ${txHash || 'N/A'}`;
      } else if (type === 'SELL') {
        message = `💰 TOKEN CREATION SCANNER - SELL EXECUTED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Creator: ${tokenCreation.creatorAddress.slice(0, 8)}...\n` +
          `Held for: ${this.sellTimeSeconds} seconds\n` +
          `TX: ${txHash || 'N/A'}`;
      } else if (type === 'BUY_FAILED') {
        message = `❌ TOKEN CREATION SCANNER - BUY FAILED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Creator: ${tokenCreation.creatorAddress.slice(0, 8)}...\n` +
          `Error: ${error || 'Unknown error'}`;
      } else if (type === 'SELL_FAILED') {
        message = `❌ TOKEN CREATION SCANNER - SELL FAILED\n\n` +
          `Token: ${tokenCreation.tokenAddress.slice(0, 8)}...\n` +
          `Creator: ${tokenCreation.creatorAddress.slice(0, 8)}...\n` +
          `Error: ${error || 'Unknown error'}`;
      }

      console.log(message);

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Get the current status of the scanner
   */
  getStatus(): {
    isRunning: boolean;
    lastProcessedBlock: number;
    monitoredCreatorsCount: number;
    buyAmount: number;
    sellTimeSeconds: number;
    scanInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      monitoredCreatorsCount: this.monitoredCreators.size,
      buyAmount: this.buyAmount,
      sellTimeSeconds: this.sellTimeSeconds,
      scanInterval: this.SCAN_INTERVAL
    };
  }

  /**
   * Simulate a token creation for testing
   */
  simulateTokenCreation(tokenAddress: string, creatorAddress: string): void {
    const simulatedEvent: TokenCreationEvent = {
      tokenAddress,
      creatorAddress,
      blockNumber: this.lastProcessedBlock + 1,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      timestamp: new Date()
    };

    console.log('🧪 Simulating token creation for testing...');
    this.processTokenCreation(simulatedEvent);
  }
}

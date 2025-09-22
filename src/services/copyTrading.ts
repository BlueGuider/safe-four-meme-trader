import { publicClient } from '../utils/web3';
import { TradingService } from './trading';
import { ContractService } from './contracts';
import { WalletService } from './wallet';
import { ValidationUtils } from '../utils/validation';
import { decodeFunctionData } from 'viem';
import { TOKEN_MANAGER_V1_ABI, TOKEN_MANAGER_V2_ABI } from '../contracts/abis';
import SwapX_ABI from '../contracts/abis/SwapX_ABI.json';
import { TelegramBotService } from './telegramBot';
import { PriceTrackingService } from './priceTrackingService';
import { DirectPriceService } from './directPriceService';
import { CSVLogger } from './csvLogger';

export interface CopyTradingConfig {
  targetWallet: string;
  copyRatio: number; // 0.1 = 10% of target's position
  maxPositionSize: number; // Max BNB per trade
  minPositionSize: number; // Min BNB per trade
  enabled: boolean;
  delayMs: number; // Delay before executing (0-5000ms)
  maxDailyLoss: number; // Stop copying if daily loss exceeds this
  allowedTokens: string[]; // Empty = all tokens, or specific list
  blockedTokens: string[]; // Tokens to never copy
}

export interface CopyTrade {
  id: string;
  targetTxHash: string;
  tokenAddress: string;
  tradeType: 'BUY' | 'SELL';
  targetAmount: number; // BNB amount from target
  copiedAmount: number; // BNB amount we copied
  copyRatio: number;
  executedAt: Date;
  ourTxHash?: string;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  profitLoss?: number; // P&L when sold
  tokenAmount?: number; // Token amount from target transaction
}

export class CopyTradingService {
  private static configs: Map<string, CopyTradingConfig> = new Map();
  private static activeTrades: Map<string, CopyTrade> = new Map();
  private static isMonitoring = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static lastProcessedBlock = 0;
  private static testingMode = false; // Set to false to enable actual trading
  private static priceTrackingService: PriceTrackingService = PriceTrackingService.getInstance();
  private static csvLogger: CSVLogger = CSVLogger.getInstance();

  /**
   * Setup copy trading for a user
   */
  static async setupCopyTrading(
    userId: string,
    targetWallet: string,
    copyRatio: number = 0.01,
    maxPositionSize: number = 0.0001,
    delayMs: number = 0
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate target wallet
      const addressValidation = ValidationUtils.validateAddress(targetWallet);
      if (!addressValidation.isValid) {
        return { success: false, error: `Invalid target wallet: ${addressValidation.error}` };
      }

      // Validate copy ratio
      if (copyRatio <= 0 || copyRatio > 1) {
        return { success: false, error: 'Copy ratio must be between 0.01 and 1.0' };
      }

      // Validate position sizes
      if (maxPositionSize <= 0) {
        return { success: false, error: 'Max position size must be greater than 0' };
      }

      const config: CopyTradingConfig = {
        targetWallet: targetWallet.toLowerCase(),
        copyRatio,
        maxPositionSize,
        minPositionSize: 0.0001, // Minimum 0.0001 BNB
        enabled: true,
        delayMs: Math.min(delayMs, 5000), // Max 5 second delay
        maxDailyLoss: 0.1, // 0.1 BNB max daily loss
        allowedTokens: [], // Empty = all tokens
        blockedTokens: []
      };

      this.configs.set(userId, config);
      
      // Start monitoring if not already running
      if (!this.isMonitoring) {
        this.startMonitoring();
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting up copy trading:', error);
      return { success: false, error: 'Failed to setup copy trading' };
    }
  }

  /**
   * Start monitoring target wallets for transactions
   */
  private static startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🚀 Copy trading monitoring started');
    console.log(`📊 Monitoring ${this.configs.size} target wallet(s)`);
    console.log(`🧪 Mode: ${this.testingMode ? 'SIMULATION' : 'LIVE TRADING'}`);
    console.log('');

    // Poll every 300ms for new transactions (faster response)
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewTransactions();
      } catch (error) {
        console.error('Error in copy trading monitoring:', error);
      }
    }, 300);
  }

  /**
   * Add a target wallet to monitor
   */
  static async addTargetWallet(targetWallet: string, config: Partial<CopyTradingConfig> = {}): Promise<{ success: boolean; error?: string }> {
    try {
      const defaultConfig: CopyTradingConfig = {
        targetWallet,
        copyRatio: 0.01, // 1%
        maxPositionSize: 0.0001, // 0.0001 BNB max
        minPositionSize: 0.0001, // 0.0001 BNB min
        enabled: true,
        delayMs: 0, // No delay
        maxDailyLoss: 0.1, // 10% max daily loss
        allowedTokens: [],
        blockedTokens: [],
        ...config
      };

      // Use a dedicated copy trading user ID
      const copyTradingUserId = 'copy-trading-bot';
      this.configs.set(copyTradingUserId, defaultConfig);
      
      if (!this.isMonitoring) {
        this.startMonitoring();
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding target wallet:', error);
      return { success: false, error: 'Failed to add target wallet' };
    }
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Copy trading monitoring stopped');
  }

  /**
   * Get all copy trading configurations
   */
  static getConfigs(): Map<string, CopyTradingConfig> {
    return this.configs;
  }

  /**
   * Remove a copy trading configuration
   */
  static removeConfig(userId: string): void {
    this.configs.delete(userId);
    console.log(`Removed copy trading config for user: ${userId}`);
  }

  /**
   * Check for new transactions from target wallets
   */
  private static async checkForNewTransactions(): Promise<void> {
    try {
      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();
      
      if (this.lastProcessedBlock === 0) {
        this.lastProcessedBlock = Number(currentBlock) - 10; // Start from 10 blocks ago
      }

      const blocksToProcess = Number(currentBlock) - this.lastProcessedBlock;
      
      if (blocksToProcess > 0) {
        // console.log(`🔍 Analyzing ${blocksToProcess} new block(s) (${this.lastProcessedBlock + 1} to ${currentBlock})`);
        
        // Process blocks from last processed to current
        for (let blockNum = this.lastProcessedBlock + 1; blockNum <= Number(currentBlock); blockNum++) {
          await this.processBlock(blockNum);
        }
        
        this.lastProcessedBlock = Number(currentBlock);
        // console.log(`✅ Block analysis complete. Next check in 3 seconds...`);
      } else {
        // Show periodic status every 30 seconds
        const now = new Date();
        if (now.getSeconds() % 30 === 0) {
          console.log(`⏰ [${now.toLocaleTimeString()}] Monitoring active - No new blocks`);
        }
      }
    } catch (error) {
      console.error('Error checking for new transactions:', error);
    }
  }

  /**
   * Process a specific block for target wallet transactions
   */
  private static async processBlock(blockNumber: number): Promise<void> {
    try {
      const block = await publicClient.getBlock({
        blockNumber: BigInt(blockNumber),
        includeTransactions: true
      });

      if (!block.transactions) return;

      let targetTxCount = 0;
      const targetWallets = Array.from(this.configs.values()).map(c => c.targetWallet);

      // Check each transaction in the block
      for (const tx of block.transactions) {
        if (tx.type === 'legacy' || tx.type === 'eip1559' || tx.type === 'eip2930') {
          const fromAddress = tx.from?.toLowerCase();
          if (fromAddress && targetWallets.includes(fromAddress)) {
            targetTxCount++;
          }
          await this.processTransaction(tx);
        }
      }

      // Log block analysis results
      if (targetTxCount > 0) {
        console.log(`   📊 Block ${blockNumber}: Found ${targetTxCount} target wallet transaction(s) out of ${block.transactions.length} total`);
      }
    } catch (error) {
      console.error(`Error processing block ${blockNumber}:`, error);
    }
  }

  /**
   * Process a transaction to see if it's from a target wallet
   */
  private static async processTransaction(tx: any): Promise<void> {
    try {
      const fromAddress = tx.from?.toLowerCase();
      if (!fromAddress) return;

      // Check if this transaction is from any target wallet
      for (const [userId, config] of this.configs) {
        if (config.targetWallet.toLowerCase() === fromAddress && config.enabled) {
          await this.analyzeAndCopyTransaction(userId, config, tx);
        }
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }

  /**
   * Analyze a transaction and determine if we should copy it
   */
  private static async analyzeAndCopyTransaction(
    userId: string,
    config: CopyTradingConfig,
    tx: any
  ): Promise<void> {
    try {
      const toAddress = tx.to?.toLowerCase();
      if (!toAddress) {
        console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: No 'to' address`);
        return;
      }

      // Check if this is a known trading contract OR a token contract
      const isKnownContract = await this.isKnownTradingContract(toAddress);
      const isTokenContract = await this.isTokenContract(toAddress);
      
      if (!isKnownContract && !isTokenContract) {
        console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Not a known trading or token contract (${toAddress})`);
        return;
      }

      // Parse transaction data to determine if it's a buy or sell
      console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Parsing transaction data...`);
      console.log(`   📊 Transaction details: from=${tx.from}, to=${tx.to}, value=${tx.value}, input=${tx.input?.slice(0, 10)}...`);
      
      let tradeInfo = await this.parseTransactionData(tx);
      if (!tradeInfo) {
        console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Could not parse trade data, trying internal transaction analysis`);
        tradeInfo = await this.analyzeInternalTransactions(tx);
        if (!tradeInfo) {
          console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Could not determine trade type from internal transactions`);
          return;
        }
      }
      
      console.log(`   ✅ Transaction ${tx.hash?.slice(0, 10)}...: Parsed as ${tradeInfo.type} trade`);
      console.log(`   📊 Trade info: token=${tradeInfo.tokenAddress}, bnbAmount=${tradeInfo.bnbAmount}, tokenAmount=${tradeInfo.tokenAmount || 'N/A'}`);

      // Check if token is allowed/blocked
      console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Checking if token is allowed...`);
      if (!this.isTokenAllowed(config, tradeInfo.tokenAddress)) {
        console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Token not allowed`);
        return;
      }
      console.log(`   ✅ Transaction ${tx.hash?.slice(0, 10)}...: Token is allowed`);

      // Determine trading platform and validate accordingly
      console.log(`   🔍 Transaction ${tx.hash?.slice(0, 10)}...: Determining trading platform for token ${tradeInfo.tokenAddress}...`);
      const platformInfo = await this.determineTradingPlatform(tradeInfo.tokenAddress);
      console.log(`   📊 Transaction ${tx.hash?.slice(0, 10)}...: Platform: ${platformInfo.platform}, Tradeable: ${platformInfo.isTradeable}`);
      
      if (!platformInfo.isTradeable) {
        if (platformInfo.platform === 'DEX') {
          console.log(`   ⚠️  Transaction ${tx.hash?.slice(0, 10)}...: Token migrated to PancakeSwap - will attempt PancakeSwap trade`);
        } else {
          console.log(`   ❌ Transaction ${tx.hash?.slice(0, 10)}...: Token not tradeable on ${platformInfo.platform}`);
          return;
        }
      }
      console.log(`   ✅ Transaction ${tx.hash?.slice(0, 10)}...: Token is tradeable, proceeding with copy trade`);

      // Calculate copy amount based on trade type
      let copyAmount: number;
      
      if (tradeInfo.type === 'SELL') {
        // For SELL transactions, we need to check if we have tokens to sell
        console.log(`   📊 SELL transaction detected - checking our token holdings...`);
        console.log(`   📊 Target wallet sold ${tradeInfo.tokenAmount?.toFixed(2) || 'unknown'} tokens`);
        
        // Skip if we don't have token amount info
        if (!tradeInfo.tokenAmount || tradeInfo.tokenAmount <= 0) {
          console.log(`   ❌ No token amount information available for SELL transaction, skipping`);
          return;
        }
        
        // For SELL, we'll use a fixed small amount since we can't determine BNB value
        copyAmount = Math.min(config.maxPositionSize, 0.001); // Use 0.001 BNB as default for sells
        console.log(`   💰 SELL copy amount: ${copyAmount.toFixed(6)} BNB (fixed amount for sell trades)`);
        
        if (copyAmount < config.minPositionSize) {
          console.log(`   ❌ SELL copy amount too small (${copyAmount.toFixed(6)} < ${config.minPositionSize}), skipping trade`);
          return;
        }
      } else {
        // For BUY transactions, use the original BNB amount
        console.log(`   📊 Original BUY amount: ${tradeInfo.bnbAmount.toFixed(6)} BNB, Copy ratio: ${(config.copyRatio * 100).toFixed(1)}%`);
        copyAmount = Math.min(
          tradeInfo.bnbAmount * config.copyRatio,
          config.maxPositionSize
        );

        console.log(`   💰 BUY copy amount: ${copyAmount.toFixed(6)} BNB, Min position size: ${config.minPositionSize} BNB`);
        if (copyAmount < config.minPositionSize) {
          console.log(`   ❌ BUY copy amount too small (${copyAmount.toFixed(6)} < ${config.minPositionSize}), skipping trade`);
          return;
        }
      }

      // Log successful detection with clean format
      const timestamp = new Date().toLocaleString();
      console.log(`\n🎯 [${timestamp}] TARGET TRADE DETECTED`);
      console.log(`   📍 Wallet: ${tx.from?.slice(0, 10)}...${tx.from?.slice(-6)}`);
      console.log(`   🔄 Type: ${tradeInfo.type}`);
      console.log(`   🪙 Token: ${tradeInfo.tokenAddress.slice(0, 10)}...${tradeInfo.tokenAddress.slice(-6)}`);
      console.log(`   💰 Amount: ${tradeInfo.bnbAmount.toFixed(6)} BNB`);
      console.log(`   🏢 Platform: ${platformInfo.platform}`);
      console.log(`   📊 Copy: ${copyAmount.toFixed(6)} BNB (${(config.copyRatio * 100).toFixed(1)}%)`);
      if (tradeInfo.tokenAmount) {
        console.log(`   🪙 Tokens: ${tradeInfo.tokenAmount.toFixed(2)}`);
      }

      // Create copy trade record
      const copyTrade: CopyTrade = {
        id: this.generateId(),
        targetTxHash: tx.hash,
        tokenAddress: tradeInfo.tokenAddress,
        tradeType: tradeInfo.type,
        targetAmount: tradeInfo.bnbAmount,
        copiedAmount: copyAmount,
        copyRatio: config.copyRatio,
        executedAt: new Date(),
        status: 'PENDING',
        tokenAmount: tradeInfo.tokenAmount
      };

      this.activeTrades.set(copyTrade.id, copyTrade);

      // Execute copy trade with delay
      console.log(`⏰ Scheduling copy trade execution in ${config.delayMs}ms...`);
      setTimeout(async () => {
        console.log(`🚀 Executing scheduled copy trade for token ${copyTrade.tokenAddress.slice(0, 8)}...`);
        try {
          await this.executeCopyTrade(userId, copyTrade);
        } catch (error) {
          console.error(`❌ Error executing copy trade:`, error);
        }
      }, config.delayMs);

    } catch (error) {
      console.error('Error analyzing transaction:', error);
    }
  }

  /**
   * Check if an address is a known trading contract
   */
  public static async isKnownTradingContract(address: string): Promise<boolean> {
    const knownContracts = [
      // Four.meme contracts
      '0xf251f83e40a78868fcfa3fa4599dad6494e46034', // Helper
      '0xec4549cadce5da21df6e6422d448034b5233bfbc', // V1
      '0x5c952063c7fc8610ffdb798152d69f0b9550762b', // V2
      // SwapX contract (proxy) - Main contract for trading
      '0x1de460f363af910f51726def188f9004276bf4bc',
      // SwapX implementation
      '0x7c7ae3868d969b57b7a47fd5cba8899df1f3d564'
    ];

    const lowerAddress = address.toLowerCase();
    return knownContracts.includes(lowerAddress);
  }

  /**
   * Check if an address is a token contract (ERC20)
   */
  public static async isTokenContract(address: string): Promise<boolean> {
    try {
      // Try to call totalSupply - if it succeeds, it's likely an ERC20 token
      await publicClient.readContract({
        address: address as `0x${string}`,
        abi: [
          {
            inputs: [],
            name: 'totalSupply',
            outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function'
          }
        ],
        functionName: 'totalSupply'
      });
      return true;
    } catch (error) {
      // If totalSupply fails, it's not a token contract
      return false;
    }
  }

  /**
   * Parse transaction data to extract trade information
   */
  public static async parseTransactionData(tx: any): Promise<{
    type: 'BUY' | 'SELL';
    tokenAddress: string;
    bnbAmount: number;
    tokenAmount?: number;
  } | null> {
    try {
      const bnbAmount = Number(tx.value) / 1e18;
      const inputData = tx.input;
      
      // Validate transaction data
      if (!tx.to || !tx.from) {
        console.log(`Invalid transaction: missing to/from address`);
        return null;
      }
      
      if (!inputData || inputData === '0x') {
        // Try to analyze using internal transactions and token transfers
        return await this.analyzeInternalTransactions(tx);
      }

      // Try to decode as V1 TokenManager function
      try {
        const decoded = decodeFunctionData({
          abi: TOKEN_MANAGER_V1_ABI,
          data: inputData as `0x${string}`
        });

        if (decoded.functionName === 'purchaseTokenAMAP') {
          const [tokenAddress, _amountIn, _minAmountOut] = decoded.args as [string, bigint, bigint];
          return {
            type: 'BUY',
            tokenAddress: tokenAddress.toLowerCase(),
            bnbAmount,
            tokenAmount: Number(_amountIn) / 1e18
          };
        } else if (decoded.functionName === 'saleToken') {
          const [tokenAddress, amountOut] = decoded.args as [string, bigint];
          return {
            type: 'SELL',
            tokenAddress: tokenAddress.toLowerCase(),
            bnbAmount: 0, // Sell transactions don't send BNB
            tokenAmount: Number(amountOut) / 1e18
          };
        }
      } catch (v1Error) {
        // Not a V1 function, try V2
      }

      // Try to decode as V2 TokenManager function
      try {
        const decoded = decodeFunctionData({
          abi: TOKEN_MANAGER_V2_ABI,
          data: inputData as `0x${string}`
        });

        if (decoded.functionName === 'buyTokenAMAP') {
          const [tokenAddress, _amountIn, _minAmountOut] = decoded.args as [string, bigint, bigint];
          return {
            type: 'BUY',
            tokenAddress: tokenAddress.toLowerCase(),
            bnbAmount,
            tokenAmount: Number(_amountIn) / 1e18
          };
        } else if (decoded.functionName === 'sellToken') {
          // Handle different sellToken function signatures
          if (decoded.args.length === 2) {
            // sellToken(address token, uint256 amount)
            const [tokenAddress, amountOut] = decoded.args as [string, bigint];
            return {
              type: 'SELL',
              tokenAddress: tokenAddress.toLowerCase(),
              bnbAmount: 0, // Sell transactions don't send BNB
              tokenAmount: Number(amountOut) / 1e18
            };
          } else if (decoded.args.length === 7) {
            // sellToken(uint256 origin, address token, address recipient, uint256 amount, uint256 minFunds, uint256 feeRate, address feeRecipient)
            const [, tokenAddress, , amountOut] = decoded.args as [bigint, string, string, bigint, bigint, bigint, string];
            return {
              type: 'SELL',
              tokenAddress: tokenAddress.toLowerCase(),
              bnbAmount: 0, // Sell transactions don't send BNB
              tokenAmount: Number(amountOut) / 1e18
            };
          }
        }
      } catch (v2Error) {
        // Not a V2 function either
      }

      // Try to decode as SwapX function
      try {
        const decoded = decodeFunctionData({
          abi: SwapX_ABI,
          data: inputData as `0x${string}`
        });

        if (decoded.functionName === 'swapV2ExactIn') {
          const [tokenIn, tokenOut, amountIn, _amountOutMin, _poolAddress] = decoded.args as [string, string, bigint, bigint, string];
          
          // Determine if it's a buy or sell based on token addresses
          // If tokenIn is BNB (0x0000...0000) and tokenOut is a token, it's a BUY
          // If tokenIn is a token and tokenOut is BNB, it's a SELL
          const isBNB = tokenIn === '0x0000000000000000000000000000000000000000';
          
          if (isBNB) {
            // BUY: BNB -> Token - need to get actual token amount from logs
            const tokenAmount = await this.getTokenAmountFromLogs(tx, tokenOut.toLowerCase());
            return {
              type: 'BUY',
              tokenAddress: tokenOut.toLowerCase(),
              bnbAmount,
              tokenAmount: tokenAmount || Number(amountIn) / 1e18 // Fallback to amountIn if logs fail
            };
          } else {
            // SELL: Token -> BNB
            return {
              type: 'SELL',
              tokenAddress: tokenIn.toLowerCase(),
              bnbAmount: 0, // Sell transactions don't send BNB
              tokenAmount: Number(amountIn) / 1e18
            };
          }
        } else if (decoded.functionName === 'swapV3ExactIn') {
          // V3 exact input swap
          const [params] = decoded.args as [any];
          const { tokenIn, tokenOut, amountIn, amountOutMinimum: _amountOutMinimum } = params;
          
          console.log(`   🔍 swapV3ExactIn: ${tokenIn} -> ${tokenOut}, amount: ${amountIn}`);
          
          // Determine if it's a buy or sell based on token addresses
          const isBNB = tokenIn === '0x0000000000000000000000000000000000000000';
          
          if (isBNB) {
            // BUY: BNB -> Token - need to get actual token amount from logs
            const tokenAmount = await this.getTokenAmountFromLogs(tx, tokenOut.toLowerCase());
            return {
              type: 'BUY',
              tokenAddress: tokenOut.toLowerCase(),
              bnbAmount,
              tokenAmount: tokenAmount || Number(amountIn) / 1e18 // Fallback to amountIn if logs fail
            };
          } else {
            // SELL: Token -> BNB
            return {
              type: 'SELL',
              tokenAddress: tokenIn.toLowerCase(),
              bnbAmount: 0,
              tokenAmount: Number(amountIn) / 1e18
            };
          }
        } else if (decoded.functionName === 'swapV3MultiHopExactIn') {
          // V3 multi-hop exact input swap
          const [params] = decoded.args as [any];
          const { path, amountIn, amountOutMinimum: _amountOutMinimum } = params;
          
          console.log(`   🔍 swapV3MultiHopExactIn: path length ${path.length}, amount: ${amountIn}`);
          console.log(`   🔍 Path: ${path.map((p: string) => p.slice(0, 8) + '...').join(' -> ')}`);
          
          // Extract first and last tokens from path
          const firstToken = path[0];
          const lastToken = path[path.length - 1];
          
          const isBNBIn = firstToken === '0x0000000000000000000000000000000000000000';
          const isBNBOut = lastToken === '0x0000000000000000000000000000000000000000';
          
          if (isBNBIn && !isBNBOut) {
            // BUY: BNB -> Token - need to get actual token amount from logs
            console.log(`   🔍 BUY detected: BNB -> Token (${lastToken})`);
            const tokenAmount = await this.getTokenAmountFromLogs(tx, lastToken.toLowerCase());
            return {
              type: 'BUY',
              tokenAddress: lastToken.toLowerCase(),
              bnbAmount,
              tokenAmount: tokenAmount || Number(amountIn) / 1e18 // Fallback to amountIn if logs fail
            };
          } else if (!isBNBIn && isBNBOut) {
            // SELL: Token -> BNB
            console.log(`   🔍 SELL detected: Token (${firstToken}) -> BNB`);
            return {
              type: 'SELL',
              tokenAddress: firstToken.toLowerCase(),
              bnbAmount: 0,
              tokenAmount: Number(amountIn) / 1e18
            };
          } else {
            // Token to token swap
            console.log(`   🔍 Token-to-token swap: ${firstToken} -> ${lastToken}`);
            return {
              type: 'SELL',
              tokenAddress: firstToken.toLowerCase(),
              bnbAmount: 0,
              tokenAmount: Number(amountIn) / 1e18
            };
          }
        } else if (decoded.functionName === 'swapV2MultiHopExactIn') {
          // V2 multi-hop exact input swap
          const [tokenIn, amountIn, _amountOutMin, path, _recipient, _deadline, _factory] = decoded.args as [string, bigint, bigint, string[], string, bigint, string];
          
          console.log(`   🔍 swapV2MultiHopExactIn: ${tokenIn} -> ${path[path.length - 1]}, amount: ${amountIn}`);
          
          const isBNB = tokenIn === '0x0000000000000000000000000000000000000000';
          const lastToken = path[path.length - 1];
          
          if (isBNB) {
            // BUY: BNB -> Token - need to get actual token amount from logs
            const tokenAmount = await this.getTokenAmountFromLogs(tx, lastToken.toLowerCase());
            return {
              type: 'BUY',
              tokenAddress: lastToken.toLowerCase(),
              bnbAmount,
              tokenAmount: tokenAmount || Number(amountIn) / 1e18 // Fallback to amountIn if logs fail
            };
          } else {
            // SELL: Token -> BNB
            return {
              type: 'SELL',
              tokenAddress: tokenIn.toLowerCase(),
              bnbAmount: 0,
              tokenAmount: Number(amountIn) / 1e18
            };
          }
        } else if (decoded.functionName === 'swapMixedMultiHopExactIn') {
          // Mixed multi-hop exact input swap
          const [params] = decoded.args as [any];
          const { amountIn, amountOutMinimum: _amountOutMinimum, path } = params;
          
          console.log(`   🔍 swapMixedMultiHopExactIn: amount: ${amountIn}`);
          console.log(`   🔍 Path: ${path ? path.map((p: string) => p.slice(0, 8) + '...').join(' -> ') : 'No path'}`);
          
          // Extract first and last tokens from path
          if (path && path.length > 0) {
            const firstToken = path[0];
            const lastToken = path[path.length - 1];
            
            const isBNBIn = firstToken === '0x0000000000000000000000000000000000000000';
            const isBNBOut = lastToken === '0x0000000000000000000000000000000000000000';
            
            if (isBNBIn && !isBNBOut) {
              // BUY: BNB -> Token - need to get actual token amount from logs
              console.log(`   🔍 BUY detected: BNB -> Token (${lastToken})`);
              const tokenAmount = await this.getTokenAmountFromLogs(tx, lastToken.toLowerCase());
              return {
                type: 'BUY',
                tokenAddress: lastToken.toLowerCase(),
                bnbAmount,
                tokenAmount: tokenAmount || Number(amountIn) / 1e18 // Fallback to amountIn if logs fail
              };
            } else if (!isBNBIn && isBNBOut) {
              // SELL: Token -> BNB
              console.log(`   🔍 SELL detected: Token (${firstToken}) -> BNB`);
              return {
                type: 'SELL',
                tokenAddress: firstToken.toLowerCase(),
                bnbAmount: 0,
                tokenAmount: Number(amountIn) / 1e18
              };
            } else {
              // Token to token swap
              console.log(`   🔍 Token-to-token swap: ${firstToken} -> ${lastToken}`);
              return {
                type: 'SELL',
                tokenAddress: firstToken.toLowerCase(),
                bnbAmount: 0,
                tokenAmount: Number(amountIn) / 1e18
              };
            }
          }
          
          // Fallback for mixed swaps without path
          return {
            type: bnbAmount > 0 ? 'BUY' : 'SELL',
            tokenAddress: '0x0000000000000000000000000000000000000000', // Unknown token
            bnbAmount,
            tokenAmount: Number(amountIn) / 1e18
          };
        } else if (decoded.functionName === 'buyMemeToken2') {
          // Four.meme buy function
          const [data] = decoded.args as [any];
          return {
            type: 'BUY',
            tokenAddress: data.token.toLowerCase(),
            bnbAmount,
            tokenAmount: data.amount ? Number(data.amount) / 1e18 : undefined
          };
        } else if (decoded.functionName === 'sellMemeToken2') {
          // Four.meme sell function
          const [data] = decoded.args as [any];
          return {
            type: 'SELL',
            tokenAddress: data.token.toLowerCase(),
            bnbAmount: 0,
            tokenAmount: data.amount ? Number(data.amount) / 1e18 : undefined
          };
        } else if (decoded.functionName === 'buyMemeToken') {
          // Four.meme buy function (single)
          const [_tokenManager, token, _recipient, funds, _minAmount] = decoded.args as [string, string, string, bigint, bigint];
          return {
            type: 'BUY',
            tokenAddress: token.toLowerCase(),
            bnbAmount,
            tokenAmount: Number(funds) / 1e18
          };
        } else if (decoded.functionName === 'sellMemeToken') {
          // Four.meme sell function (single)
          const [data] = decoded.args as [any];
          return {
            type: 'SELL',
            tokenAddress: data.token.toLowerCase(),
            bnbAmount: 0,
            tokenAmount: data.amount ? Number(data.amount) / 1e18 : undefined
          };
        } else if (decoded.functionName === 'sellToken' && decoded.args) {
          // Direct sellToken function call
          if (decoded.args.length === 7) {
            // sellToken(uint256 origin, address token, address recipient, uint256 amount, uint256 minFunds, uint256 feeRate, address feeRecipient)
            const [, tokenAddress, , amountOut] = decoded.args as [bigint, string, string, bigint, bigint, bigint, string];
            return {
              type: 'SELL',
              tokenAddress: tokenAddress.toLowerCase(),
              bnbAmount: 0,
              tokenAmount: Number(amountOut) / 1e18
            };
          }
        } else if (decoded.functionName === 'buyFlapToken') {
          // Flap token buy function
          const [_manager, token, _recipient, minAmount] = decoded.args as [string, string, string, bigint];
          return {
            type: 'BUY',
            tokenAddress: token.toLowerCase(),
            bnbAmount,
            tokenAmount: Number(minAmount) / 1e18
          };
        } else if (decoded.functionName === 'sellFlapToken') {
          // Flap token sell function
          const [_manager, token, _recipient, amount, _minAmount] = decoded.args as [string, string, string, bigint, bigint];
          return {
            type: 'SELL',
            tokenAddress: token.toLowerCase(),
            bnbAmount: 0,
            tokenAmount: Number(amount) / 1e18
          };
        } else if (decoded.functionName === 'swap') {
          // Generic swap function - try to extract token information from the descs parameter
          const [descs, feeToken, _amountIn, _minReturn] = decoded.args as [any[], string, bigint, bigint];
          
          console.log(`   🔍 SwapX swap function: ${descs.length} swaps, feeToken: ${feeToken}`);
          
          if (descs && descs.length > 0) {
            const firstSwap = descs[0];
            const lastSwap = descs[descs.length - 1];
            
            console.log(`   📝 First swap: ${firstSwap.tokenIn} -> ${firstSwap.tokenOut}`);
            console.log(`   📝 Last swap: ${lastSwap.tokenIn} -> ${lastSwap.tokenOut}`);
            
            // Determine if it's a buy or sell based on the swap path
            const isBNBIn = firstSwap.tokenIn === '0x0000000000000000000000000000000000000000';
            const isBNBOut = lastSwap.tokenOut === '0x0000000000000000000000000000000000000000';
            
            if (isBNBIn && !isBNBOut) {
              // BUY: BNB -> Token - need to get actual token amount from logs
              const tokenAmount = await this.getTokenAmountFromLogs(tx, lastSwap.tokenOut.toLowerCase());
              return {
                type: 'BUY',
                tokenAddress: lastSwap.tokenOut.toLowerCase(),
                bnbAmount,
                tokenAmount: tokenAmount || Number(_amountIn) / 1e18 // Fallback to amountIn if logs fail
              };
            } else if (!isBNBIn && isBNBOut) {
              // SELL: Token -> BNB
              return {
                type: 'SELL',
                tokenAddress: firstSwap.tokenIn.toLowerCase(),
                bnbAmount: 0,
                tokenAmount: Number(_amountIn) / 1e18
              };
            } else {
              // Token to token swap - treat as SELL for now
              return {
                type: 'SELL',
                tokenAddress: firstSwap.tokenIn.toLowerCase(),
                bnbAmount: 0,
                tokenAmount: Number(_amountIn) / 1e18
              };
            }
          }
          
          // Fallback for generic swap
          return {
            type: bnbAmount > 0 ? 'BUY' : 'SELL',
            tokenAddress: '0x0000000000000000000000000000000000000000', // Unknown token
            bnbAmount,
            tokenAmount: Number(_amountIn) / 1e18
          };
        } else {
          console.log(`   ⚠️  Unknown SwapX function: ${decoded.functionName}`);
          // Try to analyze using internal transactions for unknown functions
          return await this.analyzeInternalTransactions(tx);
        }
      } catch (swapXError) {
        // Not a SwapX function either - try internal transaction analysis
        console.log(`   ⚠️  SwapX function decoding failed: ${(swapXError as Error).message}`);
        console.log(`   🔍 Trying internal transaction analysis...`);
        return await this.analyzeInternalTransactions(tx);
      }

      // If we get here, it's not a recognized trading function
      // Try to analyze using internal transactions and token transfers
      return await this.analyzeInternalTransactions(tx);
    } catch (error) {
      console.error('Error parsing transaction data:', error);
      return null;
    }
  }

  /**
   * Get actual token amount from transaction logs for BUY transactions
   */
  private static async getTokenAmountFromLogs(tx: any, tokenAddress: string): Promise<number | null> {
    try {
      // Get transaction receipt to access logs
      const receipt = await publicClient.getTransactionReceipt({
        hash: tx.hash as `0x${string}`
      });

      if (!receipt || !receipt.logs) {
        return null;
      }

      const fromAddress = tx.from?.toLowerCase();
      
      // Look for BEP20 Transfer events for the specific token
      const transferLogs = receipt.logs.filter(log => {
        // BEP20 Transfer event signature: Transfer(address,address,uint256)
        return log.topics.length === 3 && 
               log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
               log.address.toLowerCase() === tokenAddress.toLowerCase();
      });

      // Find the transfer TO the user (indicating tokens received)
      for (const log of transferLogs) {
        try {
          const to = '0x' + (log.topics[2]?.slice(26) || '');
          const amount = BigInt(log.data || '0');

          // If tokens are transferred TO the user, this is the amount they received
          if (to.toLowerCase() === fromAddress) {
            console.log(`   📊 Found token transfer TO user: ${amount.toString()} raw units`);
            
            // Get the correct decimals for this token
            const decimals = await this.getTokenDecimals(tokenAddress);
            const divisor = Math.pow(10, decimals);
            const tokenAmount = Number(amount) / divisor;
            
            console.log(`   📊 Token decimals: ${decimals}, calculated amount: ${tokenAmount} tokens`);
            return tokenAmount;
          }
        } catch (logError) {
          console.log(`   ⚠️  Error decoding transfer log: ${logError}`);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting token amount from logs:', error);
      return null;
    }
  }

  /**
   * Get token decimals from contract
   */
  private static async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      // Try to get decimals from the token contract
      const decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            "constant": true,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function"
          }
        ],
        functionName: 'decimals'
      });
      
      console.log(`   📊 Token ${tokenAddress.slice(0, 8)}... has ${decimals} decimals`);
      return Number(decimals);
    } catch (error) {
      console.log(`   ⚠️  Could not get decimals for token ${tokenAddress.slice(0, 8)}..., defaulting to 18`);
      return 18; // Default to 18 decimals if we can't read the contract
    }
  }

  /**
   * Analyze internal transactions and token transfers to determine trade type
   */
  private static async analyzeInternalTransactions(tx: any): Promise<{
    type: 'BUY' | 'SELL';
    tokenAddress: string;
    bnbAmount: number;
    tokenAmount?: number;
  } | null> {
    try {
      console.log(`   🔍 Analyzing internal transactions for tx: ${tx.hash}`);
      
      // Validate transaction hash
      if (!tx.hash) {
        console.log(`   ❌ No transaction hash provided`);
        return null;
      }
      
      // Get transaction receipt to access logs
      const receipt = await publicClient.getTransactionReceipt({
        hash: tx.hash as `0x${string}`
      });

      if (!receipt || !receipt.logs) {
        console.log(`   ❌ No receipt or logs found`);
        return null;
      }

      console.log(`   📊 Found ${receipt.logs.length} log entries`);

      // Look for BEP20 Transfer events
      const transferLogs = receipt.logs.filter(log => {
        // BEP20 Transfer event signature: Transfer(address,address,uint256)
        return log.topics.length === 3 && 
               log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      });

      console.log(`   🔄 Found ${transferLogs.length} BEP20 transfer events`);

      if (transferLogs.length === 0) {
        console.log(`   ❌ No BEP20 transfers found`);
        return null;
      }

      // Analyze the transfer pattern to determine if it's a buy or sell
      const fromAddress = tx.from?.toLowerCase();
      const bnbAmount = Number(tx.value) / 1e18;

      console.log(`   📊 Analysis: from=${fromAddress}, bnbAmount=${bnbAmount.toFixed(6)} BNB`);

      // First, check for SELL patterns (tokens sent FROM user)
      // This takes priority because SELL transactions can also have BNB value for gas/fees
      console.log(`   🔍 Checking for SELL patterns (tokens sent FROM user)...`);
      for (const log of transferLogs) {
        try {
          const from = '0x' + (log.topics[1]?.slice(26) || '');
          const to = '0x' + (log.topics[2]?.slice(26) || '');
          const amount = BigInt(log.data || '0');
          const tokenAddress = log.address.toLowerCase();
          
          console.log(`     🔄 Transfer: ${from.slice(0, 8)}...${from.slice(-8)} → ${to.slice(0, 8)}...${to.slice(-8)}`);
          console.log(`     📊 Amount: ${amount.toString()}, Token: ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`);

          // If tokens are transferred FROM the user, it's likely a SELL
          if (from.toLowerCase() === fromAddress) {
            console.log(`     ✅ SELL PATTERN FOUND: User ${fromAddress.slice(0, 8)}... is sending tokens to ${to.slice(0, 8)}...`);
            console.log(`   📊 Token amount sold: ${amount.toString()} raw units`);
            
            // Get the correct decimals for this token
            const decimals = await this.getTokenDecimals(log.address.toLowerCase());
            const divisor = Math.pow(10, decimals);
            const tokenAmount = Number(amount) / divisor;
            
            console.log(`   📊 Token decimals: ${decimals}, calculated amount: ${tokenAmount} tokens`);
            return {
              type: 'SELL',
              tokenAddress: log.address.toLowerCase(),
              bnbAmount: bnbAmount, // Keep the actual BNB amount (might be for gas/fees)
              tokenAmount
            };
          }
        } catch (logError) {
          console.log(`   ⚠️  Error decoding log: ${logError}`);
          continue;
        }
      }

      // If no SELL pattern found, check for BUY patterns (tokens received BY user)
      console.log(`   🔍 Checking for BUY patterns (tokens received BY user)...`);
      for (const log of transferLogs) {
        try {
          const from = '0x' + (log.topics[1]?.slice(26) || '');
          const to = '0x' + (log.topics[2]?.slice(26) || '');
          const amount = BigInt(log.data || '0');
          const tokenAddress = log.address.toLowerCase();
          
          console.log(`     🔄 Transfer: ${from.slice(0, 8)}...${from.slice(-8)} → ${to.slice(0, 8)}...${to.slice(-8)}`);
          console.log(`     📊 Amount: ${amount.toString()}, Token: ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`);

          // If tokens are transferred TO the user, it's likely a BUY
          if (to.toLowerCase() === fromAddress) {
            console.log(`     ✅ BUY PATTERN FOUND: User ${fromAddress.slice(0, 8)}... received tokens from ${from.slice(0, 8)}...`);
            console.log(`   📊 Token amount received: ${amount.toString()} raw units`);
            
            // Get the correct decimals for this token
            const decimals = await this.getTokenDecimals(log.address.toLowerCase());
            const divisor = Math.pow(10, decimals);
            const tokenAmount = Number(amount) / divisor;
            
            console.log(`   📊 Token decimals: ${decimals}, calculated amount: ${tokenAmount} tokens`);
            return {
              type: 'BUY',
              tokenAddress: log.address.toLowerCase(),
              bnbAmount,
              tokenAmount
            };
          }
        } catch (logError) {
          console.log(`   ⚠️  Error decoding log: ${logError}`);
          continue;
        }
      }

      console.log(`   ❌ NO TRADE PATTERN FOUND: Could not determine if this is a BUY or SELL from internal transactions`);
      return null;
    } catch (error) {
      console.error('Error analyzing internal transactions:', error);
      return null;
    }
  }

  /**
   * Check if a token is allowed for copying
   */
  private static isTokenAllowed(config: CopyTradingConfig, tokenAddress: string): boolean {
    // Check blocked tokens first
    if (config.blockedTokens.includes(tokenAddress.toLowerCase())) {
      return false;
    }

    // If no allowed tokens specified, allow all (except blocked)
    if (config.allowedTokens.length === 0) {
      return true;
    }

    // Check if token is in allowed list
    return config.allowedTokens.includes(tokenAddress.toLowerCase());
  }

  /**
   * Determine the trading platform for a token and validate if it's tradeable
   */
  private static async determineTradingPlatform(tokenAddress: string): Promise<{
    platform: 'four.meme' | 'DEX' | 'unknown';
    isTradeable: boolean;
  }> {
    try {
      console.log(`      🔍 Determining platform for token: ${tokenAddress.slice(0, 8)}...`);
      
      // Validate token address first
      if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
        console.log(`      ❌ Invalid token address: ${tokenAddress}`);
        return {
          platform: 'unknown',
          isTradeable: false
        };
      }

      // Check if token is migrated (not tradeable on four.meme)
      console.log(`      🔍 Getting token info for ${tokenAddress.slice(0, 8)}...`);
      const tokenInfo = await ContractService.getTokenInfo(tokenAddress);
      console.log(`      📊 Token info retrieved: manager=${tokenInfo.tokenManager.slice(0, 8)}..., liquidity=${tokenInfo.liquidityAdded}, offers=${tokenInfo.offers}`);
      
      // If token manager is zero address, it's migrated to DEX
      if (tokenInfo.tokenManager === '0x0000000000000000000000000000000000000000') {
        console.log(`      ✅ Token ${tokenAddress.slice(0, 8)}... has zero token manager - likely migrated to DEX`);
        return {
          platform: 'DEX',
          isTradeable: true // Can be traded on PancakeSwap
        };
      }

      // Check if we can get buy parameters (token is tradeable on four.meme)
      console.log(`      🔍 Testing buy params for ${tokenAddress.slice(0, 8)}...`);
      try {
        await ContractService.getBuyParams(tokenAddress, '0.001');
        console.log(`      ✅ Token ${tokenAddress.slice(0, 8)}... is tradeable on four.meme`);
        return {
          platform: 'four.meme',
          isTradeable: true
        };
      } catch (error) {
        // If four.meme fails, check if it's a known migration pattern
        console.log(`      ⚠️  Token ${tokenAddress.slice(0, 8)}... buy params failed:`, (error as Error).message);
        
        // Check for specific migration indicators
        if (tokenInfo.liquidityAdded && tokenInfo.offers === 0n) {
          console.log(`      ✅ Token ${tokenAddress.slice(0, 8)}... has liquidity but no offers - likely migrated to DEX`);
          return {
            platform: 'DEX',
            isTradeable: true // Can be traded on PancakeSwap
          };
        }
        
        // If we can't determine, assume it's not tradeable
        console.log(`      ❌ Token ${tokenAddress.slice(0, 8)}... could not determine platform - assuming not tradeable`);
        return {
          platform: 'unknown',
          isTradeable: false
        };
      }
    } catch (error) {
      console.error(`Error determining platform for token ${tokenAddress}:`, error);
      return {
        platform: 'unknown',
        isTradeable: false
      };
    }
  }


  /**
   * Execute the copy trade
   */
  private static async executeCopyTrade(userId: string, copyTrade: CopyTrade): Promise<void> {
    try {
      // Determine platform for this trade
      const platformInfo = await this.determineTradingPlatform(copyTrade.tokenAddress);
      
      console.log(`🔍 Testing mode status: ${this.testingMode}`);
      
      if (this.testingMode) {
        const timestamp = new Date().toLocaleString();
        console.log(`\n🧪 [${timestamp}] COPY SIMULATION`);
        console.log(`   🔄 Action: ${copyTrade.tradeType}`);
        console.log(`   💰 Amount: ${copyTrade.copiedAmount.toFixed(6)} BNB`);
        console.log(`   🏢 Platform: ${platformInfo.platform}`);
        console.log(`   ⚠️  SIMULATION MODE - No real trade executed`);
        
        // Mark as executed in testing mode
        copyTrade.status = 'EXECUTED';
        copyTrade.ourTxHash = 'SIMULATION_MODE';
        this.activeTrades.set(copyTrade.id, copyTrade);
        return;
      }

      console.log(`🚀 REAL TRADING MODE - Executing actual trade`);

      console.log(`🔄 Executing copy trade: ${copyTrade.tradeType} ${copyTrade.copiedAmount} BNB on ${platformInfo.platform}`);

      if (copyTrade.tradeType === 'BUY') {
        const result = await TradingService.buyTokens(
          copyTrade.tokenAddress,
          copyTrade.copiedAmount,
          userId
        );

        if (result.success) {
          copyTrade.status = 'EXECUTED';
          copyTrade.ourTxHash = result.data?.txHash;
          console.log(`✅ Copy buy executed: ${result.data?.txHash}`);
          console.log(`   📊 Used ${result.data?.successCount}/${result.data?.totalWallets} wallets`);
          
          // Start price tracking for this token
          // Note: We'll need to get the actual buy price and token amount from the transaction
          // For now, we'll use estimated values based on the copy amount
          try {
            // Get current price to estimate token amount
            const priceService = DirectPriceService.getInstance();
            const priceResult = await priceService.getFourMemeExactPrice(copyTrade.tokenAddress);
            
            if (priceResult.success && priceResult.data) {
              const estimatedTokenAmount = copyTrade.copiedAmount / priceResult.data.avgPrice;
              
              // Log copy buy transaction to CSV
              await this.csvLogger.logBuyTransaction({
                tokenAddress: copyTrade.tokenAddress,
                tokenName: 'Unknown',
                tokenCreator: 'Unknown',
                platform: platformInfo.platform as 'four.meme' | 'PancakeSwap',
                buyAmountBNB: copyTrade.copiedAmount,
                tokenAmount: estimatedTokenAmount,
                buyPriceBNB: priceResult.data.avgPrice,
                buyPriceUSD: priceResult.data.priceUSD,
                maxPriceReachedBNB: priceResult.data.avgPrice,
                maxPriceReachedUSD: priceResult.data.priceUSD,
                priceChangePercent: 0,
                maxPriceChangePercent: 0,
                buyTime: new Date(),
                userId,
                walletAddress: '0x50d1C20D42e4535123Ff3a8889Cbc2a7A1397F45'
              });
              
              await this.priceTrackingService.startTrackingToken(
                copyTrade.tokenAddress,
                priceResult.data.avgPrice, // Price in BNB
                priceResult.data.priceUSD, // USD price
                copyTrade.copiedAmount, // BNB amount spent
                estimatedTokenAmount, // Estimated token amount received
                userId,
                '0x50d1C20D42e4535123Ff3a8889Cbc2a7A1397F45' // Use your wallet address for copy trading
              );
              console.log(`📈 Started price tracking for copied token`);
            } else {
              console.log(`⚠️ Could not get price for tracking, skipping price tracking setup`);
            }
          } catch (error) {
            console.error(`⚠️ Failed to start price tracking:`, error);
          }
          
          // Send Telegram alert
          await TelegramBotService.sendCopyTradeAlert({
            type: 'BUY',
            tokenAddress: copyTrade.tokenAddress,
            bnbAmount: copyTrade.copiedAmount,
            tokenAmount: copyTrade.tokenAmount,
            targetWallet: 'Unknown', // We'll get this from context
            copyAmount: copyTrade.copiedAmount,
            txHash: result.data?.txHash
          });
        } else {
          copyTrade.status = 'FAILED';
          console.error(`❌ Copy buy failed: ${result.error}`);
          
          // Provide specific guidance based on error type
          if (result.error?.includes('Insufficient funds')) {
            console.log(`   💡 Suggestion: Fund your wallets with BNB to cover gas fees and trade amounts`);
          } else if (result.error?.includes('migrated to PancakeSwap')) {
            console.log(`   💡 Suggestion: This token is no longer tradeable on four.meme. Use PancakeSwap directly.`);
          } else if (result.error?.includes('Failed to prepare any transactions')) {
            console.log(`   💡 Suggestion: Check wallet balances and ensure wallets have sufficient BNB for gas fees`);
          }
        }
      } else if (copyTrade.tradeType === 'SELL') {
        console.log(`🔄 Executing SELL copy trade for token ${copyTrade.tokenAddress.slice(0, 8)}...`);
        // For sell, we need to check if we have tokens to sell
        const sellResult = await this.executeSellCopy(userId, copyTrade);
        
        if (sellResult.success) {
          copyTrade.status = 'EXECUTED';
          copyTrade.ourTxHash = sellResult.txHash;
          console.log(`✅ Copy sell executed: ${sellResult.txHash}`);
          
          // Trigger copy sell in price tracking service
          try {
            // For copy sell, sell 100% of tokens
            await this.priceTrackingService.copySellToken(
              copyTrade.tokenAddress,
              userId,
              100 // Always sell 100% when copying a SELL transaction
            );
            console.log(`📈 Triggered copy sell in price tracking service`);
          } catch (error) {
            console.error(`⚠️ Failed to trigger copy sell in price tracking:`, error);
          }
          
          // Send Telegram alert
          await TelegramBotService.sendCopyTradeAlert({
            type: 'SELL',
            tokenAddress: copyTrade.tokenAddress,
            bnbAmount: 0, // Sell doesn't use BNB input
            tokenAmount: copyTrade.tokenAmount,
            targetWallet: 'Unknown', // We'll get this from context
            copyAmount: 0, // Sell percentage is different
            txHash: sellResult.txHash
          });
        } else {
          copyTrade.status = 'FAILED';
          console.error(`❌ Copy sell failed: ${sellResult.error}`);
        }
      }

      this.activeTrades.set(copyTrade.id, copyTrade);
    } catch (error) {
      console.error('Error executing copy trade:', error);
      copyTrade.status = 'FAILED';
      this.activeTrades.set(copyTrade.id, copyTrade);
    }
  }

  /**
   * Get copy trading status for a user
   */
  static getCopyTradingStatus(userId: string): {
    isEnabled: boolean;
    config?: CopyTradingConfig;
    activeTrades: CopyTrade[];
  } {
    const config = this.configs.get(userId);
    const userTrades = Array.from(this.activeTrades.values())
      .filter(trade => trade.id.startsWith(userId));

    return {
      isEnabled: !!config?.enabled,
      config,
      activeTrades: userTrades
    };
  }

  /**
   * Disable copy trading for a user
   */
  static disableCopyTrading(userId: string): void {
    const config = this.configs.get(userId);
    if (config) {
      config.enabled = false;
      this.configs.set(userId, config);
    }
  }

  /**
   * Enable copy trading for a user
   */
  static enableCopyTrading(userId: string): void {
    const config = this.configs.get(userId);
    if (config) {
      config.enabled = true;
      this.configs.set(userId, config);
    }
  }

  /**
   * Set testing mode (disables actual trading)
   */
  static setTestingMode(enabled: boolean): void {
    this.testingMode = enabled;
    console.log(`🧪 Testing mode ${enabled ? 'ENABLED' : 'DISABLED'} - ${enabled ? 'No actual trades will be executed' : 'Trades will be executed'}`);
  }

  /**
   * Check if testing mode is enabled
   */
  static isTestingMode(): boolean {
    return this.testingMode;
  }

  /**
   * Execute sell copy trade
   */
  private static async executeSellCopy(userId: string, copyTrade: CopyTrade): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Get user's wallets
      const wallets = await WalletService.getWallets(userId);
      if (!wallets.success || !wallets.data || wallets.data.wallets.length === 0) {
        return { success: false, error: 'No wallets found' };
      }

      // Find wallets that have this token
      const walletsWithToken = [];
      for (const wallet of wallets.data.wallets) {
        try {
          const balance = await ContractService.getTokenBalance(copyTrade.tokenAddress, wallet.address);
          if (balance > 0n) {
            walletsWithToken.push({
              address: wallet.address,
              balance: balance
            });
          }
        } catch (error) {
          // Skip this wallet if there's an error
          continue;
        }
      }

      if (walletsWithToken.length === 0) {
        return { success: false, error: 'No tokens to sell' };
      }

      // For SELL copy trades, sell ALL tokens (100%)
      // Copy ratio is not used for sell transactions
      const totalTokens = walletsWithToken.reduce((sum, wallet) => sum + wallet.balance, 0n);
      const sellPercentage = 100; // Always sell 100% when copying a SELL transaction

      if (totalTokens === 0n) {
        return { success: false, error: 'No tokens to sell' };
      }

      console.log(`🔄 Copy selling ${sellPercentage}% of ${totalTokens.toString()} tokens`);
      console.log(`   Token: ${copyTrade.tokenAddress}`);
      console.log(`   Wallets with tokens: ${walletsWithToken.length}`);

      // Execute sell transaction using the first wallet with tokens
      const sellResult = await TradingService.sellTokens(
        copyTrade.tokenAddress,
        sellPercentage,
        userId
      );

      console.log(`   Sell result: ${sellResult.success ? 'SUCCESS' : 'FAILED'}`);
      if (!sellResult.success) {
        console.log(`   Error: ${sellResult.error}`);
      }

      if (sellResult.success) {
        return { success: true, txHash: sellResult.data?.txHash };
      } else {
        return { success: false, error: sellResult.error };
      }
    } catch (error) {
      console.error('Error executing sell copy:', error);
      return { success: false, error: 'Failed to execute sell copy' };
    }
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get price tracking service instance
   */
  static getPriceTrackingService(): PriceTrackingService {
    return this.priceTrackingService;
  }

  /**
   * Get tracked tokens for a user
   */
  static getTrackedTokens(userId: string) {
    return this.priceTrackingService.getTrackedTokens(userId);
  }

  /**
   * Get all tracked tokens
   */
  static getAllTrackedTokens() {
    return this.priceTrackingService.getAllTrackedTokens();
  }

  /**
   * Update price tracking configuration
   */
  static updatePriceTrackingConfig(config: any) {
    this.priceTrackingService.updateConfig(config);
  }

  /**
   * Get price tracking configuration
   */
  static getPriceTrackingConfig() {
    return this.priceTrackingService.getConfig();
  }

  /**
   * Manually remove a token from price tracking
   */
  static async removeTokenFromTracking(tokenAddress: string, userId: string, walletAddress: string) {
    return await this.priceTrackingService.removeToken(tokenAddress, userId, walletAddress);
  }

  /**
   * Get price tracking statistics
   */
  static getPriceTrackingStats() {
    return this.priceTrackingService.getTrackingStats();
  }
}

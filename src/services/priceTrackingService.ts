import { DirectPriceService } from './directPriceService';
import { TradingService } from './trading';
import { TelegramBotService } from './telegramBot';
import { CSVLogger } from './csvLogger';

export interface TrackedToken {
  tokenAddress: string;
  buyPrice: number; // Price when bought (in BNB)
  buyPriceUSD: number; // Price when bought (in USD)
  buyAmount: number; // BNB amount spent
  tokenAmount: number; // Token amount received
  buyTime: Date;
  currentPrice: number; // Current price (in BNB)
  currentPriceUSD: number; // Current price (in USD)
  priceChangePercent: number; // Price change percentage
  maxPriceReached: number; // Highest price reached since buying
  maxPriceReachedUSD: number; // Highest price reached in USD
  maxPriceChangePercent: number; // Maximum price increase percentage
  maxPriceTime?: Date; // Time when max price was reached
  lastUpdated: Date;
  userId: string;
  walletAddress: string;
  isActive: boolean; // Whether still being tracked
}

export interface PriceTrackingConfig {
  sellAt10Percent: boolean; // Sell 50% at 10% increase
  sellAt50Percent: boolean; // Sell 100% at 50% increase
  timeWindow10Percent: number; // Time window for 10% check (seconds)
  timeWindow50Percent: number; // Time window for 50% check (seconds)
  enabled: boolean;
  updateInterval: number; // Price update interval (milliseconds)
}

export class PriceTrackingService {
  private static instance: PriceTrackingService;
  private trackedTokens: Map<string, TrackedToken> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private priceService: DirectPriceService;
  private csvLogger: CSVLogger;
  private config: PriceTrackingConfig = {
    sellAt10Percent: true,
    sellAt50Percent: true,
    timeWindow10Percent: 10, // 10 seconds
    timeWindow50Percent: 20, // 20 seconds
    enabled: true,
    updateInterval: 1000 // 2 seconds
  };

  constructor() {
    this.priceService = DirectPriceService.getInstance();
    this.csvLogger = CSVLogger.getInstance();
  }

  static getInstance(): PriceTrackingService {
    if (!PriceTrackingService.instance) {
      PriceTrackingService.instance = new PriceTrackingService();
    }
    return PriceTrackingService.instance;
  }

  /**
   * Start tracking a token after a successful buy
   */
  async startTrackingToken(
    tokenAddress: string,
    buyPrice: number,
    buyPriceUSD: number,
    buyAmount: number,
    tokenAmount: number,
    userId: string,
    walletAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenKey = `${tokenAddress.toLowerCase()}_${userId}_${walletAddress.toLowerCase()}`;
      
      // Check if already tracking this token for this user/wallet
      if (this.trackedTokens.has(tokenKey)) {
        return { success: false, error: 'Token already being tracked for this user/wallet' };
      }

      const trackedToken: TrackedToken = {
        tokenAddress: tokenAddress.toLowerCase(),
        buyPrice,
        buyPriceUSD,
        buyAmount,
        tokenAmount,
        buyTime: new Date(),
        currentPrice: buyPrice,
        currentPriceUSD: buyPriceUSD,
        priceChangePercent: 0,
        maxPriceReached: buyPrice,
        maxPriceReachedUSD: buyPriceUSD,
        maxPriceChangePercent: 0,
        maxPriceTime: new Date(), // Initially set to buy time
        lastUpdated: new Date(),
        userId,
        walletAddress: walletAddress.toLowerCase(),
        isActive: true
      };

      this.trackedTokens.set(tokenKey, trackedToken);
      
      console.log(`📈 Started tracking token: ${tokenAddress.slice(0, 8)}...`);
      console.log(`   💰 Buy price: ${buyPrice.toFixed(8)} BNB ($${buyPriceUSD.toFixed(4)})`);
      console.log(`   🪙 Amount: ${tokenAmount.toFixed(2)} tokens`);
      console.log(`   👤 User: ${userId}`);
      console.log(`   🏦 Wallet: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`);

      // Log buy transaction to CSV
      await this.csvLogger.logBuyTransaction({
        tokenAddress,
        tokenName: 'Unknown', // We'll need to get this from token contract
        tokenCreator: 'Unknown', // We'll need to get this from token contract
        platform: 'four.meme', // Default, will be updated based on actual trading
        buyAmountBNB: buyAmount,
        tokenAmount,
        buyPriceBNB: buyPrice,
        buyPriceUSD,
        maxPriceReachedBNB: buyPrice,
        maxPriceReachedUSD: buyPriceUSD,
        priceChangePercent: 0,
        maxPriceChangePercent: 0,
        buyTime: new Date(),
        userId,
        walletAddress
      });

      // Start monitoring if not already running
      if (!this.isMonitoring) {
        this.startMonitoring();
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error starting token tracking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start monitoring all tracked tokens
   */
  private startMonitoring(): void {
    if (this.isMonitoring || !this.config.enabled) return;

    this.isMonitoring = true;
    console.log('🚀 Price tracking monitoring started');
    console.log(`📊 Tracking ${this.trackedTokens.size} token(s)`);
    console.log(`⏱️  Update interval: ${this.config.updateInterval}ms`);
    console.log(`🎯 Sell triggers: 10% (${this.config.timeWindow10Percent}s), 50% (${this.config.timeWindow50Percent}s)`);
    console.log('');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateAllTokenPrices();
      } catch (error) {
        console.error('Error in price tracking monitoring:', error);
      }
    }, this.config.updateInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Price tracking monitoring stopped');
  }

  /**
   * Update prices for all tracked tokens
   */
  private async updateAllTokenPrices(): Promise<void> {
    const activeTokens = Array.from(this.trackedTokens.values()).filter(token => token.isActive);
    
    if (activeTokens.length === 0) {
      return;
    }

    console.log(`🔍 Updating prices for ${activeTokens.length} tracked token(s)...`);

    for (const token of activeTokens) {
      try {
        await this.updateTokenPrice(token);
      } catch (error) {
        console.error(`Error updating price for token ${token.tokenAddress}:`, error);
      }
    }
  }

  /**
   * Update price for a specific token
   */
  private async updateTokenPrice(token: TrackedToken): Promise<void> {
    try {
      // First, check if the token balance is zero (manually sold)
      const hasBalance = await this.checkTokenBalance(token);
      if (!hasBalance) {
        console.log(`🛑 Token ${token.tokenAddress.slice(0, 8)}... manually sold - stopping tracking`);
        await this.removeTokenFromTracking(token);
        return;
      }

      // Get current price using the enhanced price service
      const priceResult = await this.priceService.getFourMemeExactPrice(token.tokenAddress);
      
      if (!priceResult.success || !priceResult.data) {
        console.log(`⚠️ Could not get price for ${token.tokenAddress.slice(0, 8)}...`);
        return;
      }

      const currentPrice = priceResult.data.avgPrice;
      const currentPriceUSD = priceResult.data.priceUSD;
      
      // Calculate price change percentage
      const priceChangePercent = ((currentPrice - token.buyPrice) / token.buyPrice) * 100;
      
      // Update max price reached
      let maxPriceReached = token.maxPriceReached;
      let maxPriceReachedUSD = token.maxPriceReachedUSD;
      let maxPriceChangePercent = token.maxPriceChangePercent;
      let maxPriceTime = token.maxPriceReached === token.buyPrice ? undefined : token.maxPriceTime;
      
      if (currentPrice > token.maxPriceReached) {
        maxPriceReached = currentPrice;
        maxPriceReachedUSD = currentPriceUSD;
        maxPriceChangePercent = priceChangePercent;
        maxPriceTime = new Date();
        
        // Calculate time to max price
        const timeToMaxPrice = (maxPriceTime.getTime() - token.buyTime.getTime()) / 1000;
        
        // Log max price update to CSV
        await this.csvLogger.updateMaxPrice({
          tokenAddress: token.tokenAddress,
          userId: token.userId,
          walletAddress: token.walletAddress,
          maxPriceReachedBNB: maxPriceReached,
          maxPriceReachedUSD: maxPriceReachedUSD,
          maxPriceChangePercent: maxPriceChangePercent,
          timeToMaxPriceSeconds: timeToMaxPrice,
          maxPriceTime: maxPriceTime
        });
      }

      // Update token data
      token.currentPrice = currentPrice;
      token.currentPriceUSD = currentPriceUSD;
      token.priceChangePercent = priceChangePercent;
      token.maxPriceReached = maxPriceReached;
      token.maxPriceReachedUSD = maxPriceReachedUSD;
      token.maxPriceChangePercent = maxPriceChangePercent;
      token.lastUpdated = new Date();

      // Log price update
      const priceChangeEmoji = priceChangePercent > 0 ? '📈' : priceChangePercent < 0 ? '📉' : '➡️';
      console.log(`${priceChangeEmoji} ${token.tokenAddress.slice(0, 8)}...: ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`);

      // Check for sell triggers
      await this.checkSellTriggers(token);

    } catch (error: any) {
      console.error(`Error updating price for token ${token.tokenAddress}:`, error.message);
    }
  }

  /**
   * Check if sell triggers should be activated
   */
  private async checkSellTriggers(token: TrackedToken): Promise<void> {
    const now = new Date();
    const timeSinceBuy = (now.getTime() - token.buyTime.getTime()) / 1000; // seconds

    // Check 10% increase trigger (within time window)
    if (this.config.sellAt10Percent && 
        token.priceChangePercent >= 10 && 
        timeSinceBuy <= this.config.timeWindow10Percent) {
      
      console.log(`🎯 10% INCREASE TRIGGER ACTIVATED!`);
      console.log(`   Token: ${token.tokenAddress.slice(0, 8)}...`);
      console.log(`   Price change: +${token.priceChangePercent.toFixed(2)}%`);
      console.log(`   Time since buy: ${timeSinceBuy.toFixed(1)}s`);
      console.log(`   Action: Selling 50% of tokens`);
      
      await this.executePartialSell(token, 50); // Sell 50%
    }

    // Check 50% increase trigger (within time window)
    if (this.config.sellAt50Percent && 
        token.priceChangePercent >= 50 && 
        timeSinceBuy <= this.config.timeWindow50Percent) {
      
      console.log(`🎯 50% INCREASE TRIGGER ACTIVATED!`);
      console.log(`   Token: ${token.tokenAddress.slice(0, 8)}...`);
      console.log(`   Price change: +${token.priceChangePercent.toFixed(2)}%`);
      console.log(`   Time since buy: ${timeSinceBuy.toFixed(1)}s`);
      console.log(`   Action: Selling 100% of tokens`);
      
      await this.executeFullSell(token); // Sell 100%
    }
  }

  /**
   * Execute partial sell (percentage of tokens)
   */
  private async executePartialSell(token: TrackedToken, percentage: number): Promise<void> {
    try {
      console.log(`🔄 Executing ${percentage}% sell for token ${token.tokenAddress.slice(0, 8)}...`);
      
      const sellResult = await TradingService.sellTokens(
        token.tokenAddress,
        percentage,
        token.userId
      );

      if (sellResult.success) {
        console.log(`✅ Successfully sold ${percentage}% of tokens`);
        console.log(`   Transaction: ${sellResult.data?.txHash}`);
        
        // Calculate sell amount and profit/loss
        const sellAmountBNB = token.buyAmount * (percentage / 100);
        const sellAmountUSD = sellAmountBNB * (token.currentPriceUSD / token.buyPriceUSD);
        const profitLossBNB = sellAmountBNB - (token.buyAmount * (percentage / 100));
        const profitLossUSD = sellAmountUSD - (token.buyPriceUSD * (percentage / 100));
        
        // Log sell transaction to CSV
        await this.csvLogger.logSellTransaction({
          tokenAddress: token.tokenAddress,
          userId: token.userId,
          walletAddress: token.walletAddress,
          platform: 'four.meme', // Will be updated based on actual platform used
          buyAmountBNB: token.buyAmount,
          sellAmountBNB: sellAmountBNB,
          tokenAmount: token.tokenAmount,
          buyPriceBNB: token.buyPrice,
          buyPriceUSD: token.buyPriceUSD,
          sellPriceBNB: token.currentPrice,
          sellPriceUSD: token.currentPriceUSD,
          maxPriceReachedBNB: token.maxPriceReached,
          maxPriceReachedUSD: token.maxPriceReachedUSD,
          profitLossBNB: profitLossBNB,
          profitLossUSD: profitLossUSD,
          priceChangePercent: token.priceChangePercent,
          maxPriceChangePercent: token.maxPriceChangePercent,
          buyTime: token.buyTime,
          sellTime: new Date(),
          buyTxHash: 'Unknown', // We'll need to track this
          sellTxHash: sellResult.data?.txHash
        });
        
        // Update token amount (reduce by sold percentage)
        token.tokenAmount = token.tokenAmount * (1 - percentage / 100);
        
        // Send Telegram notification
        try {
          await (TelegramBotService as any).sendPriceTrackingAlert({
            type: 'PARTIAL_SELL',
            tokenAddress: token.tokenAddress,
            percentage,
            priceChange: token.priceChangePercent,
            currentPrice: token.currentPrice,
            currentPriceUSD: token.currentPriceUSD,
            txHash: sellResult.data?.txHash
          });
        } catch (error) {
          console.log('⚠️ Failed to send Telegram notification:', error);
        }

      } else {
        console.error(`❌ Failed to sell ${percentage}% of tokens: ${sellResult.error}`);
      }
    } catch (error: any) {
      console.error(`Error executing partial sell:`, error.message);
    }
  }

  /**
   * Execute full sell (100% of tokens)
   */
  private async executeFullSell(token: TrackedToken): Promise<void> {
    try {
      console.log(`🔄 Executing 100% sell for token ${token.tokenAddress.slice(0, 8)}...`);
      
      const sellResult = await TradingService.sellTokens(
        token.tokenAddress,
        100, // Sell 100%
        token.userId
      );

      if (sellResult.success) {
        console.log(`✅ Successfully sold 100% of tokens`);
        console.log(`   Transaction: ${sellResult.data?.txHash}`);
        
        // Remove token from tracking
        await this.removeTokenFromTracking(token);
        
        // Send Telegram notification
        try {
          await (TelegramBotService as any).sendPriceTrackingAlert({
            type: 'FULL_SELL',
            tokenAddress: token.tokenAddress,
            percentage: 100,
            priceChange: token.priceChangePercent,
            currentPrice: token.currentPrice,
            currentPriceUSD: token.currentPriceUSD,
            txHash: sellResult.data?.txHash
          });
        } catch (error) {
          console.log('⚠️ Failed to send Telegram notification:', error);
        }

      } else {
        console.error(`❌ Failed to sell 100% of tokens: ${sellResult.error}`);
      }
    } catch (error: any) {
      console.error(`Error executing full sell:`, error.message);
    }
  }

  /**
   * Copy sell when target wallet sells (called from CopyTradingService)
   */
  async copySellToken(tokenAddress: string, userId: string, sellPercentage: number): Promise<void> {
    try {
      console.log(`🔄 Copy sell triggered for token ${tokenAddress.slice(0, 8)}...`);
      
      // Find all tracked instances of this token for this user
      const tokenInstances = Array.from(this.trackedTokens.values())
        .filter(token => 
          token.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && 
          token.userId === userId && 
          token.isActive
        );

      if (tokenInstances.length === 0) {
        console.log(`⚠️ No tracked instances found for token ${tokenAddress.slice(0, 8)}...`);
        return;
      }

      console.log(`📊 Found ${tokenInstances.length} tracked instance(s) for copy sell`);

      // Execute sell for each tracked instance
      for (const token of tokenInstances) {
        try {
          const sellResult = await TradingService.sellTokens(
            token.tokenAddress,
            sellPercentage,
            token.userId
          );

          if (sellResult.success) {
            console.log(`✅ Copy sell executed for tracked token`);
            console.log(`   Transaction: ${sellResult.data?.txHash}`);
            
            // Update token amount
            token.tokenAmount = token.tokenAmount * (1 - sellPercentage / 100);
            
            // If sold 100%, remove from tracking
            if (sellPercentage >= 100) {
              await this.removeTokenFromTracking(token);
            }
            
            // Send Telegram notification
            try {
              await (TelegramBotService as any).sendPriceTrackingAlert({
                type: 'COPY_SELL',
                tokenAddress: token.tokenAddress,
                percentage: sellPercentage,
                priceChange: token.priceChangePercent,
                currentPrice: token.currentPrice,
                currentPriceUSD: token.currentPriceUSD,
                txHash: sellResult.data?.txHash
              });
            } catch (error) {
              console.log('⚠️ Failed to send Telegram notification:', error);
            }

          } else {
            console.error(`❌ Copy sell failed: ${sellResult.error}`);
          }
        } catch (error: any) {
          console.error(`Error in copy sell for token ${token.tokenAddress}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('Error executing copy sell:', error);
    }
  }

  /**
   * Check if the wallet still has tokens (detect manual sales)
   */
  private async checkTokenBalance(token: TrackedToken): Promise<boolean> {
    try {
      const { publicClient } = await import('../utils/web3.js');
      const { ERC20_ABI } = await import('../contracts/abis.js');
      
      // Get token balance for the wallet
      const balance = await publicClient.readContract({
        address: token.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [token.walletAddress as `0x${string}`]
      });

      // If balance is 0 or very close to 0, consider it sold
      const balanceThreshold = BigInt(1000); // 1000 wei threshold (very small amount)
      const hasBalance = balance > balanceThreshold;
      
      if (!hasBalance) {
        console.log(`   💰 Wallet balance: ${balance.toString()} (sold)`);
      }
      
      return hasBalance;
    } catch (error) {
      console.error(`Error checking token balance for ${token.tokenAddress}:`, error);
      // If we can't check the balance, assume it still exists to avoid false removals
      return true;
    }
  }

  /**
   * Remove token from tracking
   */
  private async removeTokenFromTracking(token: TrackedToken): Promise<void> {
    const tokenKey = `${token.tokenAddress.toLowerCase()}_${token.userId}_${token.walletAddress.toLowerCase()}`;
    
    this.trackedTokens.delete(tokenKey);
    token.isActive = false;
    
    console.log(`🗑️ Removed token from tracking: ${token.tokenAddress.slice(0, 8)}...`);
    console.log(`   Final price: ${token.currentPrice.toFixed(8)} BNB ($${token.currentPriceUSD.toFixed(4)})`);
    console.log(`   Max price reached: ${token.maxPriceReached.toFixed(8)} BNB ($${token.maxPriceReachedUSD.toFixed(4)})`);
    console.log(`   Max price change: +${token.maxPriceChangePercent.toFixed(2)}%`);
  }

  /**
   * Get all tracked tokens for a user
   */
  getTrackedTokens(userId: string): TrackedToken[] {
    return Array.from(this.trackedTokens.values())
      .filter(token => token.userId === userId && token.isActive);
  }

  /**
   * Get all tracked tokens
   */
  getAllTrackedTokens(): TrackedToken[] {
    return Array.from(this.trackedTokens.values())
      .filter(token => token.isActive);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PriceTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📝 Price tracking configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): PriceTrackingConfig {
    return { ...this.config };
  }

  /**
   * Check if a token is being tracked
   */
  isTokenTracked(tokenAddress: string, userId: string, walletAddress: string): boolean {
    const tokenKey = `${tokenAddress.toLowerCase()}_${userId}_${walletAddress.toLowerCase()}`;
    const token = this.trackedTokens.get(tokenKey);
    return token ? token.isActive : false;
  }

  /**
   * Manually remove a token from tracking
   */
  async removeToken(tokenAddress: string, userId: string, walletAddress: string): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenKey = `${tokenAddress.toLowerCase()}_${userId}_${walletAddress.toLowerCase()}`;
      const token = this.trackedTokens.get(tokenKey);
      
      if (!token) {
        return { success: false, error: 'Token not found in tracking' };
      }

      await this.removeTokenFromTracking(token);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove all tracking for a specific token (across all users/wallets)
   * Useful when you've sold all tokens and want to stop tracking
   */
  async removeAllTokenTracking(tokenAddress: string): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      const tokenAddressLower = tokenAddress.toLowerCase();
      const tokensToRemove: TrackedToken[] = [];
      
      // Find all tracked instances of this token
      for (const [, token] of this.trackedTokens) {
        if (token.tokenAddress === tokenAddressLower) {
          tokensToRemove.push(token);
        }
      }
      
      if (tokensToRemove.length === 0) {
        return { success: false, removedCount: 0, error: 'No tracking found for this token' };
      }
      
      // Remove all instances
      for (const token of tokensToRemove) {
        await this.removeTokenFromTracking(token);
      }
      
      console.log(`🛑 Stopped tracking ${tokensToRemove.length} instance(s) of token: ${tokenAddress.slice(0, 8)}...`);
      
      return { success: true, removedCount: tokensToRemove.length };
    } catch (error: any) {
      return { success: false, removedCount: 0, error: error.message };
    }
  }

  /**
   * Force stop tracking a token by address (useful when manually sold)
   */
  async forceStopTracking(tokenAddress: string, userId?: string): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      const tokenAddressLower = tokenAddress.toLowerCase();
      const tokensToRemove: TrackedToken[] = [];
      
      // Find all tracked instances of this token
      for (const [, token] of this.trackedTokens) {
        if (token.tokenAddress === tokenAddressLower && 
            (!userId || token.userId === userId)) {
          tokensToRemove.push(token);
        }
      }
      
      if (tokensToRemove.length === 0) {
        return { success: false, removedCount: 0, error: 'No tracking found for this token' };
      }
      
      // Remove all instances
      for (const token of tokensToRemove) {
        await this.removeTokenFromTracking(token);
      }
      
      console.log(`🛑 Force stopped tracking ${tokensToRemove.length} instance(s) of token: ${tokenAddress.slice(0, 8)}...`);
      
      return { success: true, removedCount: tokensToRemove.length };
    } catch (error: any) {
      return { success: false, removedCount: 0, error: error.message };
    }
  }

  /**
   * Get tracking statistics
   */
  getTrackingStats(): {
    totalTracked: number;
    activeTracked: number;
    totalUsers: number;
    averagePriceChange: number;
  } {
    const activeTokens = Array.from(this.trackedTokens.values()).filter(token => token.isActive);
    const uniqueUsers = new Set(activeTokens.map(token => token.userId));
    const averagePriceChange = activeTokens.length > 0 
      ? activeTokens.reduce((sum, token) => sum + token.priceChangePercent, 0) / activeTokens.length 
      : 0;

    return {
      totalTracked: this.trackedTokens.size,
      activeTracked: activeTokens.length,
      totalUsers: uniqueUsers.size,
      averagePriceChange
    };
  }
}

// Simple UUID generator (no external dependency needed)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
import { TradingService } from './trading';
import { ContractService } from './contracts';
import { ValidationUtils } from '../utils/validation';
import { config } from '../config';
import { 
  AutoTradingOrder, 
  ApiResponse
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Auto Trading Service
 * Features:
 * - Price monitoring
 * - Order management
 * - Automatic execution
 * - Risk management
 */
export class AutoTradingService {
  private orders: Map<string, AutoTradingOrder> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data', 'autoTrading');
    this.ensureDataDirectory();
    this.loadOrders();
    this.startPriceMonitoring();
  }

  /**
   * Create a new auto trading order
   */
  async createOrder(
    userId: string,
    tokenAddress: string,
    orderType: 'BUY' | 'SELL',
    triggerPrice: number,
    amount: number,
    profitTarget?: number,
    stopLoss?: number
  ): Promise<ApiResponse<AutoTradingOrder>> {
    try {
      // Validate input
      const validation = this.validateOrderInput({
        tokenAddress,
        triggerPrice,
        amount,
        orderType,
        profitTarget,
        stopLoss
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          timestamp: new Date()
        };
      }

      // Check if user has reached max orders
      const userOrders = this.getUserOrders(userId);
      if (userOrders.length >= config.autoTrading.maxOrdersPerUser) {
        return {
          success: false,
          error: `Maximum ${config.autoTrading.maxOrdersPerUser} orders allowed per user`,
          timestamp: new Date()
        };
      }

      // Get token info
      const tokenInfo = await ContractService.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        return {
          success: false,
          error: 'Token not found or invalid',
          timestamp: new Date()
        };
      }

      // Get token symbol
      const tokenSymbol = await ContractService.getTokenSymbol(tokenAddress);

      // Create order
      const order: AutoTradingOrder = {
        id: generateUUID(),
        userId,
        tokenAddress: tokenAddress.toLowerCase(),
        tokenSymbol: tokenSymbol || 'UNKNOWN',
        orderType,
        triggerPrice,
        amount,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        profitTarget,
        stopLoss
      };

      // Save order
      this.orders.set(order.id, order);
      await this.saveOrders();

      return {
        success: true,
        data: order,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error creating auto trading order:', error);
      return {
        success: false,
        error: `Failed to create order: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get user's orders
   */
  getUserOrders(userId: string): AutoTradingOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get active orders for a token
   */
  getActiveOrdersForToken(tokenAddress: string): AutoTradingOrder[] {
    return Array.from(this.orders.values())
      .filter(order => 
        order.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && 
        order.isActive
      );
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const order = this.orders.get(orderId);
      
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          timestamp: new Date()
        };
      }

      if (order.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized',
          timestamp: new Date()
        };
      }

      if (!order.isActive) {
        return {
          success: false,
          error: 'Order is already inactive',
          timestamp: new Date()
        };
      }

      order.isActive = false;
      order.updatedAt = new Date();
      
      await this.saveOrders();

      return {
        success: true,
        data: true,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error canceling order:', error);
      return {
        success: false,
        error: `Failed to cancel order: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Start price monitoring
   */
  private startPriceMonitoring(): void {
    if (!config.autoTrading.enabled) {
      console.log('Auto trading is disabled');
      return;
    }

    console.log(`Starting price monitoring (interval: ${config.autoTrading.priceCheckInterval}ms)`);
    
    this.monitoringInterval = setInterval(async () => {
      await this.checkAndExecuteOrders();
    }, config.autoTrading.priceCheckInterval);
  }

  /**
   * Stop price monitoring
   */
  stopPriceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Price monitoring stopped');
    }
  }

  /**
   * Check and execute orders
   */
  private async checkAndExecuteOrders(): Promise<void> {
    try {
      const activeOrders = Array.from(this.orders.values())
        .filter(order => order.isActive);

      for (const order of activeOrders) {
        await this.checkOrder(order);
      }
    } catch (error) {
      console.error('Error checking orders:', error);
    }
  }

  /**
   * Check a specific order
   */
  private async checkOrder(order: AutoTradingOrder): Promise<void> {
    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice(order.tokenAddress);
      if (!currentPrice) {
        console.log(`Could not get price for ${order.tokenAddress}`);
        return;
      }

      // Check if order should be executed
      const shouldExecute = this.shouldExecuteOrder(order, currentPrice);
      
      if (shouldExecute) {
        await this.executeOrder(order, currentPrice);
      }

    } catch (error) {
      console.error(`Error checking order ${order.id}:`, error);
    }
  }

  /**
   * Check if order should be executed
   */
  private shouldExecuteOrder(order: AutoTradingOrder, currentPrice: number): boolean {
    if (order.orderType === 'BUY') {
      // Buy when price drops to or below trigger price
      return currentPrice <= order.triggerPrice;
    } else {
      // Sell when price rises to or above trigger price
      return currentPrice >= order.triggerPrice;
    }
  }

  /**
   * Execute an order
   */
  private async executeOrder(order: AutoTradingOrder, executionPrice: number): Promise<void> {
    try {
      console.log(`Executing ${order.orderType} order ${order.id} at price ${executionPrice}`);

      let result;
      
      if (order.orderType === 'BUY') {
        result = await TradingService.buyTokens(
          order.tokenAddress,
          order.amount,
          order.userId
        );
      } else {
        result = await TradingService.sellTokens(
          order.tokenAddress,
          order.amount, // percentage
          order.userId
        );
      }

      if (result.success) {
        // Update order
        order.isActive = false;
        order.executedAt = new Date();
        order.executionPrice = executionPrice;
        order.executionTxHash = result.data?.txHash;
        order.updatedAt = new Date();

        await this.saveOrders();

        console.log(`Order ${order.id} executed successfully`);
      } else {
        console.error(`Failed to execute order ${order.id}:`, result.error);
      }

    } catch (error) {
      console.error(`Error executing order ${order.id}:`, error);
    }
  }

  /**
   * Get current price for a token from four.meme contract (public method)
   */
  async getTokenPrice(tokenAddress: string): Promise<ApiResponse<{ priceBNB: number; priceUSD: number; bnbPriceUSD: number }>> {
    try {
      const priceBNB = await this.getCurrentPrice(tokenAddress);
      
      if (priceBNB === null) {
        return {
          success: false,
          error: 'Could not fetch token price',
          timestamp: new Date()
        };
      }

      // Get BNB price in USD
      const bnbPriceUSD = await this.getBNBPriceUSD();
      
      // Calculate token price in USD
      const priceUSD = priceBNB * bnbPriceUSD;

      return {
        success: true,
        data: {
          priceBNB,
          priceUSD,
          bnbPriceUSD
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get token price: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }


  /**
   * Get BNB price in USD from CoinGecko API
   */
  private async getBNBPriceUSD(): Promise<number> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const data = await response.json() as { binancecoin: { usd: number } };
      return data.binancecoin.usd;
    } catch (error) {
      console.error('Error fetching BNB price:', error);
      // Fallback to approximate BNB price if API fails
      return 300; // Approximate BNB price as fallback
    }
  }

  /**
   * Get current price for a token from four.meme contract (private method)
   */
  private async getCurrentPrice(tokenAddress: string): Promise<number | null> {
    try {
      // Get token info from four.meme contract
      const tokenInfo = await ContractService.getTokenInfo(tokenAddress);
      
      if (!tokenInfo) {
        console.log(`Token info not found for ${tokenAddress}`);
        return null;
      }

      // Convert lastPrice from wei to BNB with high precision
      // lastPrice is in wei, so we need to convert it to BNB
      const priceInWei = tokenInfo.lastPrice;
      
      // Log the raw wei value for debugging
      console.log(`Raw wei value: ${priceInWei.toString()}`);
      
      // Convert BigInt to string and then to number with high precision
      const weiString = priceInWei.toString();
      const divisor = 1e18;
      
      // Use a more precise conversion
      const priceInBNB = Number(weiString) / divisor;
      
      console.log(`Current price for ${tokenAddress}: ${priceInBNB} BNB (wei: ${weiString})`);
      console.log(`Price in scientific notation: ${priceInBNB.toExponential()}`);
      
      return priceInBNB;
      
    } catch (error) {
      console.error(`Error getting price for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Validate order input
   */
  private validateOrderInput(input: {
    tokenAddress: string;
    triggerPrice: number;
    amount: number;
    orderType: 'BUY' | 'SELL';
    profitTarget?: number;
    stopLoss?: number;
  }): { isValid: boolean; error?: string } {
    // Validate token address
    const addressValidation = ValidationUtils.validateAddress(input.tokenAddress);
    if (!addressValidation.isValid) {
      return { isValid: false, error: addressValidation.error || 'Invalid token address' };
    }

    // Validate trigger price
    if (input.triggerPrice <= 0) {
      return { isValid: false, error: 'Trigger price must be greater than 0' };
    }

    // Validate amount
    if (input.amount <= 0) {
      return { isValid: false, error: 'Amount must be greater than 0' };
    }

    if (input.amount < config.autoTrading.minOrderAmount) {
      return { isValid: false, error: `Amount must be at least ${config.autoTrading.minOrderAmount} BNB` };
    }

    if (input.amount > config.autoTrading.maxOrderAmount) {
      return { isValid: false, error: `Amount must not exceed ${config.autoTrading.maxOrderAmount} BNB` };
    }

    // Validate profit target and stop loss for sell orders
    if (input.orderType === 'SELL') {
      if (input.profitTarget && (input.profitTarget <= 0 || input.profitTarget > 1000)) {
        return { isValid: false, error: 'Profit target must be between 0 and 1000%' };
      }

      if (input.stopLoss && (input.stopLoss <= 0 || input.stopLoss > 100)) {
        return { isValid: false, error: 'Stop loss must be between 0 and 100%' };
      }
    }

    return { isValid: true };
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Load orders from file
   */
  private async loadOrders(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'orders.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const orders = JSON.parse(data);
        
        for (const order of orders) {
          // Convert date strings back to Date objects
          order.createdAt = new Date(order.createdAt);
          order.updatedAt = new Date(order.updatedAt);
          if (order.executedAt) {
            order.executedAt = new Date(order.executedAt);
          }
          
          this.orders.set(order.id, order);
        }
        
        console.log(`Loaded ${this.orders.size} auto trading orders`);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  /**
   * Save orders to file
   */
  private async saveOrders(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'orders.json');
      const orders = Array.from(this.orders.values());
      fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
    } catch (error) {
      console.error('Error saving orders:', error);
    }
  }
}

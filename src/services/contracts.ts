import { publicClient } from '../utils/web3';
import { CONTRACT_ADDRESSES } from '../config';
import { 
  TOKEN_MANAGER_HELPER_ABI, 
  ERC20_ABI 
} from '../contracts/abis';
import { TokenInfo, BuyParams, SellParams } from '../types';

/**
 * Contract interaction service for four.meme trading
 * Handles all blockchain interactions with proper error handling
 */

export class ContractService {
  /**
   * Check if a contract exists (basic validation only)
   */
  private static async validateContractExists(tokenAddress: string): Promise<void> {
    try {
      const code = await publicClient.getCode({ address: tokenAddress as `0x${string}` });
      if (code === '0x') {
        throw new Error('Contract does not exist at this address');
      }
    } catch (error: any) {
      throw new Error(`Contract validation failed: ${error.message || error}`);
    }
  }

  /**
   * Get token information from TokenManagerHelper
   */
  static async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_MANAGER_HELPER,
        abi: TOKEN_MANAGER_HELPER_ABI,
        functionName: 'getTokenInfo',
        args: [tokenAddress as `0x${string}`]
      });
      
      return {
        version: Number(data[0]),
        tokenManager: data[1],
        quote: data[2],
        lastPrice: data[3],
        tradingFeeRate: data[4],
        minTradingFee: data[5],
        launchTime: data[6],
        offers: data[7],
        maxOffers: data[8],
        funds: data[9],
        maxFunds: data[10],
        liquidityAdded: data[11]
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw new Error(`Failed to get token information: ${error}`);
    }
  }

  /**
   * Get buy parameters for a token
   */
  static async getBuyParams(tokenAddress: string, bnbAmount: string): Promise<BuyParams> {
    try {
      const bnbAmountWei = BigInt(Math.floor(parseFloat(bnbAmount) * 1e18));
      
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_MANAGER_HELPER,
        abi: TOKEN_MANAGER_HELPER_ABI,
        functionName: 'tryBuy',
        args: [tokenAddress as `0x${string}`, 0n, bnbAmountWei]
      });

      return {
        tokenManager: data[0],
        quote: data[1],
        estimatedAmount: data[2],
        estimatedCost: data[3],
        estimatedFee: data[4],
        amountMsgValue: data[5],
        amountApproval: data[6],
        amountFunds: data[7]
      };
    } catch (error) {
      console.error('Error getting buy params:', error);
      throw new Error(`Failed to get buy parameters: ${error}`);
    }
  }

  /**
   * Get sell parameters for a token
   */
  static async getSellParams(tokenAddress: string, amount: bigint): Promise<SellParams> {
    try {
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_MANAGER_HELPER,
        abi: TOKEN_MANAGER_HELPER_ABI,
        functionName: 'trySell',
        args: [tokenAddress as `0x${string}`, amount]
      });

      return {
        tokenManager: data[0],
        quote: data[1],
        estimatedFunds: data[2],
        estimatedFee: data[3]
      };
    } catch (error) {
      console.error('Error getting sell params:', error);
      throw new Error(`Failed to get sell parameters: ${error}`);
    }
  }

  /**
   * Get token balance for an address
   */
  static async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    try {
      await this.validateContractExists(tokenAddress);

      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`]
      });

      return balance as bigint;
    } catch (error: any) {
      console.error(`Error getting balance for ${walletAddress}:`, error);
      
      // If it's a zero data error, return 0 balance instead of throwing
      if (error.message?.includes('returned no data') || error.message?.includes('0x')) {
        console.warn(`Contract at ${tokenAddress} does not implement ERC20 balanceOf function, returning 0`);
        return 0n;
      }
      
      throw new Error(`Failed to get token balance: ${error.message || error}`);
    }
  }

  /**
   * Get token allowance
   */
  static async getTokenAllowance(
    tokenAddress: string, 
    ownerAddress: string, 
    spenderAddress: string
  ): Promise<bigint> {
    try {
      return await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`]
      });
    } catch (error) {
      console.error('Error getting token allowance:', error);
      throw new Error(`Failed to get token allowance: ${error}`);
    }
  }

  /**
   * Get token decimals
   */
  static async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      await this.validateContractExists(tokenAddress);

      const decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      });
      
      return Number(decimals);
    } catch (error: any) {
      console.error('Error getting token decimals:', error);
      
      // If it's a zero data error, return default decimals
      if (error.message?.includes('returned no data') || error.message?.includes('0x')) {
        console.warn(`Contract at ${tokenAddress} does not implement ERC20 decimals function, using default 18`);
        return 18;
      }
      
      throw new Error(`Failed to get token decimals: ${error.message || error}`);
    }
  }

  /**
   * Get token name
   */
  static async getTokenName(tokenAddress: string): Promise<string> {
    try {
      await this.validateContractExists(tokenAddress);

      return await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name'
      });
    } catch (error: any) {
      console.error('Error getting token name:', error);
      return 'Unknown Token';
    }
  }

  /**
   * Get token symbol
   */
  static async getTokenSymbol(tokenAddress: string): Promise<string> {
    try {
      await this.validateContractExists(tokenAddress);

      return await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      });
    } catch (error: any) {
      console.error('Error getting token symbol:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Get token total supply
   */
  static async getTokenTotalSupply(tokenAddress: string): Promise<bigint> {
    try {
      await this.validateContractExists(tokenAddress);

      return await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'totalSupply'
      });
    } catch (error: any) {
      console.error('Error getting token total supply:', error);
      
      // If it's a zero data error, return 0 supply
      if (error.message?.includes('returned no data') || error.message?.includes('0x')) {
        console.warn(`Contract at ${tokenAddress} does not implement ERC20 totalSupply function, returning 0`);
        return 0n;
      }
      
      throw new Error(`Failed to get token total supply: ${error.message || error}`);
    }
  }

  /**
   * Get multiple token balances efficiently
   */
  static async getTokenBalancesForWallets(
    tokenAddress: string,
    walletAddresses: string[]
  ): Promise<{ address: string; balance: bigint }[]> {
    try {
      const results = await Promise.all(
        walletAddresses.map(async (address) => {
          try {
            const balance = await this.getTokenBalance(tokenAddress, address);
            return { address, balance };
          } catch (error) {
            console.error(`Error getting balance for ${address}:`, error);
            return { address, balance: 0n };
          }
        })
      );
      
      return results;
    } catch (error) {
      console.error('Error getting token balances for wallets:', error);
      throw new Error(`Failed to get token balances: ${error}`);
    }
  }

  /**
   * Get comprehensive token information
   */
  static async getTokenDetails(tokenAddress: string): Promise<{
    info: TokenInfo;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
  }> {
    try {
      const [info, name, symbol, decimals, totalSupply] = await Promise.all([
        this.getTokenInfo(tokenAddress),
        this.getTokenName(tokenAddress),
        this.getTokenSymbol(tokenAddress),
        this.getTokenDecimals(tokenAddress),
        this.getTokenTotalSupply(tokenAddress)
      ]);

      return {
        info,
        name,
        symbol,
        decimals,
        totalSupply
      };
    } catch (error) {
      console.error('Error getting token details:', error);
      throw new Error(`Failed to get token details: ${error}`);
    }
  }

  /**
   * Check if token is valid and trading is enabled
   */
  static async isTokenTradable(tokenAddress: string): Promise<{
    isValid: boolean;
    error?: string;
    info?: TokenInfo;
  }> {
    try {
      const info = await this.getTokenInfo(tokenAddress);
      
      // Check if token has liquidity
      if (!info.liquidityAdded && info.offers === 0n) {
        return {
          isValid: false,
          error: 'Token has no liquidity available for trading'
        };
      }

      // Check if trading is not halted
      if (info.launchTime > BigInt(Math.floor(Date.now() / 1000))) {
        return {
          isValid: false,
          error: 'Token trading has not started yet'
        };
      }

      return {
        isValid: true,
        info
      };
    } catch (error) {
      console.error('Error checking if token is tradable:', error);
      return {
        isValid: false,
        error: `Failed to validate token: ${error}`
      };
    }
  }

  /**
   * Calculate initial price for a token
   */
  static async calculateInitialPrice(
    maxRaising: bigint,
    totalSupply: bigint,
    offers: bigint,
    reserves: bigint
  ): Promise<bigint> {
    try {
      return await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_MANAGER_HELPER,
        abi: TOKEN_MANAGER_HELPER_ABI,
        functionName: 'calcInitialPrice',
        args: [maxRaising, totalSupply, offers, reserves]
      });
    } catch (error) {
      console.error('Error calculating initial price:', error);
      throw new Error(`Failed to calculate initial price: ${error}`);
    }
  }
}

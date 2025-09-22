import { createPublicClient, http, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
import { ApiResponse } from '../types';
import { TOKEN_MANAGER_HELPER_ABI } from '../contracts/abis';

export interface TokenPriceData {
  tokenAddress: string;
  price: number;
  priceUSD: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  lastUpdated: Date;
}

export class DirectPriceService {
  private static instance: DirectPriceService;
  private publicClient: any;

  // PancakeSwap V2 Router ABI (for getting token prices)
  private readonly PANCAKESWAP_ROUTER_ABI = parseAbi([
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function WETH() external pure returns (address)',
    'function factory() external pure returns (address)'
  ]);

  // ERC20 ABI (for token balances and decimals)
  private readonly ERC20_ABI = parseAbi([
    'function decimals() external view returns (uint8)',
    'function balanceOf(address account) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)'
  ]);

  // Note: Factory and Pair ABIs are available for future use if needed
  // private readonly PANCAKESWAP_FACTORY_ABI = parseAbi([
  //   'function getPair(address tokenA, address tokenB) external view returns (address pair)'
  // ]);

  // private readonly PANCAKESWAP_PAIR_ABI = parseAbi([
  //   'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  //   'function token0() external view returns (address)',
  //   'function token1() external view returns (address)'
  // ]);

  constructor() {
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org')
    });
  }

  static getInstance(): DirectPriceService {
    if (!DirectPriceService.instance) {
      DirectPriceService.instance = new DirectPriceService();
    }
    return DirectPriceService.instance;
  }

  /**
   * Get the public client for blockchain interactions
   */
  getPublicClient(): any {
    return this.publicClient;
  }

  /**
   * Get current price of a token from PancakeSwap
   */
  async getPancakeSwapTokenPrice(tokenAddress: string): Promise<ApiResponse<TokenPriceData>> {
    try {
      console.log(`🔍 Fetching PancakeSwap price for: ${tokenAddress.slice(0, 8)}...`);

      // PancakeSwap V2 Router address
      const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`;
      
      // WBNB address
      const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`;
      
      // USDT address (for USD price)
      const usdtAddress = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`;

      // Get token decimals
      const decimals = await this.getTokenDecimals(tokenAddress);
      if (decimals === null) {
        return {
          success: false,
          error: 'Could not get token decimals',
          timestamp: new Date()
        };
      }

      // Try to get price in BNB first
      let priceInBNB = 0;
      let priceInUSD = 0;

      try {
        // Get price in BNB (1 token = ? BNB)
        const amountsOut = await this.publicClient.readContract({
          address: routerAddress,
          abi: this.PANCAKESWAP_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [
            BigInt(10 ** decimals), // 1 token (with decimals)
            [tokenAddress as `0x${string}`, wbnbAddress] // Token -> WBNB
          ]
        });

        if (amountsOut && amountsOut.length >= 2) {
          priceInBNB = Number(amountsOut[1]) / 1e18; // Convert from Wei to BNB
        }
      } catch (error) {
        console.log(`⚠️ Could not get BNB price for ${tokenAddress.slice(0, 8)}...`);
      }

      // Try to get price in USD (via USDT)
      try {
        const amountsOutUSD = await this.publicClient.readContract({
          address: routerAddress,
          abi: this.PANCAKESWAP_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [
            BigInt(10 ** decimals), // 1 token (with decimals)
            [tokenAddress as `0x${string}`, usdtAddress] // Token -> USDT
          ]
        });

        if (amountsOutUSD && amountsOutUSD.length >= 2) {
          priceInUSD = Number(amountsOutUSD[1]) / 1e18; // Convert from Wei to USDT
        }
      } catch (error) {
        console.log(`⚠️ Could not get USD price for ${tokenAddress.slice(0, 8)}...`);
      }

      // If we couldn't get USD price directly, try Token -> BNB -> USDT
      if (priceInUSD === 0 && priceInBNB > 0) {
        try {
          const bnbToUsdt = await this.publicClient.readContract({
            address: routerAddress,
            abi: this.PANCAKESWAP_ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [
              BigInt(1e18), // 1 BNB
              [wbnbAddress, usdtAddress] // WBNB -> USDT
            ]
          });

          if (bnbToUsdt && bnbToUsdt.length >= 2) {
            const bnbPriceInUSD = Number(bnbToUsdt[1]) / 1e18;
            priceInUSD = priceInBNB * bnbPriceInUSD;
          }
        } catch (error) {
          console.log(`⚠️ Could not get BNB to USD conversion for ${tokenAddress.slice(0, 8)}...`);
        }
      }

      if (priceInBNB === 0 && priceInUSD === 0) {
        return {
          success: false,
          error: 'No liquidity found for this token on PancakeSwap',
          timestamp: new Date()
        };
      }

      return {
        success: true,
        data: {
          tokenAddress,
          price: priceInBNB,
          priceUSD: priceInUSD,
          volume24h: 0, // TODO: Calculate from recent trades
          marketCap: 0, // TODO: Calculate market cap
          priceChange24h: 0, // TODO: Calculate 24h change
          lastUpdated: new Date()
        },
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error(`❌ Error fetching PancakeSwap price for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get current exact price of a four.meme token using tryBuy simulation
   */
  async getFourMemeTokenPrice(tokenAddress: string): Promise<ApiResponse<TokenPriceData>> {
    try {
      console.log(`🔍 Fetching exact four.meme price for: ${tokenAddress.slice(0, 8)}...`);

      // Four.meme contract addresses
      const tokenManagerHelper = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034' as `0x${string}`;

      try {
        // Method 1: Use tryBuy to get exact current price by simulating a buy of 1 token
        const tokenDecimals = await this.getTokenDecimals(tokenAddress);
        if (tokenDecimals === null) {
          throw new Error('Could not get token decimals');
        }
        const oneTokenAmount = BigInt(10 ** tokenDecimals); // 1 token in wei
        
        const tryBuyResult = await this.publicClient.readContract({
          address: tokenManagerHelper,
          abi: TOKEN_MANAGER_HELPER_ABI,
          functionName: 'tryBuy',
          args: [
            tokenAddress as `0x${string}`,
            oneTokenAmount, // 1 token
            BigInt(0) // no funds
          ]
        });

        if (tryBuyResult && tryBuyResult.length >= 8) {
          const estimatedCost = tryBuyResult[3]; // estimatedCost is the 4th element
          const estimatedFee = tryBuyResult[4]; // estimatedFee is the 5th element
          
          if (estimatedCost && estimatedCost > 0) {
            // Subtract fee from cost to get the actual token price
            const priceWithoutFee = estimatedCost - estimatedFee;
            const priceInBNB = Number(priceWithoutFee) / 1e18; // Convert from Wei to BNB
            
            // Get BNB price in USD
            const bnbPriceUSD = await this.getBNBPriceUSD();
            const priceInUSD = priceInBNB * bnbPriceUSD;

            console.log(`✅ Got exact four.meme price from tryBuy simulation: ${priceInBNB.toFixed(8)} BNB`);

            return {
              success: true,
              data: {
                tokenAddress,
                price: priceInBNB,
                priceUSD: priceInUSD,
                volume24h: 0,
                marketCap: 0,
                priceChange24h: 0,
                lastUpdated: new Date()
              },
              timestamp: new Date()
            };
          }
        }
      } catch (error: any) {
        console.log(`⚠️ Could not get price from tryBuy simulation: ${error.message}`);
      }

      try {
        // Method 2: Fallback to getTokenInfo for lastPrice
        const tokenInfo = await this.publicClient.readContract({
          address: tokenManagerHelper,
          abi: TOKEN_MANAGER_HELPER_ABI,
          functionName: 'getTokenInfo',
          args: [tokenAddress as `0x${string}`]
        });

        if (tokenInfo && tokenInfo.length >= 4) {
          const lastPrice = tokenInfo[3]; // lastPrice is the 4th element (index 3)
          
          if (lastPrice && lastPrice > 0) {
            const priceInBNB = Number(lastPrice) / 1e18; // Convert from Wei to BNB
            
            // Get BNB price in USD
            const bnbPriceUSD = await this.getBNBPriceUSD();
            const priceInUSD = priceInBNB * bnbPriceUSD;

            console.log(`⚠️ Using lastPrice from getTokenInfo (may not be current): ${priceInBNB.toFixed(8)} BNB`);

            return {
              success: true,
              data: {
                tokenAddress,
                price: priceInBNB,
                priceUSD: priceInUSD,
                volume24h: 0,
                marketCap: 0,
                priceChange24h: 0,
                lastUpdated: new Date()
              },
              timestamp: new Date()
            };
          }
        }
      } catch (error: any) {
        console.log(`⚠️ Could not get price from Token Manager Helper: ${error.message}`);
      }

      // Fallback: Try to get price from PancakeSwap if available
      console.log(`🔄 Falling back to PancakeSwap for four.meme token...`);
      return await this.getPancakeSwapTokenPrice(tokenAddress);

    } catch (error: any) {
      console.error(`❌ Error fetching four.meme price for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get BNB price in USD from PancakeSwap
   */
  private async getBNBPriceUSD(): Promise<number> {
    try {
      const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`;
      const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`;
      const usdtAddress = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`;

      const amountsOut = await this.publicClient.readContract({
        address: routerAddress,
        abi: this.PANCAKESWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [
          BigInt(1e18), // 1 BNB
          [wbnbAddress, usdtAddress] // WBNB -> USDT
        ]
      });

      if (amountsOut && amountsOut.length >= 2) {
        return Number(amountsOut[1]) / 1e18; // Convert from Wei to USDT
      }

      return 300; // Fallback BNB price
    } catch (error) {
      console.log('⚠️ Could not get BNB price, using fallback');
      return 300; // Fallback BNB price
    }
  }

  /**
   * Get token decimals
   */
  private async getTokenDecimals(tokenAddress: string): Promise<number | null> {
    try {
      const decimals = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: this.ERC20_ABI,
        functionName: 'decimals'
      });

      return Number(decimals);
    } catch (error: any) {
      console.log(`⚠️ Could not get decimals for ${tokenAddress}, assuming 18`);
      return 18; // Default to 18 decimals
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<ApiResponse<number>> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: this.ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`]
      });

      const decimals = await this.getTokenDecimals(tokenAddress);
      const balanceFormatted = Number(balance) / (10 ** (decimals || 18));

      return {
        success: true,
        data: balanceFormatted,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get token total supply
   */
  async getTokenTotalSupply(tokenAddress: string): Promise<ApiResponse<number>> {
    try {
      const totalSupply = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: this.ERC20_ABI,
        functionName: 'totalSupply'
      });

      const decimals = await this.getTokenDecimals(tokenAddress);
      const supplyFormatted = Number(totalSupply) / (10 ** (decimals || 18));

      return {
        success: true,
        data: supplyFormatted,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get exact current price using tryBuy and trySell simulations
   */
  async getFourMemeExactPrice(tokenAddress: string): Promise<ApiResponse<{ buyPrice: number; sellPrice: number; avgPrice: number; priceUSD: number }>> {
    try {
      // console.log(`🔍 Getting exact four.meme price via simulation for: ${tokenAddress.slice(0, 8)}...`);

      const tokenManagerHelper = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034' as `0x${string}`;
      const tokenDecimals = await this.getTokenDecimals(tokenAddress);
      if (tokenDecimals === null) {
        throw new Error('Could not get token decimals');
      }
      const oneTokenAmount = BigInt(10 ** tokenDecimals);

      let buyPrice = 0;
      let sellPrice = 0;

      try {
        // Get buy price via tryBuy
        const tryBuyResult = await this.publicClient.readContract({
          address: tokenManagerHelper,
          abi: TOKEN_MANAGER_HELPER_ABI,
          functionName: 'tryBuy',
          args: [
            tokenAddress as `0x${string}`,
            oneTokenAmount, // 1 token
            BigInt(0) // no funds
          ]
        });

        if (tryBuyResult && tryBuyResult.length >= 8) {
          const estimatedCost = tryBuyResult[3]; // estimatedCost
          const estimatedFee = tryBuyResult[4]; // estimatedFee
          const priceWithoutFee = estimatedCost - estimatedFee;
          buyPrice = Number(priceWithoutFee) / 1e18; // price without fee
          // console.log(`✅ Buy price (tryBuy, corrected): ${buyPrice.toFixed(8)} BNB`);
        }
      } catch (error: any) {
        console.log(`⚠️ Could not get buy price: ${error.message}`);
      }

      try {
        // Get sell price via trySell
        const trySellResult = await this.publicClient.readContract({
          address: tokenManagerHelper,
          abi: TOKEN_MANAGER_HELPER_ABI,
          functionName: 'trySell',
          args: [
            tokenAddress as `0x${string}`,
            oneTokenAmount // 1 token
          ]
        });

        if (trySellResult && trySellResult.length >= 4) {
          const funds = trySellResult[2]; // funds (what you get for selling)
          const fee = trySellResult[3]; // fee
          const priceWithFee = funds + fee;
          sellPrice = Number(priceWithFee) / 1e18; // price including fee
          // console.log(`✅ Sell price (trySell, with fee): ${sellPrice.toFixed(8)} BNB`);
        }
      } catch (error: any) {
        console.log(`⚠️ Could not get sell price: ${error.message}`);
      }

      if (buyPrice > 0 || sellPrice > 0) {
        const avgPrice = buyPrice > 0 && sellPrice > 0 ? (buyPrice + sellPrice) / 2 : (buyPrice > 0 ? buyPrice : sellPrice);
        const bnbPriceUSD = await this.getBNBPriceUSD();
        const priceUSD = avgPrice * bnbPriceUSD;

        return {
          success: true,
          data: {
            buyPrice,
            sellPrice,
            avgPrice,
            priceUSD
          },
          timestamp: new Date()
        };
      }

      return {
        success: false,
        error: 'Could not get exact price from simulations',
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error(`❌ Error getting exact price for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get detailed four.meme token information
   */
  async getFourMemeTokenInfo(tokenAddress: string): Promise<ApiResponse<any>> {
    try {
      console.log(`🔍 Fetching detailed four.meme info for: ${tokenAddress.slice(0, 8)}...`);

      const tokenManagerHelper = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034' as `0x${string}`;

      const tokenInfo = await this.publicClient.readContract({
        address: tokenManagerHelper,
        abi: TOKEN_MANAGER_HELPER_ABI,
        functionName: 'getTokenInfo',
        args: [tokenAddress as `0x${string}`]
      });

      if (tokenInfo && tokenInfo.length >= 12) {
        const [
          version,
          tokenManager,
          quote,
          lastPrice,
          tradingFeeRate,
          minTradingFee,
          launchTime,
          offers,
          maxOffers,
          funds,
          maxFunds,
          liquidityAdded
        ] = tokenInfo;

        const bnbPriceUSD = await this.getBNBPriceUSD();
        const priceInBNB = Number(lastPrice) / 1e18;
        const priceInUSD = priceInBNB * bnbPriceUSD;

        return {
          success: true,
          data: {
            version: Number(version),
            tokenManager,
            quote,
            lastPrice: Number(lastPrice),
            priceInBNB,
            priceInUSD,
            tradingFeeRate: Number(tradingFeeRate),
            minTradingFee: Number(minTradingFee),
            launchTime: Number(launchTime),
            offers: Number(offers),
            maxOffers: Number(maxOffers),
            funds: Number(funds),
            maxFunds: Number(maxFunds),
            liquidityAdded: Boolean(liquidityAdded),
            // Calculated values
            progressPercent: maxOffers > 0 ? (Number(offers) / Number(maxOffers)) * 100 : 0,
            fundsProgressPercent: maxFunds > 0 ? (Number(funds) / Number(maxFunds)) * 100 : 0,
            isLaunched: Number(launchTime) > 0 && Date.now() / 1000 > Number(launchTime)
          },
          timestamp: new Date()
        };
      }

      return {
        success: false,
        error: 'Invalid token info response',
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error(`❌ Error fetching four.meme token info for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get real-time price with enhanced accuracy for trading decisions
   */
  async getRealTimePrice(tokenAddress: string): Promise<ApiResponse<{
    buyPrice: number;
    sellPrice: number;
    avgPrice: number;
    priceUSD: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    liquidity: number;
    lastUpdated: Date;
  }>> {
    try {
      console.log(`🔍 Getting real-time price for: ${tokenAddress.slice(0, 8)}...`);

      // Get exact price using simulation
      const exactPriceResult = await this.getFourMemeExactPrice(tokenAddress);
      if (!exactPriceResult.success || !exactPriceResult.data) {
        return {
          success: false,
          error: 'Could not get exact price',
          timestamp: new Date()
        };
      }

      const { buyPrice, sellPrice, avgPrice, priceUSD } = exactPriceResult.data;

      // Get additional token info for enhanced data
      const tokenInfoResult = await this.getFourMemeTokenInfo(tokenAddress);
      let additionalData = {
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        liquidity: 0
      };

      if (tokenInfoResult.success && tokenInfoResult.data) {
        const tokenInfo = tokenInfoResult.data;
        additionalData = {
          priceChange24h: 0, // TODO: Calculate from historical data
          volume24h: 0, // TODO: Calculate from recent trades
          marketCap: tokenInfo.priceInUSD * (tokenInfo.maxOffers || 0), // Rough estimate
          liquidity: Number(tokenInfo.funds) / 1e18 // Funds in BNB
        };
      }

      return {
        success: true,
        data: {
          buyPrice,
          sellPrice,
          avgPrice,
          priceUSD,
          ...additionalData,
          lastUpdated: new Date()
        },
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error(`❌ Error getting real-time price for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get price history for a token (placeholder for future implementation)
   */
  async getPriceHistory(tokenAddress: string, timeframe: '1h' | '4h' | '24h' | '7d' = '24h'): Promise<ApiResponse<{
    prices: Array<{
      timestamp: Date;
      price: number;
      priceUSD: number;
      volume: number;
    }>;
    timeframe: string;
  }>> {
    try {
      // TODO: Implement price history tracking
      // This would require storing historical price data
      console.log(`📊 Price history requested for ${tokenAddress.slice(0, 8)}... (${timeframe})`);
      
      return {
        success: false,
        error: 'Price history not implemented yet',
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error(`❌ Error getting price history for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check if token has sufficient liquidity for trading
   */
  async checkTokenLiquidity(tokenAddress: string, minLiquidity: number = 0.1): Promise<ApiResponse<{
    hasLiquidity: boolean;
    liquidityAmount: number;
    liquidityUSD: number;
    isTradeable: boolean;
  }>> {
    try {
      const tokenInfoResult = await this.getFourMemeTokenInfo(tokenAddress);
      
      if (!tokenInfoResult.success || !tokenInfoResult.data) {
        return {
          success: false,
          error: 'Could not get token info',
          timestamp: new Date()
        };
      }

      const tokenInfo = tokenInfoResult.data;
      const liquidityAmount = Number(tokenInfo.funds) / 1e18; // Convert from Wei to BNB
      const liquidityUSD = liquidityAmount * tokenInfo.priceInUSD;
      const hasLiquidity = liquidityAmount >= minLiquidity;
      const isTradeable = tokenInfo.isLaunched && hasLiquidity;

      return {
        success: true,
        data: {
          hasLiquidity,
          liquidityAmount,
          liquidityUSD,
          isTradeable
        },
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error(`❌ Error checking liquidity for ${tokenAddress}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

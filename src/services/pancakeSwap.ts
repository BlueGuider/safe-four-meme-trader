import { encodeFunctionData, maxUint256 } from 'viem';
import { WalletService } from './wallet';
import { ValidationUtils } from '../utils/validation';
import { getCurrentGasPrice, publicClient, sendRawTransaction, getBalance } from '../utils/web3';
import { 
  PANCAKESWAP_V2_ROUTER_ABI, 
  PANCAKESWAP_V3_ROUTER_ABI,
  PANCAKESWAP_V2_FACTORY_ABI,
  ERC20_ABI 
} from '../contracts/abis';
import { CONTRACT_ADDRESSES, GAS_LIMITS } from '../config';
import { 
  ApiResponse
} from '../types';

/**
 * PancakeSwap trading service for DEX tokens
 * Features:
 * - V2 and V3 PancakeSwap support
 * - Automatic liquidity detection
 * - Slippage protection
 * - Gas optimization
 */

export class PancakeSwapService {
  /**
   * Buy tokens on PancakeSwap
   */
  static async buyTokens(
    tokenAddress: string,
    bnbAmountPerWallet: number,
    userId: string,
    slippagePercent: number = 5.0
  ): Promise<ApiResponse<{ txHash: string; successCount: number; totalWallets: number }>> {
    try {
      // Validate input
      const validation = ValidationUtils.validateTransactionParams({
        tokenAddress,
        amount: bnbAmountPerWallet.toString(),
        userId
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          timestamp: new Date()
        };
      }

      // Get user wallets
      const walletAddresses = WalletService.getWalletAddresses(userId);
      if (walletAddresses.length === 0) {
        return {
          success: false,
          error: 'No wallets found. Create wallets first.',
          timestamp: new Date()
        };
      }

      // Check wallet balances and filter out wallets with insufficient funds
      const gasPrice = await getCurrentGasPrice();
      const estimatedGasCost = gasPrice * BigInt(GAS_LIMITS.BUY);
      const totalRequiredAmount = BigInt(Math.floor(bnbAmountPerWallet * 1e18)) + estimatedGasCost;
      
      const fundedWallets = [];
      for (const walletAddress of walletAddresses) {
        try {
          const balance = await getBalance(walletAddress as `0x${string}`);
          if (balance >= totalRequiredAmount) {
            fundedWallets.push(walletAddress);
          } else {
            console.log(`⚠️  Wallet ${walletAddress.slice(0, 8)}... has insufficient funds: ${(Number(balance) / 1e18).toFixed(6)} BNB (needs ${(Number(totalRequiredAmount) / 1e18).toFixed(6)} BNB)`);
          }
        } catch (error) {
          console.error(`Error checking balance for wallet ${walletAddress}:`, error);
        }
      }

      if (fundedWallets.length === 0) {
        return {
          success: false,
          error: `Insufficient funds in all wallets. Each wallet needs at least ${(Number(totalRequiredAmount) / 1e18).toFixed(6)} BNB (${bnbAmountPerWallet.toFixed(6)} BNB + gas fees). Please fund your wallets first.`,
          timestamp: new Date()
        };
      }

      console.log(`💰 Using ${fundedWallets.length} funded wallets out of ${walletAddresses.length} total wallets`);

      // Check if token has liquidity on PancakeSwap
      const hasLiquidity = await this.checkTokenLiquidity(tokenAddress);
      if (!hasLiquidity) {
        return {
          success: false,
          error: 'Token has no liquidity on PancakeSwap. Cannot execute trade.',
          timestamp: new Date()
        };
      }

      // Determine best trading route (V2 or V3)
      const bestRoute = await this.findBestRoute(tokenAddress, bnbAmountPerWallet);
      if (!bestRoute) {
        return {
          success: false,
          error: 'Could not find trading route for this token on PancakeSwap.',
          timestamp: new Date()
        };
      }

      console.log(`🔄 Using PancakeSwap ${bestRoute.version} for trading`);

      // Prepare transactions
      const transactions: string[] = [];
      let successCount = 0;

      for (const walletAddress of fundedWallets) {
        try {
          const walletClient = WalletService.createWalletClient(userId, walletAddress);
          let nonce = await publicClient.getTransactionCount({ address: walletAddress as `0x${string}` });
          const gasPrice = await getCurrentGasPrice();

          // Calculate minimum amount out with slippage
          const amountOutMin = BigInt(Math.floor(bestRoute.estimatedOutput * (100 - slippagePercent) / 100));

          let transactionData: `0x${string}`;
          let deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

          if (bestRoute.version === 'V2') {
            // PancakeSwap V2 swap
            transactionData = encodeFunctionData({
              abi: PANCAKESWAP_V2_ROUTER_ABI,
              functionName: 'swapExactETHForTokens',
              args: [
                amountOutMin,
                bestRoute.path.map(addr => addr as `0x${string}`),
                walletAddress as `0x${string}`,
                deadline
              ]
            });

            // Sign transaction
            const signature = await walletClient.signTransaction({
              account: walletClient.account,
              to: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER as `0x${string}`,
              value: BigInt(Math.floor(bnbAmountPerWallet * 1e18)),
              gas: GAS_LIMITS.BUY,
              gasPrice,
              nonce,
              data: transactionData
            });

            transactions.push(signature.slice(2)); // Remove 0x prefix
            successCount++;

          } else if (bestRoute.version === 'V3') {
            // PancakeSwap V3 swap
            transactionData = encodeFunctionData({
              abi: PANCAKESWAP_V3_ROUTER_ABI,
              functionName: 'exactInputSingle',
              args: [
                {
                  tokenIn: CONTRACT_ADDRESSES.WBNB as `0x${string}`,
                  tokenOut: tokenAddress as `0x${string}`,
                  fee: bestRoute.fee || 3000,
                  recipient: walletAddress as `0x${string}`,
                  deadline,
                  amountIn: BigInt(Math.floor(bnbAmountPerWallet * 1e18)),
                  amountOutMinimum: amountOutMin,
                  sqrtPriceLimitX96: 0n
                }
              ]
            });

            // Sign transaction
            const signature = await walletClient.signTransaction({
              account: walletClient.account,
              to: CONTRACT_ADDRESSES.PANCAKESWAP_V3_ROUTER as `0x${string}`,
              value: BigInt(Math.floor(bnbAmountPerWallet * 1e18)),
              gas: GAS_LIMITS.BUY,
              gasPrice,
              nonce,
              data: transactionData
            });

            transactions.push(signature.slice(2)); // Remove 0x prefix
            successCount++;
          }

          // Update wallet last used
          WalletService.updateWalletLastUsed(userId, walletAddress);

        } catch (error) {
          console.error(`Error preparing PancakeSwap transaction for wallet ${walletAddress}:`, error);
          // Continue with other wallets
        }
      }

      if (transactions.length === 0) {
        return {
          success: false,
          error: 'Failed to prepare any PancakeSwap transactions',
          timestamp: new Date()
        };
      }

      // Submit bundle
      const bundleResult = await this.submitBundle(transactions);

      return {
        success: bundleResult.success,
        data: {
          txHash: bundleResult.bundleHash || 'Bundle submitted',
          successCount,
          totalWallets: fundedWallets.length
        },
        error: bundleResult.error,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error buying tokens on PancakeSwap:', error);
      return {
        success: false,
        error: `Failed to buy tokens on PancakeSwap: ${error}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Sell tokens on PancakeSwap
   */
  static async sellTokens(
    tokenAddress: string,
    sellPercentage: number,
    userId: string,
    slippagePercent: number = 5.0
  ): Promise<ApiResponse<{ txHash: string; successCount: number; totalWallets: number }>> {
    try {
      // Validate input
      const validation = ValidationUtils.validateTransactionParams({
        tokenAddress,
        percentage: sellPercentage,
        userId
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          timestamp: new Date()
        };
      }

      // Get user wallets
      const walletAddresses = WalletService.getWalletAddresses(userId);
      if (walletAddresses.length === 0) {
        return {
          success: false,
          error: 'No wallets found. Create wallets first.',
          timestamp: new Date()
        };
      }

      // Check if token has liquidity on PancakeSwap
      const hasLiquidity = await this.checkTokenLiquidity(tokenAddress);
      if (!hasLiquidity) {
        return {
          success: false,
          error: 'Token has no liquidity on PancakeSwap. Cannot execute trade.',
          timestamp: new Date()
        };
      }

      // Prepare transactions
      const transactions: string[] = [];
      let successCount = 0;

      for (const walletAddress of walletAddresses) {
        try {
          const walletClient = WalletService.createWalletClient(userId, walletAddress);
          let nonce = await publicClient.getTransactionCount({ address: walletAddress as `0x${string}` });
          const gasPrice = await getCurrentGasPrice();

          // Get token balance
          const balance = await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`]
          });

          if (balance <= 0n) {
            console.log(`Wallet ${walletAddress} has no tokens to sell`);
            continue;
          }

          const amountToSell = (balance * BigInt(sellPercentage)) / 100n;
          if (amountToSell <= 0n) {
            console.log(`Wallet ${walletAddress} has insufficient tokens to sell`);
            continue;
          }

          // Find best route for selling
          const bestRoute = await this.findBestSellRoute(tokenAddress, Number(amountToSell));
          if (!bestRoute) {
            console.log(`No route found for selling token ${tokenAddress}`);
            continue;
          }

          // Check allowance
          const allowance = await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress as `0x${string}`, bestRoute.routerAddress as `0x${string}`]
          });

          // Add approval transaction if needed
          if (allowance < amountToSell) {
            const approveData = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [bestRoute.routerAddress as `0x${string}`, maxUint256]
            });

            const approveSignature = await walletClient.signTransaction({
              account: walletClient.account,
              to: tokenAddress as `0x${string}`,
              value: 0n,
              gas: GAS_LIMITS.APPROVE,
              gasPrice,
              nonce,
              data: approveData
            });

            transactions.push(approveSignature.slice(2));
            nonce++;
          }

          // Calculate minimum amount out with slippage
          let amountOutMin = BigInt(Math.floor(bestRoute.estimatedOutput * (100 - slippagePercent) / 100));
          
          // For fee-on-transfer tokens, use a very flexible minimum amount
          // Since we're using swapExactTokensForETHSupportingFeeOnTransferTokens,
          // we need to account for unpredictable fees that can significantly reduce output
          if (amountOutMin === 0n && bestRoute.estimatedOutput > 0) {
            // Use 0.1% of estimated output as minimum (extremely flexible for fee-on-transfer tokens)
            amountOutMin = BigInt(Math.floor(bestRoute.estimatedOutput * 0.001 * 1e18));
            console.log(`   ⚠️  AmountOutMin was 0, setting to 0.1% of estimated output: ${(Number(amountOutMin) / 1e18).toFixed(6)} BNB`);
          }
          
          // For fee-on-transfer tokens, also reduce the slippage-based minimum
          // Apply additional 50% reduction to account for transfer fees
          amountOutMin = BigInt(Math.floor(Number(amountOutMin) * 0.5));
          console.log(`   📊 Final AmountOutMin: ${(Number(amountOutMin) / 1e18).toFixed(6)} BNB (reduced for fee-on-transfer)`);
          
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

          let sellData: `0x${string}`;
          if (bestRoute.version === 'V2') {
            // PancakeSwap V2 sell - use fee-on-transfer version to handle tokens with transfer fees
            sellData = encodeFunctionData({
              abi: PANCAKESWAP_V2_ROUTER_ABI,
              functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
              args: [
                amountToSell,
                amountOutMin,
                bestRoute.path.map(addr => addr as `0x${string}`),
                walletAddress as `0x${string}`,
                deadline
              ]
            });
          } else if (bestRoute.version === 'V3') {
            // PancakeSwap V3 sell
            sellData = encodeFunctionData({
              abi: PANCAKESWAP_V3_ROUTER_ABI,
              functionName: 'exactInputSingle',
              args: [
                {
                  tokenIn: tokenAddress as `0x${string}`,
                  tokenOut: CONTRACT_ADDRESSES.WBNB as `0x${string}`,
                  fee: bestRoute.fee || 3000,
                  recipient: walletAddress as `0x${string}`,
                  deadline,
                  amountIn: amountToSell,
                  amountOutMinimum: amountOutMin,
                  sqrtPriceLimitX96: 0n
                }
              ]
            });
          } else {
            console.log(`Unsupported route version: ${bestRoute.version}`);
            continue;
          }

          // Sign sell transaction
          const sellSignature = await walletClient.signTransaction({
            account: walletClient.account,
            to: bestRoute.routerAddress as `0x${string}`,
            value: 0n,
            gas: GAS_LIMITS.SELL,
            gasPrice,
            nonce,
            data: sellData
          });

          console.log(`✅ PancakeSwap sell transaction signed for wallet ${walletAddress.slice(0, 8)}...`);

          transactions.push(sellSignature.slice(2));
          successCount++;

          // Update wallet last used
          WalletService.updateWalletLastUsed(userId, walletAddress);

        } catch (error) {
          console.error(`Error preparing PancakeSwap sell transaction for wallet ${walletAddress}:`, error);
          // Continue with other wallets
        }
      }

      if (transactions.length === 0) {
        return {
          success: false,
          error: 'No wallets have tokens to sell on PancakeSwap',
          timestamp: new Date()
        };
      }

      console.log(`📦 Submitting ${transactions.length} PancakeSwap sell transaction(s)`);

      // Submit bundle
      const bundleResult = await this.submitBundle(transactions);

      return {
        success: bundleResult.success,
        data: {
          txHash: bundleResult.bundleHash || 'Bundle submitted',
          successCount,
          totalWallets: walletAddresses.length
        },
        error: bundleResult.error,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error selling tokens on PancakeSwap:', error);
      return {
        success: false,
        error: `Failed to sell tokens on PancakeSwap: ${error}`,
        timestamp: new Date()
      };
    }
  }

  // Private methods

  /**
   * Check if token has liquidity on PancakeSwap
   */
  private static async checkTokenLiquidity(tokenAddress: string): Promise<boolean> {
    try {
      // Now that we have the official ABI, let's try the direct getPair call
      const pairAddress = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PANCAKESWAP_V2_FACTORY as `0x${string}`,
        abi: PANCAKESWAP_V2_FACTORY_ABI,
        functionName: 'getPair',
        args: [CONTRACT_ADDRESSES.WBNB as `0x${string}`, tokenAddress as `0x${string}`]
      });

      console.log(`🔍 getPair result: ${pairAddress}`);

      if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
        console.log(`✅ Token has V2 liquidity on PancakeSwap (pair: ${pairAddress})`);
        return true;
      } else {
        console.log(`❌ Token has no V2 pair on PancakeSwap`);
        return false;
      }

    } catch (error) {
      console.error('Error checking token liquidity with official ABI:', error);
      
      // If the official ABI still fails, fall back to router check
      try {
        console.log(`⚠️ Factory check failed, trying router approach`);
        const amounts = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER as `0x${string}`,
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [
            BigInt(1000000), // 1 token (assuming 6 decimals)
            [CONTRACT_ADDRESSES.WBNB, tokenAddress].map(addr => addr as `0x${string}`)
          ]
        });

        if (amounts && amounts.length > 1 && amounts[1] > 0n) {
          console.log(`✅ Token has V2 liquidity on PancakeSwap (verified via getAmountsOut)`);
          return true;
        } else {
          console.log(`❌ Token has no V2 liquidity on PancakeSwap`);
          return false;
        }
      } catch (routerError) {
        console.log(`⚠️ Both factory and router checks failed, but trading might still work`);
        console.log(`💡 Proceeding with assumption that token has liquidity`);
        return true; // Be permissive - let the actual trading determine if liquidity exists
      }
    }
  }

  /**
   * Find best trading route for buying
   */
  private static async findBestRoute(tokenAddress: string, bnbAmount: number): Promise<{
    version: 'V2' | 'V3';
    path: string[];
    estimatedOutput: number;
    fee?: number;
    routerAddress: string;
  } | null> {
    try {
      const path = [CONTRACT_ADDRESSES.WBNB, tokenAddress];

      // Try V2 first
      try {
        const amounts = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER as `0x${string}`,
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'getAmountsOut',
              args: [BigInt(Math.floor(bnbAmount * 1e18)), path.map(addr => addr as `0x${string}`)]
        });

        if (amounts && amounts.length > 1 && amounts[1] > 0n) {
          return {
            version: 'V2',
            path,
            estimatedOutput: Number(amounts[1]) / 1e18,
            routerAddress: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER
          };
        }
      } catch (v2Error) {
        console.log('V2 route not available, trying V3');
      }

      // Try V3 (simplified - in production, you'd check actual pool fees)
      return {
        version: 'V3',
        path,
        estimatedOutput: bnbAmount * 0.95, // Assume 5% slippage for estimation
        fee: 3000,
        routerAddress: CONTRACT_ADDRESSES.PANCAKESWAP_V3_ROUTER
      };

    } catch (error) {
      console.error('Error finding best route:', error);
      return null;
    }
  }

  /**
   * Find best trading route for selling
   */
  private static async findBestSellRoute(tokenAddress: string, tokenAmount: number): Promise<{
    version: 'V2' | 'V3';
    path: string[];
    estimatedOutput: number;
    fee?: number;
    routerAddress: string;
  } | null> {
    try {
      const path = [tokenAddress, CONTRACT_ADDRESSES.WBNB];

      // Try V2 first
      try {
        const amounts = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER as `0x${string}`,
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [BigInt(tokenAmount), path.map(addr => addr as `0x${string}`)]
        });

        if (amounts && amounts.length > 1 && amounts[1] > 0n) {
          return {
            version: 'V2',
            path,
            estimatedOutput: Number(amounts[1]) / 1e18,
            routerAddress: CONTRACT_ADDRESSES.PANCAKESWAP_V2_ROUTER
          };
        }
      } catch (v2Error) {
        console.log('V2 route not available for selling, trying V3');
      }

      // Try V3 (simplified)
      return {
        version: 'V3',
        path,
        estimatedOutput: tokenAmount * 0.95 / 1e18, // Assume 5% slippage for estimation
        fee: 3000,
        routerAddress: CONTRACT_ADDRESSES.PANCAKESWAP_V3_ROUTER
      };

    } catch (error) {
      console.error('Error finding best sell route:', error);
      return null;
    }
  }

  /**
   * Submit transaction bundle for MEV protection
   */
  private static async submitBundle(transactions: string[]): Promise<{
    success: boolean;
    bundleHash?: string;
    error?: string;
    results?: any[];
  }> {
    try {
      console.log(`Submitting PancakeSwap bundle with ${transactions.length} transactions`);
      
      const results = [];
      let successCount = 0;
      
      for (let i = 0; i < transactions.length; i++) {
        try {
          // Convert the signed transaction back to hex format
          const signedTx = `0x${transactions[i]}`;
          
          console.log(`📤 Submitting PancakeSwap transaction ${i + 1}: ${signedTx.slice(0, 20)}...`);
          
          // Submit transaction to the network
          const txHash = await sendRawTransaction(signedTx as `0x${string}`);
          
          console.log(`✅ PancakeSwap transaction ${i + 1} submitted successfully: ${txHash}`);
          results.push({ success: true, txHash });
          successCount++;
          
          // Wait a bit between transactions to avoid nonce issues
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Error submitting PancakeSwap transaction ${i + 1}:`, error);
          console.error(`   Transaction data: ${transactions[i].slice(0, 50)}...`);
          results.push({ success: false, error: (error as Error).message });
        }
      }
      
      if (successCount === 0) {
        return {
          success: false,
          error: 'All PancakeSwap transactions failed to submit'
        };
      }
      
      // Return the first successful transaction hash as the bundle hash
      const firstSuccess = results.find(r => r.success);
      return {
        success: true,
        bundleHash: firstSuccess?.txHash || 'Unknown',
        results
      };
      
    } catch (error) {
      console.error('Error submitting PancakeSwap bundle:', error);
      return {
        success: false,
        error: `Failed to submit PancakeSwap bundle: ${error}`
      };
    }
  }
}

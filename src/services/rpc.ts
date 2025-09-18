import { createPublicClient, http, fallback, createWalletClient as viemCreateWalletClient, PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { config } from '../config';

/**
 * RPC service with multiple provider fallbacks and retry logic
 */

// Multiple BSC RPC endpoints for redundancy
const BSC_RPC_ENDPOINTS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org', 
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.ninicoin.io',
  'https://bsc-dataseed.binance.org', // Original endpoint as fallback
  'https://bsc.meowrpc.com',
  'https://bsc.publicnode.com',
  'https://bsc-rpc.publicnode.com',
  'https://bsc-mainnet.public.blastapi.io',
];

// Create transport with fallback
const createTransport = () => {
  const transports = BSC_RPC_ENDPOINTS.map(url => 
    http(url, {
      timeout: 10000, // 10 second timeout
      retryCount: 2,
      retryDelay: 1000
    })
  );
  
  return fallback(transports, {
    rank: false, // Don't rank by response time
    retryCount: 3,
    retryDelay: 2000
  });
};

// Create public client with fallback transport
export const publicClient: PublicClient = createPublicClient({
  chain: bsc,
  transport: createTransport()
});

/**
 * Create wallet client for transaction signing
 */
export const createWalletClient = (privateKey: `0x${string}`): any => {
  return viemCreateWalletClient({
    account: privateKeyToAccount(privateKey),
    transport: createTransport(),
    chain: bsc
  });
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds') || 
            error.message.includes('nonce') ||
            error.message.includes('invalid signature')) {
          throw error;
        }
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

/**
 * Get current gas price with retry logic
 */
export const getCurrentGasPrice = async (): Promise<bigint> => {
  return retryWithBackoff(async () => {
    const gasPrice = await publicClient.getGasPrice();
    const gasPriceGwei = Number(gasPrice) / 1e9;
    
    console.log(`Current network gas price: ${gasPriceGwei} gwei`);
    
    // Apply safety multipliers
    const minGasPrice = parseFloat(config.trading.minGasPrice);
    const maxGasPrice = parseFloat(config.trading.maxGasPrice);
    const multiplier = config.trading.gasPriceMultiplier;
    
    let adjustedGasPrice = gasPriceGwei * multiplier;
    
    // Ensure within bounds
    adjustedGasPrice = Math.max(adjustedGasPrice, minGasPrice);
    adjustedGasPrice = Math.min(adjustedGasPrice, maxGasPrice);
    
    console.log(`Adjusted gas price: ${adjustedGasPrice} gwei (multiplier: ${multiplier})`);
    
    return BigInt(Math.floor(adjustedGasPrice * 1e9));
  });
};

/**
 * Get current block number with retry logic
 */
export const getCurrentBlockNumber = async (): Promise<bigint> => {
  return retryWithBackoff(async () => {
    return await publicClient.getBlockNumber();
  });
};

/**
 * Get transaction count (nonce) for an address with retry logic
 */
export const getTransactionCount = async (address: `0x${string}`): Promise<number> => {
  return retryWithBackoff(async () => {
    return await publicClient.getTransactionCount({ address });
  });
};

/**
 * Get balance for an address with retry logic
 */
export const getBalance = async (address: `0x${string}`): Promise<bigint> => {
  return retryWithBackoff(async () => {
    return await publicClient.getBalance({ address });
  });
};

/**
 * Wait for transaction confirmation with retry logic
 */
export const waitForTransaction = async (txHash: `0x${string}`, confirmations: number = 1): Promise<any> => {
  return retryWithBackoff(async () => {
    return await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations
    });
  });
};

/**
 * Check if address is a contract with retry logic
 */
export const isContract = async (address: `0x${string}`): Promise<boolean> => {
  return retryWithBackoff(async () => {
    try {
      const code = await publicClient.getCode({ address });
      return code !== '0x';
    } catch (error) {
      console.error('Error checking if address is contract:', error);
      return false;
    }
  });
};

/**
 * Get block timestamp with retry logic
 */
export const getBlockTimestamp = async (blockNumber: bigint): Promise<bigint> => {
  return retryWithBackoff(async () => {
    const block = await publicClient.getBlock({ blockNumber });
    return block.timestamp;
  });
};

/**
 * Send raw transaction with retry logic
 */
export const sendRawTransaction = async (serializedTransaction: `0x${string}`): Promise<`0x${string}`> => {
  return retryWithBackoff(async () => {
    return await publicClient.sendRawTransaction({ serializedTransaction });
  });
};

/**
 * Get block with retry logic
 */
export const getBlock = async (blockNumber: bigint) => {
  return retryWithBackoff(async () => {
    return await publicClient.getBlock({ blockNumber });
  });
};

/**
 * Test RPC connectivity
 */
export const testRPCConnectivity = async (): Promise<{ success: boolean; workingEndpoints: string[]; errors: string[] }> => {
  const workingEndpoints: string[] = [];
  const errors: string[] = [];
  
  for (const endpoint of BSC_RPC_ENDPOINTS) {
    try {
      const testClient = createPublicClient({
        chain: bsc,
        transport: http(endpoint, { timeout: 5000 })
      });
      
      await testClient.getBlockNumber();
      workingEndpoints.push(endpoint);
      console.log(`✅ RPC endpoint working: ${endpoint}`);
    } catch (error) {
      const errorMsg = `${endpoint}: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.log(`❌ RPC endpoint failed: ${errorMsg}`);
    }
  }
  
  return {
    success: workingEndpoints.length > 0,
    workingEndpoints,
    errors
  };
};

import { JsonRpcProvider } from 'ethers';
import { bsc } from 'viem/chains';
import { config } from '../config';
import { 
  publicClient, 
  createWalletClient,
  getCurrentGasPrice as rpcGetCurrentGasPrice,
  getCurrentBlockNumber as rpcGetCurrentBlockNumber,
  getTransactionCount as rpcGetTransactionCount,
  getBalance as rpcGetBalance,
  waitForTransaction as rpcWaitForTransaction,
  isContract as rpcIsContract,
  getBlockTimestamp as rpcGetBlockTimestamp,
  sendRawTransaction as rpcSendRawTransaction,
  getBlock as rpcGetBlock
} from '../services/rpc';

/**
 * Web3 utilities for BSC network interaction
 * Now uses the robust RPC service with fallbacks
 */

// Create providers - keeping ethers provider for compatibility
export const provider = new JsonRpcProvider(config.BSC_RPC_URL);

// Re-export RPC service functions
export { 
  publicClient, 
  createWalletClient,
  rpcGetCurrentGasPrice as getCurrentGasPrice,
  rpcGetCurrentBlockNumber as getCurrentBlockNumber,
  rpcGetTransactionCount as getTransactionCount,
  rpcGetBalance as getBalance,
  rpcWaitForTransaction as waitForTransaction,
  rpcIsContract as isContract,
  rpcGetBlockTimestamp as getBlockTimestamp,
  rpcSendRawTransaction as sendRawTransaction,
  rpcGetBlock as getBlock
};

// getCurrentGasPrice is now imported from RPC service

/**
 * Estimate gas for a transaction with buffer
 */
export const estimateGasWithBuffer = async (
  gasEstimate: bigint,
  bufferPercentage: number = config.trading.gasLimitBuffer
): Promise<bigint> => {
  const buffer = (gasEstimate * BigInt(bufferPercentage)) / 100n;
  return gasEstimate + buffer;
};

// All other functions are now imported from RPC service

/**
 * Format address for display
 */
export const formatAddress = (address: string, startChars: number = 6, endChars: number = 4): string => {
  if (!address || address.length < startChars + endChars) {
    return address;
  }
  
  const start = address.substring(0, startChars);
  const end = address.substring(address.length - endChars);
  return `${start}...${end}`;
};

/**
 * Convert Wei to Ether
 */
export const weiToEther = (wei: bigint): string => {
  return (Number(wei) / 1e18).toFixed(6);
};

/**
 * Convert Ether to Wei
 */
export const etherToWei = (ether: string): bigint => {
  return BigInt(Math.floor(parseFloat(ether) * 1e18));
};

/**
 * Validate BSC address checksum
 */
export const isValidBSCAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Basic format check
  if (!address.startsWith('0x') || address.length !== 42) {
    return false;
  }
  
  // Hex format check
  const hexPattern = /^0x[a-fA-F0-9]{40}$/;
  return hexPattern.test(address);
};

/**
 * Get network information
 */
export const getNetworkInfo = async () => {
  try {
    const blockNumber = await rpcGetCurrentBlockNumber();
    const gasPrice = await rpcGetCurrentGasPrice();
    
    return {
      chainId: bsc.id,
      name: bsc.name,
      blockNumber: Number(blockNumber),
      gasPrice: weiToEther(gasPrice),
      rpcUrl: config.BSC_RPC_URL
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    throw new Error('Failed to get network information');
  }
};

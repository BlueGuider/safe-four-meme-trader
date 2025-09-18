// Core types for the safe four-meme trader

export interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  createdAt: Date;
  lastUsed?: Date;
  balance?: string; // BNB balance as string
}

export interface UserSession {
  userId: string;
  wallets: WalletData[];
  createdAt: Date;
  lastActivity: Date;
}

export interface TokenInfo {
  version: number;
  tokenManager: `0x${string}`;
  quote: `0x${string}`;
  lastPrice: bigint;
  tradingFeeRate: bigint;
  minTradingFee: bigint;
  launchTime: bigint;
  offers: bigint;
  maxOffers: bigint;
  funds: bigint;
  maxFunds: bigint;
  liquidityAdded: boolean;
}

export interface BuyParams {
  tokenManager: `0x${string}`;
  quote: `0x${string}`;
  estimatedAmount: bigint;
  estimatedCost: bigint;
  estimatedFee: bigint;
  amountMsgValue: bigint;
  amountApproval: bigint;
  amountFunds: bigint;
}

export interface SellParams {
  tokenManager: `0x${string}`;
  quote: `0x${string}`;
  estimatedFunds: bigint;
  estimatedFee: bigint;
}

export interface TokenBalance {
  address: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: string;
  balanceRaw: bigint;
  decimals: number;
}

export interface TradingResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
  blockNumber?: number;
}

export interface BundleResult {
  success: boolean;
  bundleHash?: string;
  error?: string;
  results?: any[];
}

export interface SecurityConfig {
  maxWalletsPerUser: number;
  maxTransactionAmount: string;
  minTransactionAmount: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableEncryption: boolean;
  enableRateLimiting: boolean;
  enableInputValidation: boolean;
}

export interface AutoTradingConfig {
  enabled: boolean;
  maxOrdersPerUser: number;
  priceCheckInterval: number;
  maxSlippage: number;
  minOrderAmount: number;
  maxOrderAmount: number;
}

export interface TradingConfig {
  gasPriceMultiplier: number;
  maxGasPrice: string;
  minGasPrice: string;
  gasLimitBuffer: number;
  maxSlippage: number;
  enableMEVProtection: boolean;
  bundleTimeout: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  timestamp: Date;
}

// Auto Trading Types
export interface AutoTradingOrder {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  orderType: 'BUY' | 'SELL';
  triggerPrice: number; // Price in BNB to trigger the order
  amount: number; // Amount of BNB to buy or percentage to sell
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  executedAt?: Date;
  executionPrice?: number;
  executionTxHash?: string;
  profitTarget?: number; // For sell orders - sell when profit reaches this percentage
  stopLoss?: number; // For sell orders - sell when loss reaches this percentage
}

export interface PriceData {
  tokenAddress: string;
  price: number; // Price in BNB
  timestamp: Date;
  volume24h?: number;
  marketCap?: number;
}

export interface AutoTradingConfig {
  enabled: boolean;
  maxOrdersPerUser: number;
  priceCheckInterval: number; // milliseconds
  maxSlippage: number; // percentage
  minOrderAmount: number; // BNB
  maxOrderAmount: number; // BNB
}

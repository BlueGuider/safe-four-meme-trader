import dotenv from 'dotenv';
import { SecurityConfig, TradingConfig } from '../types';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'BSC_RPC_URL',
  'BOT_TOKEN',
  'ENCRYPTION_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Validate encryption key length
if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

export const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Network Configuration
  BSC_RPC_URL: process.env.BSC_RPC_URL!,
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  
  // BloxRoute Configuration
  BLOXROUTE_API_KEY: process.env.BLOXROUTE_API_KEY,
  BLOXROUTE_BSC_BUNDLE_URL: process.env.BLOXROUTE_BSC_BUNDLE_URL || 'https://api.blxrbdn.com',
  
  // Telegram Bot
  BOT_TOKEN: process.env.BOT_TOKEN!,
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
  
  // Server
  PORT: parseInt(process.env.PORT || '3000'),
  HOST: process.env.HOST || 'localhost',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
  
  // Security Configuration
  security: {
    maxWalletsPerUser: parseInt(process.env.MAX_WALLETS_PER_USER || '10'),
    maxTransactionAmount: process.env.MAX_TRANSACTION_AMOUNT || '10', // BNB
    minTransactionAmount: process.env.MIN_TRANSACTION_AMOUNT || '0.000001', // BNB
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    enableEncryption: process.env.ENABLE_ENCRYPTION !== 'false',
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    enableInputValidation: process.env.ENABLE_INPUT_VALIDATION !== 'false'
  } as SecurityConfig,
  
  // Trading Configuration
  trading: {
    gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.0'),
    maxGasPrice: process.env.MAX_GAS_PRICE || '20', // gwei
    minGasPrice: process.env.MIN_GAS_PRICE || '0.1', // gwei
    gasLimitBuffer: parseInt(process.env.GAS_LIMIT_BUFFER || '20'), // percentage
    maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '5'), // percentage
    enableMEVProtection: process.env.ENABLE_MEV_PROTECTION !== 'false',
    bundleTimeout: parseInt(process.env.BUNDLE_TIMEOUT || '30000') // milliseconds
  } as TradingConfig,

  // Auto Trading Configuration
  autoTrading: {
    enabled: process.env.AUTO_TRADING_ENABLED !== 'false',
    maxOrdersPerUser: parseInt(process.env.MAX_AUTO_ORDERS_PER_USER || '10'),
    priceCheckInterval: parseInt(process.env.PRICE_CHECK_INTERVAL || '30000'), // 30 seconds
    maxSlippage: parseFloat(process.env.AUTO_TRADING_MAX_SLIPPAGE || '5'), // percentage
    minOrderAmount: parseFloat(process.env.AUTO_TRADING_MIN_AMOUNT || '0.001'), // BNB
    maxOrderAmount: parseFloat(process.env.AUTO_TRADING_MAX_AMOUNT || '1.0') // BNB
  } as any
};

// Contract addresses
export const CONTRACT_ADDRESSES = {
  TOKEN_MANAGER_HELPER: '0xF251F83e40a78868FcfA3FA4599Dad6494E46034', // BSC
  TOKEN_MANAGER_V1: '0xEC4549caDcE5DA21Df6E6422d448034B5233bFbC', // BSC
  TOKEN_MANAGER_V2: '0x5c952063c7fc8610FFDB798152D69F0B9550762b', // BSC
  // PancakeSwap contracts
  PANCAKESWAP_V2_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC
  PANCAKESWAP_V3_ROUTER: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', // BSC
  PANCAKESWAP_V2_FACTORY: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73', // BSC
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // Wrapped BNB
} as const;

// Gas limits
export const GAS_LIMITS = {
  BUY: 400000n,
  SELL: 500000n,
  APPROVE: 100000n,
  TRANSFER: 21000n,
} as const;

// Validation constants
export const VALIDATION = {
  ADDRESS_LENGTH: 42,
  ADDRESS_PREFIX: '0x',
  MIN_AMOUNT: '0.000001',
  MAX_AMOUNT: '1000',
  MAX_WALLETS: 50,
  MIN_WALLETS: 1,
} as const;

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityUtils } from '../utils/security';
import { ValidationUtils } from '../utils/validation';
import { getBalance, createWalletClient } from '../utils/web3';
import { WalletData, UserSession, ApiResponse } from '../types';
import { config } from '../config';

/**
 * Secure wallet management service
 * Features:
 * - Encrypted private key storage
 * - User session management
 * - Input validation
 * - Rate limiting
 * - Secure file operations
 */

const WALLETS_DIR = path.join(__dirname, '../../data/wallets');
const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');

// Ensure directories exist
if (!fs.existsSync(WALLETS_DIR)) {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// In-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export class WalletService {
  /**
   * Create multiple wallets for a user
   */
  static async createWallets(
    userId: string, 
    count: number
  ): Promise<ApiResponse<{ wallets: WalletData[]; count: number }>> {
    try {
      // Validate input
      const validation = ValidationUtils.validateWalletCount(count);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          timestamp: new Date()
        };
      }

      // Check rate limiting
      if (!SecurityUtils.checkRateLimit(userId, rateLimitMap)) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          timestamp: new Date()
        };
      }

      // Load existing wallets
      const existingWallets = this.loadWallets(userId);
      
      // Check wallet limit
      if (existingWallets.length + count > config.security.maxWalletsPerUser) {
        return {
          success: false,
          error: `Cannot create ${count} wallets. Maximum allowed: ${config.security.maxWalletsPerUser}. Current: ${existingWallets.length}`,
          timestamp: new Date()
        };
      }

      // Create new wallets
      const newWallets: WalletData[] = [];
      for (let i = 0; i < count; i++) {
        const wallet = ethers.Wallet.createRandom();
        const encryptedPrivateKey = SecurityUtils.encrypt(wallet.privateKey);
        
        newWallets.push({
          address: wallet.address,
          encryptedPrivateKey,
          createdAt: new Date()
        });
      }

      // Save all wallets
      const allWallets = [...existingWallets, ...newWallets];
      this.saveWallets(userId, allWallets);

      // Update user session
      this.updateUserSession(userId, allWallets);

      return {
        success: true,
        data: {
          wallets: newWallets.map(w => ({
            address: w.address,
            encryptedPrivateKey: SecurityUtils.maskSensitiveData(w.encryptedPrivateKey),
            createdAt: w.createdAt
          })),
          count: newWallets.length
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error creating wallets:', error);
      return {
        success: false,
        error: 'Failed to create wallets',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get wallets for a user (without private keys)
   */
  static async getWallets(userId: string): Promise<ApiResponse<{ wallets: Omit<WalletData, 'encryptedPrivateKey'>[] }>> {
    try {
      const wallets = this.loadWallets(userId);
      
      if (wallets.length === 0) {
        return {
          success: true,
          data: { wallets: [] },
          timestamp: new Date()
        };
      }

      // Get balances for all wallets
      const walletsWithBalances = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            const balance = await getBalance(wallet.address as `0x${string}`);
            return {
              address: wallet.address,
              createdAt: wallet.createdAt,
              lastUsed: wallet.lastUsed,
              balance: (Number(balance) / 1e18).toFixed(6)
            };
          } catch (error) {
            console.error(`Error getting balance for ${wallet.address}:`, error);
            return {
              address: wallet.address,
              createdAt: wallet.createdAt,
              lastUsed: wallet.lastUsed,
              balance: '0.000000'
            };
          }
        })
      );

      return {
        success: true,
        data: { wallets: walletsWithBalances },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting wallets:', error);
      return {
        success: false,
        error: 'Failed to get wallets',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get wallet addresses for a user
   */
  static getWalletAddresses(userId: string): string[] {
    const wallets = this.loadWallets(userId);
    return wallets.map(wallet => wallet.address);
  }

  /**
   * Check wallet balances and return funding recommendations
   */
  static async checkWalletBalances(userId: string): Promise<{
    totalWallets: number;
    fundedWallets: number;
    unfundedWallets: string[];
    totalBalance: number;
    averageBalance: number;
    recommendations: string[];
  }> {
    try {
      const wallets = this.loadWallets(userId);
      if (wallets.length === 0) {
        return {
          totalWallets: 0,
          fundedWallets: 0,
          unfundedWallets: [],
          totalBalance: 0,
          averageBalance: 0,
          recommendations: ['Create wallets first using /create command']
        };
      }

      let fundedWallets = 0;
      let totalBalance = 0;
      const unfundedWallets: string[] = [];
      const minBalance = 0.01; // Minimum 0.01 BNB for trading

      for (const wallet of wallets) {
        try {
          const balance = await getBalance(wallet.address as `0x${string}`);
          const balanceBNB = Number(balance) / 1e18;
          totalBalance += balanceBNB;

          if (balanceBNB >= minBalance) {
            fundedWallets++;
          } else {
            unfundedWallets.push(wallet.address);
          }
        } catch (error) {
          console.error(`Error checking balance for ${wallet.address}:`, error);
          unfundedWallets.push(wallet.address);
        }
      }

      const averageBalance = totalBalance / wallets.length;
      const recommendations: string[] = [];

      if (fundedWallets === 0) {
        recommendations.push('❌ No wallets have sufficient funds for trading');
        recommendations.push('💡 Fund your wallets with at least 0.01 BNB each');
        recommendations.push('💡 You can fund wallets by sending BNB to their addresses');
      } else if (fundedWallets < wallets.length) {
        recommendations.push(`⚠️  Only ${fundedWallets}/${wallets.length} wallets are funded`);
        recommendations.push('💡 Fund the remaining wallets for better copy trading coverage');
      } else {
        recommendations.push('✅ All wallets are properly funded');
      }

      if (averageBalance < 0.05) {
        recommendations.push('💡 Consider adding more BNB for larger trades and gas fees');
      }

      return {
        totalWallets: wallets.length,
        fundedWallets,
        unfundedWallets,
        totalBalance,
        averageBalance,
        recommendations
      };
    } catch (error) {
      console.error('Error checking wallet balances:', error);
      return {
        totalWallets: 0,
        fundedWallets: 0,
        unfundedWallets: [],
        totalBalance: 0,
        averageBalance: 0,
        recommendations: ['Error checking wallet balances']
      };
    }
  }

  /**
   * Get wallet by address (with decrypted private key for internal use)
   */
  static getWalletByAddress(userId: string, address: string): { wallet: WalletData; privateKey: string } | null {
    const wallets = this.loadWallets(userId);
    const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    
    if (!wallet) {
      return null;
    }

    try {
      const privateKey = SecurityUtils.decrypt(wallet.encryptedPrivateKey);
      return { wallet, privateKey };
    } catch (error) {
      console.error('Error decrypting private key:', error);
      return null;
    }
  }

  /**
   * Create wallet client for transaction signing
   */
  static createWalletClient(userId: string, address: string): any {
    const walletData = this.getWalletByAddress(userId, address);
    if (!walletData) {
      throw new Error('Wallet not found or access denied');
    }

    return createWalletClient(walletData.privateKey as `0x${string}`);
  }

  /**
   * Update wallet last used timestamp
   */
  static updateWalletLastUsed(userId: string, address: string): void {
    const wallets = this.loadWallets(userId);
    const walletIndex = wallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
    
    if (walletIndex !== -1) {
      wallets[walletIndex].lastUsed = new Date();
      this.saveWallets(userId, wallets);
    }
  }

  /**
   * Delete a wallet
   */
  static deleteWallet(userId: string, address: string): ApiResponse<{ success: boolean }> {
    try {
      const wallets = this.loadWallets(userId);
      const filteredWallets = wallets.filter(w => w.address.toLowerCase() !== address.toLowerCase());
      
      if (filteredWallets.length === wallets.length) {
        return {
          success: false,
          error: 'Wallet not found',
          timestamp: new Date()
        };
      }

      this.saveWallets(userId, filteredWallets);
      this.updateUserSession(userId, filteredWallets);

      return {
        success: true,
        data: { success: true },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error deleting wallet:', error);
      return {
        success: false,
        error: 'Failed to delete wallet',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(userId: string): Promise<ApiResponse<{
    totalWallets: number;
    totalBalance: string;
    walletsWithBalance: number;
    lastActivity: Date;
  }>> {
    try {
      const wallets = this.loadWallets(userId);
      const session = this.loadUserSession(userId);
      
      let totalBalance = 0;
      let walletsWithBalance = 0;

      for (const wallet of wallets) {
        try {
          const balance = await getBalance(wallet.address as `0x${string}`);
          const balanceBNB = Number(balance) / 1e18;
          totalBalance += balanceBNB;
          
          if (balanceBNB > 0) {
            walletsWithBalance++;
          }
        } catch (error) {
          console.error(`Error getting balance for ${wallet.address}:`, error);
        }
      }

      return {
        success: true,
        data: {
          totalWallets: wallets.length,
          totalBalance: totalBalance.toFixed(6),
          walletsWithBalance,
          lastActivity: session?.lastActivity || new Date()
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        success: false,
        error: 'Failed to get user statistics',
        timestamp: new Date()
      };
    }
  }

  // Private methods

  private static loadWallets(userId: string): WalletData[] {
    const userWalletFile = path.join(WALLETS_DIR, `${userId}.json`);
    
    if (!fs.existsSync(userWalletFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(userWalletFile, 'utf8');
      const wallets = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return wallets.map((wallet: any) => ({
        ...wallet,
        createdAt: new Date(wallet.createdAt),
        lastUsed: wallet.lastUsed ? new Date(wallet.lastUsed) : undefined
      }));
    } catch (error) {
      console.error('Error loading wallets:', error);
      return [];
    }
  }

  private static saveWallets(userId: string, wallets: WalletData[]): void {
    const userWalletFile = path.join(WALLETS_DIR, `${userId}.json`);
    
    try {
      fs.writeFileSync(userWalletFile, JSON.stringify(wallets, null, 2));
    } catch (error) {
      console.error('Error saving wallets:', error);
      throw new Error('Failed to save wallets');
    }
  }

  private static loadUserSession(userId: string): UserSession | null {
    const sessionFile = path.join(SESSIONS_DIR, `${userId}.json`);
    
    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(sessionFile, 'utf8');
      const session = JSON.parse(data);
      
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity)
      };
    } catch (error) {
      console.error('Error loading user session:', error);
      return null;
    }
  }

  private static updateUserSession(userId: string, wallets: WalletData[]): void {
    const sessionFile = path.join(SESSIONS_DIR, `${userId}.json`);
    const now = new Date();
    
    const session: UserSession = {
      userId,
      wallets: wallets.map(w => ({
        address: w.address,
        encryptedPrivateKey: SecurityUtils.maskSensitiveData(w.encryptedPrivateKey),
        createdAt: w.createdAt,
        lastUsed: w.lastUsed
      })),
      createdAt: now,
      lastActivity: now
    };

    try {
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error('Error updating user session:', error);
    }
  }
}

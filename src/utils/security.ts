import * as crypto from 'crypto';
import { config } from '../config';

/**
 * Security utilities for encryption, validation, and safety
 */

export class SecurityUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  private static readonly TAG_LENGTH = 16;

  /**
   * Encrypt sensitive data like private keys
   */
  static encrypt(text: string): string {
    if (!config.security.enableEncryption) {
      return text; // Return plain text if encryption is disabled
    }

    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const key = crypto.pbkdf2Sync(config.ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
      
      const cipher = crypto.createCipher(this.ALGORITHM, key);
      cipher.setAAD(salt);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string): string {
    if (!config.security.enableEncryption) {
      return encryptedData; // Return as-is if encryption is disabled
    }

    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      const salt = combined.subarray(0, this.SALT_LENGTH);
      const tag = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      
      const key = crypto.pbkdf2Sync(config.ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Generate a secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data for integrity checking
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate Ethereum address format
   */
  static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    // Check basic format
    if (!address.startsWith('0x') || address.length !== 42) {
      return false;
    }
    
    // Check if it's a valid hex string
    const hexPattern = /^0x[a-fA-F0-9]{40}$/;
    return hexPattern.test(address);
  }

  /**
   * Validate amount (must be positive number)
   */
  static isValidAmount(amount: string | number): boolean {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(num) || num <= 0) {
      return false;
    }
    
    // Check against configured limits
    const minAmount = parseFloat(config.security.minTransactionAmount);
    const maxAmount = parseFloat(config.security.maxTransactionAmount);
    
    return num >= minAmount && num <= maxAmount;
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
      .replace(/[;|&$`]/g, '') // Remove shell injection characters
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate percentage (0-100)
   */
  static isValidPercentage(percentage: number): boolean {
    return !isNaN(percentage) && percentage >= 0 && percentage <= 100;
  }

  /**
   * Check if user has exceeded rate limits
   */
  static checkRateLimit(userId: string, requestCount: Map<string, { count: number; resetTime: number }>): boolean {
    if (!config.security.enableRateLimiting) {
      return true;
    }

    const now = Date.now();
    const userData = requestCount.get(userId);
    
    if (!userData) {
      requestCount.set(userId, {
        count: 1,
        resetTime: now + config.security.rateLimitWindowMs
      });
      return true;
    }
    
    // Reset if window has passed
    if (now > userData.resetTime) {
      requestCount.set(userId, {
        count: 1,
        resetTime: now + config.security.rateLimitWindowMs
      });
      return true;
    }
    
    // Check if under limit
    if (userData.count < config.security.rateLimitMaxRequests) {
      userData.count++;
      return true;
    }
    
    return false;
  }

  /**
   * Generate secure session token
   */
  static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate wallet count per user
   */
  static validateWalletCount(currentCount: number): boolean {
    return currentCount >= 0 && currentCount <= config.security.maxWalletsPerUser;
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars * 2) {
      return '***';
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(data.length - (visibleChars * 2));
    
    return `${start}${middle}${end}`;
  }
}

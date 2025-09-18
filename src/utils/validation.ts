import Joi from 'joi';
import { SecurityUtils } from './security';
import { VALIDATION } from '../config';
import { publicClient } from './web3';

/**
 * Input validation schemas and utilities
 */

export class ValidationUtils {
  // Common validation schemas
  static readonly addressSchema = Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Ethereum address format',
      'any.required': 'Address is required'
    });

  static readonly amountSchema = Joi.string()
    .pattern(/^\d*\.?\d+$/)
    .custom((value, helpers) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return helpers.error('number.positive');
      }
      if (num < parseFloat(VALIDATION.MIN_AMOUNT)) {
        return helpers.error('number.min');
      }
      if (num > parseFloat(VALIDATION.MAX_AMOUNT)) {
        return helpers.error('number.max');
      }
      return value;
    })
    .required()
    .messages({
      'number.positive': 'Amount must be positive',
      'number.min': `Amount must be at least ${VALIDATION.MIN_AMOUNT}`,
      'number.max': `Amount must not exceed ${VALIDATION.MAX_AMOUNT}`,
      'any.required': 'Amount is required'
    });

  static readonly percentageSchema = Joi.number()
    .min(0)
    .max(100)
    .required()
    .messages({
      'number.min': 'Percentage must be at least 0',
      'number.max': 'Percentage must not exceed 100',
      'any.required': 'Percentage is required'
    });

  static readonly walletCountSchema = Joi.number()
    .integer()
    .min(VALIDATION.MIN_WALLETS)
    .max(VALIDATION.MAX_WALLETS)
    .required()
    .messages({
      'number.integer': 'Wallet count must be an integer',
      'number.min': `Wallet count must be at least ${VALIDATION.MIN_WALLETS}`,
      'number.max': `Wallet count must not exceed ${VALIDATION.MAX_WALLETS}`,
      'any.required': 'Wallet count is required'
    });

  // Validation schemas for different operations
  static readonly createWalletsSchema = Joi.object({
    count: this.walletCountSchema,
    userId: Joi.string().required()
  });

  static readonly buyTokensSchema = Joi.object({
    tokenAddress: this.addressSchema,
    bnbAmount: this.amountSchema,
    userId: Joi.string().required()
  });

  static readonly sellTokensSchema = Joi.object({
    tokenAddress: this.addressSchema,
    sellPercentage: this.percentageSchema,
    userId: Joi.string().required()
  });

  static readonly distributeTokensSchema = Joi.object({
    amount: this.amountSchema,
    userId: Joi.string().required()
  });

  static readonly getTokenBalancesSchema = Joi.object({
    tokenAddress: this.addressSchema,
    userId: Joi.string().required()
  });

  /**
   * Validate data against a schema
   */
  static validate<T>(schema: Joi.ObjectSchema, data: any): { error?: string; value?: T } {
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      return { error: errorMessage };
    }
    
    return { value };
  }

  /**
   * Validate Ethereum address with additional checks
   */
  static validateAddress(address: string): { isValid: boolean; error?: string } {
    if (!address) {
      return { isValid: false, error: 'Address is required' };
    }

    if (!SecurityUtils.isValidAddress(address)) {
      return { isValid: false, error: 'Invalid address format' };
    }

    return { isValid: true };
  }

  /**
   * Validate amount with additional checks
   */
  static validateAmount(amount: string | number): { isValid: boolean; error?: string; value?: number } {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(num)) {
      return { isValid: false, error: 'Amount must be a valid number' };
    }

    if (!SecurityUtils.isValidAmount(amount)) {
      return { 
        isValid: false, 
        error: `Amount must be between ${VALIDATION.MIN_AMOUNT} and ${VALIDATION.MAX_AMOUNT}` 
      };
    }

    return { isValid: true, value: num };
  }

  /**
   * Validate percentage
   */
  static validatePercentage(percentage: number): { isValid: boolean; error?: string } {
    if (!SecurityUtils.isValidPercentage(percentage)) {
      return { isValid: false, error: 'Percentage must be between 0 and 100' };
    }

    return { isValid: true };
  }

  /**
   * Validate wallet count
   */
  static validateWalletCount(count: number): { isValid: boolean; error?: string } {
    if (!Number.isInteger(count)) {
      return { isValid: false, error: 'Wallet count must be an integer' };
    }

    if (count < VALIDATION.MIN_WALLETS || count > VALIDATION.MAX_WALLETS) {
      return { 
        isValid: false, 
        error: `Wallet count must be between ${VALIDATION.MIN_WALLETS} and ${VALIDATION.MAX_WALLETS}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitize and validate user input
   */
  static sanitizeAndValidate(input: any): any {
    if (typeof input === 'string') {
      return SecurityUtils.sanitizeInput(input);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeAndValidate(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeAndValidate(value);
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Validate transaction parameters
   */
  static validateTransactionParams(params: {
    tokenAddress: string;
    amount?: string;
    percentage?: number;
    userId: string;
  }): { isValid: boolean; error?: string } {
    // Validate token address
    const addressValidation = this.validateAddress(params.tokenAddress);
    if (!addressValidation.isValid) {
      return addressValidation;
    }

    // Validate amount if provided
    if (params.amount) {
      const amountValidation = this.validateAmount(params.amount);
      if (!amountValidation.isValid) {
        return amountValidation;
      }
    }

    // Validate percentage if provided
    if (params.percentage !== undefined) {
      const percentageValidation = this.validatePercentage(params.percentage);
      if (!percentageValidation.isValid) {
        return percentageValidation;
      }
    }

    // Validate userId
    if (!params.userId || typeof params.userId !== 'string') {
      return { isValid: false, error: 'Valid user ID is required' };
    }

    return { isValid: true };
  }

  /**
   * Validate if a token address is a valid ERC20 contract
   */
  static async validateTokenContract(tokenAddress: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // First validate the address format
      const addressValidation = this.validateAddress(tokenAddress);
      if (!addressValidation.isValid) {
        return addressValidation;
      }

      // Check if contract exists
      const code = await publicClient.getCode({ address: tokenAddress as `0x${string}` });
      if (code === '0x') {
        return { isValid: false, error: 'No contract found at this address' };
      }

      // Try to call a basic ERC20 function to verify it's a token contract
      try {
        await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: [
            {
              name: 'totalSupply',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }]
            }
          ],
          functionName: 'totalSupply'
        });
      } catch (error: any) {
        if (error.message?.includes('returned no data') || error.message?.includes('0x')) {
          return { isValid: false, error: 'Contract does not implement ERC20 standard' };
        }
        throw error;
      }

      return { isValid: true };
    } catch (error: any) {
      return { 
        isValid: false, 
        error: `Token validation failed: ${error.message || 'Unknown error'}` 
      };
    }
  }
}

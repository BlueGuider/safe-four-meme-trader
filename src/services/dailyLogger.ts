import * as fs from 'fs';
import * as path from 'path';

/**
 * Daily Logger Service
 * 
 * Features:
 * - Daily log files for trades and unmatched patterns
 * - Automatic log rotation
 * - Structured JSON logging
 * - Easy analysis and monitoring
 */

export interface TradeLogEntry {
  timestamp: string;
  type: 'TRADE_EXECUTED' | 'TRADE_SIMULATED' | 'TRADE_FAILED';
  blockNumber: number;
  tokenAddress: string;
  creatorAddress: string;
  transactionHash: string;
  pattern: string;
  confidence: number;
  buyAmount: number;
  gasPrice: number;
  gasLimit: number;
  transactionValue: number;
  tradeResult: boolean;
  tradeTxHash?: string;
  successCount?: number;
  totalWallets?: number;
  error?: string;
}

export interface UnmatchedPatternLogEntry {
  timestamp: string;
  type: 'UNMATCHED_PATTERN';
  blockNumber: number;
  tokenAddress: string;
  creatorAddress: string;
  transactionHash: string;
  gasPrice: number;
  gasLimit: number;
  transactionValue: number;
  reason: string;
  patternAnalysis: {
    gasPriceMatch: boolean;
    gasLimitMatch: boolean;
    transactionValueMatch: boolean;
    gasPriceRange: { min: number; max: number };
    gasLimitRange: { min: number; max: number };
    transactionValueRange: { min: number; max: number };
  };
}

export class DailyLogger {
  private static logsDir = path.join(process.cwd(), 'logs');
  private static tradesDir = path.join(this.logsDir, 'trades');
  private static patternsDir = path.join(this.logsDir, 'patterns');

  /**
   * Initialize logging directories
   */
  static initialize() {
    // Create logs directory
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Create trades directory
    if (!fs.existsSync(this.tradesDir)) {
      fs.mkdirSync(this.tradesDir, { recursive: true });
    }

    // Create patterns directory
    if (!fs.existsSync(this.patternsDir)) {
      fs.mkdirSync(this.patternsDir, { recursive: true });
    }
  }

  /**
   * Get today's date string for filename
   */
  private static getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Get current timestamp
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Log a trade entry
   */
  static logTrade(entry: Omit<TradeLogEntry, 'timestamp'>): void {
    try {
      this.initialize();
      
      const logEntry: TradeLogEntry = {
        ...entry,
        timestamp: this.getTimestamp()
      };

      const filename = `trades-${this.getTodayString()}.json`;
      const filepath = path.join(this.tradesDir, filename);

      // Read existing logs or create new array
      let logs: TradeLogEntry[] = [];
      if (fs.existsSync(filepath)) {
        try {
          const data = fs.readFileSync(filepath, 'utf8');
          logs = JSON.parse(data);
        } catch (error) {
          console.error('Error reading existing trade logs:', error);
        }
      }

      // Add new entry
      logs.push(logEntry);

      // Write back to file
      fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));

      // Also write to console
      console.log(`📋 Trade logged to: ${filename}`);
      console.log(`   Type: ${logEntry.type}`);
      console.log(`   Token: ${logEntry.tokenAddress}`);
      console.log(`   Pattern: ${logEntry.pattern}`);
      console.log(`   Result: ${logEntry.tradeResult ? 'SUCCESS' : 'FAILED'}`);

    } catch (error) {
      console.error('Error logging trade:', error);
    }
  }

  /**
   * Log an unmatched pattern entry
   */
  static logUnmatchedPattern(entry: Omit<UnmatchedPatternLogEntry, 'timestamp' | 'type'>): void {
    try {
      this.initialize();
      
      const logEntry: UnmatchedPatternLogEntry = {
        ...entry,
        timestamp: this.getTimestamp(),
        type: 'UNMATCHED_PATTERN'
      };

      const filename = `unmatched-patterns-${this.getTodayString()}.json`;
      const filepath = path.join(this.patternsDir, filename);

      // Read existing logs or create new array
      let logs: UnmatchedPatternLogEntry[] = [];
      if (fs.existsSync(filepath)) {
        try {
          const data = fs.readFileSync(filepath, 'utf8');
          logs = JSON.parse(data);
        } catch (error) {
          console.error('Error reading existing pattern logs:', error);
        }
      }

      // Add new entry
      logs.push(logEntry);

      // Write back to file
      fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));

      // Also write to console
      console.log(`📋 Unmatched pattern logged to: ${filename}`);
      console.log(`   Token: ${logEntry.tokenAddress}`);
      console.log(`   Reason: ${logEntry.reason}`);
      console.log(`   Gas Price: ${logEntry.gasPrice} gwei`);
      console.log(`   Gas Limit: ${logEntry.gasLimit.toLocaleString()}`);

    } catch (error) {
      console.error('Error logging unmatched pattern:', error);
    }
  }

  /**
   * Get today's trade logs
   */
  static getTodayTrades(): TradeLogEntry[] {
    try {
      this.initialize();
      const filename = `trades-${this.getTodayString()}.json`;
      const filepath = path.join(this.tradesDir, filename);

      if (!fs.existsSync(filepath)) {
        return [];
      }

      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading today\'s trades:', error);
      return [];
    }
  }

  /**
   * Get today's unmatched patterns
   */
  static getTodayUnmatchedPatterns(): UnmatchedPatternLogEntry[] {
    try {
      this.initialize();
      const filename = `unmatched-patterns-${this.getTodayString()}.json`;
      const filepath = path.join(this.patternsDir, filename);

      if (!fs.existsSync(filepath)) {
        return [];
      }

      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading today\'s unmatched patterns:', error);
      return [];
    }
  }

  /**
   * Get log statistics for today
   */
  static getTodayStats(): {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    simulatedTrades: number;
    totalUnmatchedPatterns: number;
    totalVolume: number;
  } {
    const trades = this.getTodayTrades();
    const unmatchedPatterns = this.getTodayUnmatchedPatterns();

    const successfulTrades = trades.filter(t => t.tradeResult && t.type === 'TRADE_EXECUTED').length;
    const failedTrades = trades.filter(t => !t.tradeResult).length;
    const simulatedTrades = trades.filter(t => t.type === 'TRADE_SIMULATED').length;
    const totalVolume = trades.reduce((sum, t) => sum + t.buyAmount, 0);

    return {
      totalTrades: trades.length,
      successfulTrades,
      failedTrades,
      simulatedTrades,
      totalUnmatchedPatterns: unmatchedPatterns.length,
      totalVolume
    };
  }

  /**
   * Clean up old log files (keep last 30 days)
   */
  static cleanupOldLogs(): void {
    try {
      this.initialize();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Clean up trade logs
      const tradeFiles = fs.readdirSync(this.tradesDir);
      for (const file of tradeFiles) {
        if (file.startsWith('trades-') && file.endsWith('.json')) {
          const dateStr = file.replace('trades-', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < thirtyDaysAgo) {
            fs.unlinkSync(path.join(this.tradesDir, file));
            console.log(`🗑️ Cleaned up old trade log: ${file}`);
          }
        }
      }

      // Clean up pattern logs
      const patternFiles = fs.readdirSync(this.patternsDir);
      for (const file of patternFiles) {
        if (file.startsWith('unmatched-patterns-') && file.endsWith('.json')) {
          const dateStr = file.replace('unmatched-patterns-', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < thirtyDaysAgo) {
            fs.unlinkSync(path.join(this.patternsDir, file));
            console.log(`🗑️ Cleaned up old pattern log: ${file}`);
          }
        }
      }

    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}

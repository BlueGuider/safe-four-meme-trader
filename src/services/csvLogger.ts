import fs from 'fs';
import path from 'path';

export interface TradingRecord {
  // Basic Token Info
  tokenAddress: string;
  tokenName?: string;
  tokenCreator?: string;
  
  // Trading Details
  platform: 'four.meme' | 'PancakeSwap';
  buyAmountBNB: number;
  sellAmountBNB?: number;
  tokenAmount: number;
  
  // Price Tracking
  buyPriceBNB: number;
  buyPriceUSD: number;
  sellPriceBNB?: number;
  sellPriceUSD?: number;
  maxPriceReachedBNB: number;
  maxPriceReachedUSD: number;
  
  // Performance Metrics
  profitLossBNB?: number;
  profitLossUSD?: number;
  priceChangePercent: number;
  maxPriceChangePercent: number;
  timeToMaxPriceSeconds?: number;
  
  // Timestamps
  buyTime: Date;
  sellTime?: Date;
  maxPriceTime?: Date;
  
  // Transaction Hashes
  buyTxHash?: string;
  sellTxHash?: string;
  
  // User Info
  userId: string;
  walletAddress: string;
}

export class CSVLogger {
  private static instance: CSVLogger;
  private logDirectory: string;
  private currentDate: string;

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'trading_logs');
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  static getInstance(): CSVLogger {
    if (!CSVLogger.instance) {
      CSVLogger.instance = new CSVLogger();
    }
    return CSVLogger.instance;
  }

  /**
   * Log a buy transaction
   */
  async logBuyTransaction(record: Omit<TradingRecord, 'sellAmountBNB' | 'sellPriceBNB' | 'sellPriceUSD' | 'sellTime' | 'sellTxHash' | 'profitLossBNB' | 'profitLossUSD'>): Promise<void> {
    try {
      const csvRecord = this.formatBuyRecord(record);
      await this.writeToCSV(csvRecord);
      
      console.log(`📊 Buy transaction logged to CSV: ${record.tokenAddress.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error logging buy transaction to CSV:', error);
    }
  }

  /**
   * Log a sell transaction and update existing record
   */
  async logSellTransaction(record: Partial<TradingRecord> & { tokenAddress: string; userId: string; walletAddress: string }): Promise<void> {
    try {
      const csvRecord = this.formatSellRecord(record);
      await this.writeToCSV(csvRecord);
      
      console.log(`📊 Sell transaction logged to CSV: ${record.tokenAddress.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error logging sell transaction to CSV:', error);
    }
  }

  /**
   * Update a record with max price information
   */
  async updateMaxPrice(record: Partial<TradingRecord> & { tokenAddress: string; userId: string; walletAddress: string }): Promise<void> {
    try {
      const csvRecord = this.formatMaxPriceRecord(record);
      await this.writeToCSV(csvRecord);
    } catch (error) {
      console.error('Error updating max price in CSV:', error);
    }
  }

  /**
   * Format buy record for CSV
   */
  private formatBuyRecord(record: Omit<TradingRecord, 'sellAmountBNB' | 'sellPriceBNB' | 'sellPriceUSD' | 'sellTime' | 'sellTxHash' | 'profitLossBNB' | 'profitLossUSD'>): string {
    return [
      record.tokenAddress,
      record.tokenName || 'Unknown',
      record.tokenCreator || 'Unknown',
      record.platform,
      record.buyAmountBNB.toFixed(8),
      '', // sellAmountBNB
      record.tokenAmount.toFixed(2),
      record.buyPriceBNB.toFixed(8),
      record.buyPriceUSD.toFixed(4),
      '', // sellPriceBNB
      '', // sellPriceUSD
      record.maxPriceReachedBNB.toFixed(8),
      record.maxPriceReachedUSD.toFixed(4),
      '', // profitLossBNB
      '', // profitLossUSD
      record.priceChangePercent.toFixed(2),
      record.maxPriceChangePercent.toFixed(2),
      record.timeToMaxPriceSeconds?.toFixed(0) || '',
      record.buyTime.toISOString(),
      '', // sellTime
      record.maxPriceTime?.toISOString() || '',
      record.buyTxHash || '',
      '', // sellTxHash
      record.userId,
      record.walletAddress
    ].map(field => `"${field}"`).join(',');
  }

  /**
   * Format sell record for CSV
   */
  private formatSellRecord(record: Partial<TradingRecord> & { tokenAddress: string; userId: string; walletAddress: string }): string {
    return [
      record.tokenAddress,
      record.tokenName || 'Unknown',
      record.tokenCreator || 'Unknown',
      record.platform || '',
      record.buyAmountBNB?.toFixed(8) || '',
      record.sellAmountBNB?.toFixed(8) || '',
      record.tokenAmount?.toFixed(2) || '',
      record.buyPriceBNB?.toFixed(8) || '',
      record.buyPriceUSD?.toFixed(4) || '',
      record.sellPriceBNB?.toFixed(8) || '',
      record.sellPriceUSD?.toFixed(4) || '',
      record.maxPriceReachedBNB?.toFixed(8) || '',
      record.maxPriceReachedUSD?.toFixed(4) || '',
      record.profitLossBNB?.toFixed(8) || '',
      record.profitLossUSD?.toFixed(4) || '',
      record.priceChangePercent?.toFixed(2) || '',
      record.maxPriceChangePercent?.toFixed(2) || '',
      record.timeToMaxPriceSeconds?.toFixed(0) || '',
      record.buyTime?.toISOString() || '',
      record.sellTime?.toISOString() || '',
      record.maxPriceTime?.toISOString() || '',
      record.buyTxHash || '',
      record.sellTxHash || '',
      record.userId,
      record.walletAddress
    ].map(field => `"${field}"`).join(',');
  }

  /**
   * Format max price record for CSV
   */
  private formatMaxPriceRecord(record: Partial<TradingRecord> & { tokenAddress: string; userId: string; walletAddress: string }): string {
    return [
      record.tokenAddress,
      record.tokenName || 'Unknown',
      record.tokenCreator || 'Unknown',
      record.platform || '',
      record.buyAmountBNB?.toFixed(8) || '',
      record.sellAmountBNB?.toFixed(8) || '',
      record.tokenAmount?.toFixed(2) || '',
      record.buyPriceBNB?.toFixed(8) || '',
      record.buyPriceUSD?.toFixed(4) || '',
      record.sellPriceBNB?.toFixed(8) || '',
      record.sellPriceUSD?.toFixed(4) || '',
      record.maxPriceReachedBNB?.toFixed(8) || '',
      record.maxPriceReachedUSD?.toFixed(4) || '',
      record.profitLossBNB?.toFixed(8) || '',
      record.profitLossUSD?.toFixed(4) || '',
      record.priceChangePercent?.toFixed(2) || '',
      record.maxPriceChangePercent?.toFixed(2) || '',
      record.timeToMaxPriceSeconds?.toFixed(0) || '',
      record.buyTime?.toISOString() || '',
      record.sellTime?.toISOString() || '',
      record.maxPriceTime?.toISOString() || '',
      record.buyTxHash || '',
      record.sellTxHash || '',
      record.userId,
      record.walletAddress
    ].map(field => `"${field}"`).join(',');
  }

  /**
   * Write record to CSV file
   */
  private async writeToCSV(record: string): Promise<void> {
    const filename = `trading_log_${this.currentDate}.csv`;
    const filepath = path.join(this.logDirectory, filename);
    
    // Check if file exists, if not create with headers
    const headers = [
      'Token Address',
      'Token Name',
      'Token Creator',
      'Platform',
      'Buy Amount BNB',
      'Sell Amount BNB',
      'Token Amount',
      'Buy Price BNB',
      'Buy Price USD',
      'Sell Price BNB',
      'Sell Price USD',
      'Max Price Reached BNB',
      'Max Price Reached USD',
      'Profit/Loss BNB',
      'Profit/Loss USD',
      'Price Change %',
      'Max Price Change %',
      'Time to Max Price (seconds)',
      'Buy Time',
      'Sell Time',
      'Max Price Time',
      'Buy Tx Hash',
      'Sell Tx Hash',
      'User ID',
      'Wallet Address'
    ];

    const headerRow = headers.map(header => `"${header}"`).join(',');
    
    if (!fs.existsSync(filepath)) {
      // Create new file with headers
      fs.writeFileSync(filepath, headerRow + '\n', 'utf8');
    }

    // Append record to file
    fs.appendFileSync(filepath, record + '\n', 'utf8');
  }

  /**
   * Get trading statistics for a specific date
   */
  async getTradingStats(date: string = this.currentDate): Promise<{
    totalTrades: number;
    totalProfitBNB: number;
    totalProfitUSD: number;
    averagePriceChange: number;
    winRate: number;
    totalVolumeBNB: number;
  }> {
    try {
      const filename = `trading_log_${date}.csv`;
      const filepath = path.join(this.logDirectory, filename);
      
      if (!fs.existsSync(filepath)) {
        return {
          totalTrades: 0,
          totalProfitBNB: 0,
          totalProfitUSD: 0,
          averagePriceChange: 0,
          winRate: 0,
          totalVolumeBNB: 0
        };
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length <= 1) {
        return {
          totalTrades: 0,
          totalProfitBNB: 0,
          totalProfitUSD: 0,
          averagePriceChange: 0,
          winRate: 0,
          totalVolumeBNB: 0
        };
      }

      const records = lines.slice(1); // Skip header
      let totalProfitBNB = 0;
      let totalProfitUSD = 0;
      let totalPriceChange = 0;
      let winCount = 0;
      let totalVolumeBNB = 0;
      let validRecords = 0;

      for (const record of records) {
        const fields = record.split(',').map(field => field.replace(/"/g, ''));
        
        if (fields.length >= 25) {
          const profitBNB = parseFloat(fields[13]) || 0;
          const profitUSD = parseFloat(fields[14]) || 0;
          const priceChange = parseFloat(fields[15]) || 0;
          const buyAmount = parseFloat(fields[4]) || 0;

          totalProfitBNB += profitBNB;
          totalProfitUSD += profitUSD;
          totalPriceChange += priceChange;
          totalVolumeBNB += buyAmount;
          
          if (profitBNB > 0) winCount++;
          validRecords++;
        }
      }

      return {
        totalTrades: validRecords,
        totalProfitBNB,
        totalProfitUSD,
        averagePriceChange: validRecords > 0 ? totalPriceChange / validRecords : 0,
        winRate: validRecords > 0 ? (winCount / validRecords) * 100 : 0,
        totalVolumeBNB
      };
    } catch (error) {
      console.error('Error getting trading stats:', error);
      return {
        totalTrades: 0,
        totalProfitBNB: 0,
        totalProfitUSD: 0,
        averagePriceChange: 0,
        winRate: 0,
        totalVolumeBNB: 0
      };
    }
  }

  /**
   * Get list of all trading log files
   */
  getLogFiles(): string[] {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        return [];
      }
      
      return fs.readdirSync(this.logDirectory)
        .filter(file => file.startsWith('trading_log_') && file.endsWith('.csv'))
        .sort();
    } catch (error) {
      console.error('Error getting log files:', error);
      return [];
    }
  }
}

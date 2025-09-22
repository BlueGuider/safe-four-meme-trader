import TelegramBot from 'node-telegram-bot-api';
import { TradingService } from './trading';
import { PancakeSwapService } from './pancakeSwap';
import { CopyTradingService } from './copyTrading';
import { WalletService } from './wallet';
import dotenv from 'dotenv';

dotenv.config();

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export class TelegramBotService {
  private static bot: TelegramBot | null = null;
  private static config: TelegramConfig;

  static initialize(config: TelegramConfig): void {
    if (!config.enabled || !config.botToken) {
      console.log('📱 Telegram bot disabled or no token provided');
      return;
    }

    this.config = config;
    this.bot = new TelegramBot(config.botToken, { polling: true });
    
    this.setupCommands();
    this.setupErrorHandling();
    
    console.log('🤖 Telegram bot initialized successfully');
  }

  private static setupCommands(): void {
    if (!this.bot) return;

    // Start command
    this.bot.onText(/\/start/, (msg: any) => {
      const chatId = msg.chat.id;
      this.bot!.sendMessage(chatId, `
🚀 **Copy Trading Bot**

Welcome! I can help you:
• 📊 Check wallet status
• 🛒 Buy tokens manually  
• 💸 Sell tokens manually
• 📈 Check token balances
• 🔔 Receive copy trading alerts

**Commands:**
/status - Show wallet status
/buy <token> <amount> - Buy tokens
/sell <token> <percentage> - Sell tokens  
/balance <token> - Check token balance
/copy <wallet> <rate> <min> <max> <delay> - Setup copy trading
/help - Show all commands

**Examples:**
/buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001
/sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50
/balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444
/copy 0x1234567890123456789012345678901234567890 0.01 0.0001 0.0001 0
      `, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.onText(/\/help/, (msg: any) => {
      const chatId = msg.chat.id;
      this.bot!.sendMessage(chatId, `
📖 **Available Commands:**

**Status & Info:**
/status - Show wallet status and funding recommendations
/balance <token> - Check token balances across all wallets

**Manual Trading:**
/buy <token> <bnbAmount> - Buy tokens with BNB
/sell <token> <percentage> - Sell percentage of token holdings

**Copy Trading:**
/copy <wallet> <rate> <min> <max> <delay> - Setup copy trading with price tracking

**Examples:**
/buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001
/sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50
/balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444
/copy 0x1234567890123456789012345678901234567890 0.01 0.0001 0.0001 0

**Note:** All amounts are in BNB, percentages are 1-100, copy rate is 0.01-1.0
      `, { parse_mode: 'Markdown' });
    });

    // Status command
    this.bot.onText(/\/status/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.handleStatusCommand(chatId);
    });

    // Buy command
    this.bot.onText(/\/buy (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const input = match![1];
      const parts = input.split(' ');
      
      if (parts.length < 2) {
        this.bot!.sendMessage(chatId, '❌ Usage: /buy <tokenAddress> <bnbAmount>\nExample: /buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001');
        return;
      }

      const tokenAddress = parts[0];
      const bnbAmount = parseFloat(parts[1]);
      
      if (isNaN(bnbAmount) || bnbAmount <= 0) {
        this.bot!.sendMessage(chatId, '❌ Invalid BNB amount. Please provide a valid number > 0');
        return;
      }

      await this.handleBuyCommand(chatId, tokenAddress, bnbAmount);
    });

    // Sell command
    this.bot.onText(/\/sell (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const input = match![1];
      const parts = input.split(' ');
      
      if (parts.length < 2) {
        this.bot!.sendMessage(chatId, '❌ Usage: /sell <tokenAddress> <percentage>\nExample: /sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50');
        return;
      }

      const tokenAddress = parts[0];
      const percentage = parseInt(parts[1]);
      
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        this.bot!.sendMessage(chatId, '❌ Invalid percentage. Please provide a number between 1-100');
        return;
      }

      await this.handleSellCommand(chatId, tokenAddress, percentage);
    });

    // Balance command
    this.bot.onText(/\/balance (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const tokenAddress = match![1];
      await this.handleBalanceCommand(chatId, tokenAddress);
    });

    // Copy trading setup command
    this.bot.onText(/\/copy (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const input = match![1];
      const parts = input.split(' ');
      
      if (parts.length < 5) {
        this.bot!.sendMessage(chatId, `❌ Usage: /copy <walletAddress> <copyRate> <minAmount> <maxAmount> <delay>

**Parameters:**
• walletAddress - Target wallet to copy (0x...)
• copyRate - Copy percentage (0.01-1.0, e.g., 0.01 = 1%)
• minAmount - Minimum BNB per trade (e.g., 0.0001)
• maxAmount - Maximum BNB per trade (e.g., 0.0001)
• delay - Delay in milliseconds (e.g., 0)

**Example:**
/copy 0x1234567890123456789012345678901234567890 0.01 0.0001 0.0001 0`);
        return;
      }

      const walletAddress = parts[0];
      const copyRate = parseFloat(parts[1]);
      const minAmount = parseFloat(parts[2]);
      const maxAmount = parseFloat(parts[3]);
      const delay = parseInt(parts[4]);
      
      // Validate inputs
      if (isNaN(copyRate) || copyRate <= 0 || copyRate > 1) {
        this.bot!.sendMessage(chatId, '❌ Invalid copy rate. Please provide a number between 0.01-1.0 (e.g., 0.1 = 10%)');
        return;
      }
      
      if (isNaN(minAmount) || minAmount <= 0) {
        this.bot!.sendMessage(chatId, '❌ Invalid minimum amount. Please provide a number > 0');
        return;
      }
      
      if (isNaN(maxAmount) || maxAmount <= 0 || maxAmount < minAmount) {
        this.bot!.sendMessage(chatId, '❌ Invalid maximum amount. Must be > 0 and >= minimum amount');
        return;
      }
      
      if (isNaN(delay) || delay < 0 || delay > 10000) {
        this.bot!.sendMessage(chatId, '❌ Invalid delay. Please provide a number between 0-10000 milliseconds');
        return;
      }

      await this.handleCopyCommand(chatId, walletAddress, copyRate, minAmount, maxAmount, delay);
    });
  }

  private static async handleStatusCommand(chatId: number): Promise<void> {
    try {
      const balanceCheck = await WalletService.checkWalletBalances(chatId.toString());
      
      let message = `💰 **Wallet Status**\n\n`;
      message += `📊 Total wallets: ${balanceCheck.totalWallets}\n`;
      message += `✅ Funded wallets: ${balanceCheck.fundedWallets}\n`;
      message += `💵 Total balance: ${balanceCheck.totalBalance.toFixed(6)} BNB\n`;
      message += `📈 Average balance: ${balanceCheck.averageBalance.toFixed(6)} BNB\n\n`;

      if (balanceCheck.recommendations.length > 0) {
        message += `💡 **Recommendations:**\n`;
        balanceCheck.recommendations.forEach(rec => {
          message += `• ${rec}\n`;
        });
        message += `\n`;
      }

      if (balanceCheck.unfundedWallets.length > 0) {
        message += `⚠️ **Unfunded wallets:**\n`;
        balanceCheck.unfundedWallets.forEach(addr => {
          message += `• \`${addr}\`\n`;
        });
      }

      this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      this.bot!.sendMessage(chatId, `❌ Error checking wallet status: ${error.message}`);
    }
  }

  private static async handleBuyCommand(chatId: number, tokenAddress: string, bnbAmount: number): Promise<void> {
    try {
      await this.bot!.sendMessage(chatId, `🛒 **Starting Buy Order**\n\n🪙 Token: \`${tokenAddress}\`\n💰 Amount: ${bnbAmount} BNB\n\n⏳ Processing...`, { parse_mode: 'Markdown' });

      // Check if token is migrated
      const platformInfo = await (CopyTradingService as any).determineTradingPlatform(tokenAddress);
      
      let result;
      if (platformInfo.platform === 'DEX') {
        await this.bot!.sendMessage(chatId, `🔄 Using PancakeSwap...`);
        result = await PancakeSwapService.buyTokens(tokenAddress, bnbAmount, chatId.toString(), 5.0);
      } else {
        await this.bot!.sendMessage(chatId, `🔄 Using four.meme...`);
        result = await TradingService.buyTokens(tokenAddress, bnbAmount, chatId.toString());
      }

      if (result.success) {
        let message = `✅ **Buy Successful!**\n\n`;
        message += `📝 Transaction: \`${result.data?.txHash}\`\n`;
        message += `👛 Wallets used: ${result.data?.successCount}/${result.data?.totalWallets}\n`;
        message += `🏢 Platform: ${platformInfo.platform}`;
        this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        this.bot!.sendMessage(chatId, `❌ **Buy Failed**\n\nError: ${result.error}`);
      }
    } catch (error: any) {
      this.bot!.sendMessage(chatId, `❌ **Error**\n\n${error.message}`);
    }
  }

  private static async handleSellCommand(chatId: number, tokenAddress: string, percentage: number): Promise<void> {
    try {
      await this.bot!.sendMessage(chatId, `💸 **Starting Sell Order**\n\n🪙 Token: \`${tokenAddress}\`\n📊 Percentage: ${percentage}%\n\n⏳ Processing...`, { parse_mode: 'Markdown' });

      // Check if token is migrated
      const platformInfo = await (CopyTradingService as any).determineTradingPlatform(tokenAddress);
      
      let result;
      if (platformInfo.platform === 'DEX') {
        await this.bot!.sendMessage(chatId, `🔄 Using PancakeSwap...`);
        result = await PancakeSwapService.sellTokens(tokenAddress, percentage, chatId.toString(), 5.0);
      } else {
        await this.bot!.sendMessage(chatId, `🔄 Using four.meme...`);
        result = await TradingService.sellTokens(tokenAddress, percentage, chatId.toString());
      }

      if (result.success) {
        let message = `✅ **Sell Successful!**\n\n`;
        message += `📝 Transaction: \`${result.data?.txHash}\`\n`;
        message += `👛 Wallets used: ${result.data?.successCount}/${result.data?.totalWallets}\n`;
        message += `🏢 Platform: ${platformInfo.platform}`;
        this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        this.bot!.sendMessage(chatId, `❌ **Sell Failed**\n\nError: ${result.error}`);
      }
    } catch (error: any) {
      this.bot!.sendMessage(chatId, `❌ **Error**\n\n${error.message}`);
    }
  }

  private static async handleBalanceCommand(chatId: number, tokenAddress: string): Promise<void> {
    try {
      await this.bot!.sendMessage(chatId, `📊 **Checking Token Balances**\n\n🪙 Token: \`${tokenAddress}\`\n\n⏳ Processing...`, { parse_mode: 'Markdown' });

      const result = await TradingService.getTokenBalances(tokenAddress, chatId.toString());
      
      if (result.success) {
        let message = `📈 **Token Balances**\n\n`;
        message += `🪙 Token: \`${tokenAddress}\`\n`;
        message += `📊 Total Balance: ${result.data?.totalBalance} tokens\n`;
        message += `👛 Wallets with tokens: ${result.data?.balances.length}\n\n`;

        let hasTokens = false;
        result.data?.balances.forEach((balance, index) => {
          if (parseFloat(balance.balance) > 0) {
            hasTokens = true;
            message += `${index + 1}. \`${balance.address}\`\n`;
            message += `   Balance: ${balance.balance} ${balance.tokenSymbol}\n`;
            message += `   Name: ${balance.tokenName}\n\n`;
          }
        });

        if (!hasTokens) {
          message += `❌ No tokens found in any wallet`;
        }

        this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        this.bot!.sendMessage(chatId, `❌ **Error**\n\n${result.error}`);
      }
    } catch (error: any) {
      this.bot!.sendMessage(chatId, `❌ **Error**\n\n${error.message}`);
    }
  }

  private static setupErrorHandling(): void {
    if (!this.bot) return;

    this.bot.on('error', (error: any) => {
      console.error('❌ Telegram bot error:', error);
    });

    this.bot.on('polling_error', (error: any) => {
      console.error('❌ Telegram bot polling error:', error);
    });
  }

  // Send alert when copy trading detects a transaction
  static async sendCopyTradeAlert(tradeData: {
    type: 'BUY' | 'SELL';
    tokenAddress: string;
    bnbAmount: number;
    tokenAmount?: number;
    targetWallet: string;
    copyAmount: number;
    txHash?: string;
  }): Promise<void> {
    if (!this.bot || !this.config.enabled) return;

    try {
      const emoji = tradeData.type === 'BUY' ? '🛒' : '💸';
      const action = tradeData.type === 'BUY' ? 'Bought' : 'Sold';
      
      let message = `${emoji} **Copy Trade Executed**\n\n`;
      message += `📍 **Target Wallet:** \`${tradeData.targetWallet.slice(0, 8)}...${tradeData.targetWallet.slice(-8)}\`\n`;
      message += `🔄 **Action:** ${action}\n`;
      message += `🪙 **Token:** \`${tradeData.tokenAddress.slice(0, 8)}...${tradeData.tokenAddress.slice(-8)}\`\n`;
      message += `💰 **Copy Amount:** ${tradeData.copyAmount.toFixed(6)} BNB\n`;
      
      if (tradeData.tokenAmount) {
        message += `📊 **Tokens:** ${tradeData.tokenAmount.toFixed(2)}\n`;
      }
      
      if (tradeData.txHash) {
        message += `📝 **Transaction:** \`${tradeData.txHash}\`\n`;
      }
      
      message += `⏰ **Time:** ${new Date().toLocaleString()}`;

      await this.bot.sendMessage(this.config.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Failed to send Telegram alert:', error);
    }
  }

  // Send wallet funding alert
  static async sendFundingAlert(balanceInfo: {
    totalBalance: number;
    fundedWallets: number;
    totalWallets: number;
    unfundedWallets: string[];
  }): Promise<void> {
    if (!this.bot || !this.config.enabled) return;

    try {
      if (balanceInfo.fundedWallets === 0) {
        let message = `⚠️ **Wallet Funding Alert**\n\n`;
        message += `💰 Total Balance: ${balanceInfo.totalBalance.toFixed(6)} BNB\n`;
        message += `📊 Funded Wallets: ${balanceInfo.fundedWallets}/${balanceInfo.totalWallets}\n\n`;
        message += `❌ **No wallets have sufficient funds for trading!**\n\n`;
        message += `💡 **Action Required:**\n`;
        message += `• Fund your wallets with at least 0.01 BNB each\n`;
        message += `• Use /status to see wallet addresses\n`;
        message += `• Consider adding more BNB for larger trades\n\n`;
        message += `⏰ ${new Date().toLocaleString()}`;

        await this.bot.sendMessage(this.config.chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('❌ Failed to send funding alert:', error);
    }
  }

  // Send price tracking alert
  static async sendPriceTrackingAlert(alertData: {
    type: 'PARTIAL_SELL' | 'FULL_SELL' | 'COPY_SELL';
    tokenAddress: string;
    percentage: number;
    priceChange: number;
    currentPrice: number;
    currentPriceUSD: number;
    txHash?: string;
  }): Promise<void> {
    if (!this.bot || !this.config.enabled) return;

    try {
      const emoji = alertData.type === 'FULL_SELL' ? '🎯' : 
                   alertData.type === 'PARTIAL_SELL' ? '📈' : '🔄';
      
      const action = alertData.type === 'FULL_SELL' ? 'FULL SELL (100%)' :
                    alertData.type === 'PARTIAL_SELL' ? `PARTIAL SELL (${alertData.percentage}%)` :
                    `COPY SELL (${alertData.percentage}%)`;
      
      let message = `${emoji} **Price Tracking Alert**\n\n`;
      message += `🪙 **Token:** \`${alertData.tokenAddress.slice(0, 8)}...${alertData.tokenAddress.slice(-8)}\`\n`;
      message += `🔄 **Action:** ${action}\n`;
      message += `📊 **Price Change:** ${alertData.priceChange > 0 ? '+' : ''}${alertData.priceChange.toFixed(2)}%\n`;
      message += `💰 **Current Price:** ${alertData.currentPrice.toFixed(8)} BNB ($${alertData.currentPriceUSD.toFixed(4)})\n`;
      
      if (alertData.txHash) {
        message += `📝 **Transaction:** \`${alertData.txHash}\`\n`;
      }
      
      message += `⏰ **Time:** ${new Date().toLocaleString()}`;

      await this.bot.sendMessage(this.config.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Failed to send price tracking alert:', error);
    }
  }

  // Send price update notification
  static async sendPriceUpdateNotification(updateData: {
    tokenAddress: string;
    currentPrice: number;
    currentPriceUSD: number;
    priceChange: number;
    maxPriceReached: number;
    maxPriceChange: number;
  }): Promise<void> {
    if (!this.bot || !this.config.enabled) return;

    try {
      // Only send notifications for significant price changes (5% or more)
      if (Math.abs(updateData.priceChange) < 5) return;

      const emoji = updateData.priceChange > 0 ? '📈' : '📉';
      
      let message = `${emoji} **Price Update**\n\n`;
      message += `🪙 **Token:** \`${updateData.tokenAddress.slice(0, 8)}...${updateData.tokenAddress.slice(-8)}\`\n`;
      message += `💰 **Current Price:** ${updateData.currentPrice.toFixed(8)} BNB ($${updateData.currentPriceUSD.toFixed(4)})\n`;
      message += `📊 **Price Change:** ${updateData.priceChange > 0 ? '+' : ''}${updateData.priceChange.toFixed(2)}%\n`;
      message += `🏆 **Max Price:** ${updateData.maxPriceReached.toFixed(8)} BNB (+${updateData.maxPriceChange.toFixed(2)}%)\n`;
      message += `⏰ **Time:** ${new Date().toLocaleString()}`;

      await this.bot.sendMessage(this.config.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('❌ Failed to send price update notification:', error);
    }
  }

  // Handle copy trading setup command
  private static async handleCopyCommand(
    chatId: number, 
    walletAddress: string, 
    copyRate: number, 
    minAmount: number, 
    maxAmount: number, 
    delay: number
  ): Promise<void> {
    try {
      // Validate wallet address format
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        this.bot!.sendMessage(chatId, '❌ Invalid wallet address format. Must be a valid Ethereum address (0x...)');
        return;
      }

      // Show setup message
      const setupMessage = `🔄 **Setting up copy trading...**

**Configuration:**
📍 Target Wallet: \`${walletAddress}\`
📊 Copy Rate: ${(copyRate * 100).toFixed(1)}%
💰 Min Amount: ${minAmount.toFixed(6)} BNB
💰 Max Amount: ${maxAmount.toFixed(6)} BNB
⏱️ Delay: ${delay}ms

**Price Tracking Enabled:**
🎯 10% increase → Sell 50% (within 10s)
🎯 50% increase → Sell 100% (within 20s)
📈 Real-time price monitoring
🔄 Copy sell when target sells

Setting up...`;

      await this.bot!.sendMessage(chatId, setupMessage, { parse_mode: 'Markdown' });

      // Setup copy trading
      const result = await CopyTradingService.setupCopyTrading(
        chatId.toString(), // Use chat ID as user ID for Telegram
        walletAddress,
        copyRate,
        maxAmount,
        delay
      );

      if (result.success) {
        // Configure price tracking
        CopyTradingService.updatePriceTrackingConfig({
          sellAt10Percent: true,
          sellAt50Percent: true,
          timeWindow10Percent: 10,
          timeWindow50Percent: 20,
          enabled: true,
          updateInterval: 2000
        });

        const successMessage = `✅ **Copy Trading Setup Complete!**

**Active Configuration:**
📍 Target: \`${walletAddress}\`
📊 Copy Rate: ${(copyRate * 100).toFixed(1)}%
💰 Range: ${minAmount.toFixed(6)} - ${maxAmount.toFixed(6)} BNB
⏱️ Delay: ${delay}ms

**Price Tracking:**
🎯 10% increase → Sell 50% (10s window)
🎯 50% increase → Sell 100% (20s window)
📈 Updates every 2 seconds
🔄 Copy sells automatically

**Status:** 🟢 **ACTIVE** - Monitoring target wallet for trades

You'll receive notifications for all copy trades and price tracking actions!`;

        await this.bot!.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });

        // Send a test notification
        setTimeout(async () => {
          await this.bot!.sendMessage(chatId, `🔔 **Copy Trading Active**

The bot is now monitoring \`${walletAddress}\` for trades.

**What happens next:**
• When target wallet buys → You buy ${(copyRate * 100).toFixed(1)}% of their amount
• When target wallet sells → You sell ${(copyRate * 100).toFixed(1)}% of your holdings
• Price increases trigger automatic sells
• All actions are logged and notified

**Commands:**
/status - Check current status
/help - Show all commands`, { parse_mode: 'Markdown' });
        }, 2000);

      } else {
        const errorMessage = `❌ **Copy Trading Setup Failed**

**Error:** ${result.error}

**Common Issues:**
• Invalid wallet address
• Insufficient wallet funds
• Network connection problems

Please check your input and try again.`;

        await this.bot!.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }

    } catch (error: any) {
      console.error('Error in copy command:', error);
      await this.bot!.sendMessage(chatId, `❌ **Error setting up copy trading**

**Error:** ${error.message}

Please try again or contact support.`);
    }
  }

  static destroy(): void {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
      console.log('🤖 Telegram bot stopped');
    }
  }
}

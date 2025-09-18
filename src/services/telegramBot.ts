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
/help - Show all commands

**Examples:**
/buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001
/sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50
/balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444
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

**Examples:**
/buy 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 0.001
/sell 0x8ac9a6b941ed327be1f874b18904a9cb651b4444 50
/balance 0x8ac9a6b941ed327be1f874b18904a9cb651b4444

**Note:** All amounts are in BNB, percentages are 1-100
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
  }

  private static async handleStatusCommand(chatId: number): Promise<void> {
    try {
      const balanceCheck = await WalletService.checkWalletBalances('copy-trading-bot');
      
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
        result = await PancakeSwapService.buyTokens(tokenAddress, bnbAmount, 'copy-trading-bot', 5.0);
      } else {
        await this.bot!.sendMessage(chatId, `🔄 Using four.meme...`);
        result = await TradingService.buyTokens(tokenAddress, bnbAmount, 'copy-trading-bot');
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
        result = await PancakeSwapService.sellTokens(tokenAddress, percentage, 'copy-trading-bot', 5.0);
      } else {
        await this.bot!.sendMessage(chatId, `🔄 Using four.meme...`);
        result = await TradingService.sellTokens(tokenAddress, percentage, 'copy-trading-bot');
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

      const result = await TradingService.getTokenBalances(tokenAddress, 'copy-trading-bot');
      
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

  static destroy(): void {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
      console.log('🤖 Telegram bot stopped');
    }
  }
}

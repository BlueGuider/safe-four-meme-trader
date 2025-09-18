import { Telegraf } from 'telegraf';
import { WalletService } from './wallet';
import { TradingService } from './trading';
import { AutoTradingService } from './autoTrading';
import { CopyTradingService } from './copyTrading';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';
import { config } from '../config';

/**
 * Telegram bot service for user interaction
 * Features:
 * - Command handling
 * - Input validation
 * - Rate limiting
 * - Error handling
 * - User-friendly responses
 */

export class BotService {
  private bot: Telegraf;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private autoTradingService: AutoTradingService;

  constructor() {
    this.bot = new Telegraf(config.BOT_TOKEN);
    this.autoTradingService = new AutoTradingService();
    this.setupCommands();
    this.setupMiddleware();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    try {
      await this.bot.launch();
      console.log('🤖 Safe Four-Meme Trader Bot started successfully!');
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    try {
      this.bot.stop('SIGINT');
      console.log('Bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }

  /**
   * Setup bot middleware
   */
  private setupMiddleware(): void {
    // Rate limiting middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        return ctx.reply('❌ Unable to identify user');
      }

      if (!SecurityUtils.checkRateLimit(userId, this.rateLimitMap)) {
        return ctx.reply('⏰ Rate limit exceeded. Please try again later.');
      }

      return next();
    });

    // Error handling middleware
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      ctx.reply('❌ An error occurred. Please try again later.');
    });
  }

  /**
   * Setup bot commands
   */
  private setupCommands(): void {
    // Start command
    this.bot.command('start', (ctx) => {
      const welcomeMessage = `
🚀 Welcome to Safe Four-Meme Trader Bot!

This bot helps you trade four.meme tokens safely with enhanced security features.

📋 Available Commands:
/create - Create new wallets
/wallets - View your wallets
/buy <token> <amount> - Buy tokens
/sell <token> <percentage> - Sell tokens
/balance <token_address> - Check token balances across all wallets
/stats - View your statistics
/help - Show this help message

🔒 Security Features:
• Encrypted private key storage
• Input validation
• Rate limiting
• MEV protection
• Error handling

⚠️ Important: Never share your private keys with anyone!
      `;
      ctx.reply(welcomeMessage);
    });

    // Help command
    this.bot.command('help', (ctx) => {
      const helpMessage = `
📖 Command Help:

🔧 Wallet Management:
/create <count> - Create new wallets (max 10)
/wallets - View your wallets and balances
/stats - View your trading statistics

💰 Trading:
/buy <token_address> <bnb_amount> - Buy tokens with BNB
/sell <token_address> <percentage> - Sell percentage of tokens
/balance <token_address> - Check token balances

🤖 Auto Trading:
/autobuy <token> <price> <amount> - Set auto buy order
/autosell <token> <price> <percentage> - Set auto sell order
/myorders - View your auto trading orders
/cancelorder <order_id> - Cancel an auto trading order
/price <token_address> - Get current token price

📈 Copy Trading:
/copy <target_wallet> <ratio> [max_size] [delay] - Start copying a trader
/copystatus - View copy trading status
/copymonitor - View detailed monitoring info
/copystop - Stop copy trading
/copystart - Resume copy trading

📊 Information:
/help - Show this help message
/start - Show welcome message

💡 Examples:
/create 5 - Create 5 new wallets
/buy 0x1234...abcd 0.1 - Buy tokens with 0.1 BNB
/sell 0x1234...abcd 50 - Sell 50% of tokens
/balance 0x1234...abcd - Check token balances

⚠️ Safety Tips:
• Always verify token addresses
• Start with small amounts
• Never share private keys
• Use official four.meme contracts only
      `;
      ctx.reply(helpMessage);
    });

    // Create wallets command
    this.bot.command('create', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        const count = parseInt(args[1]) || 5; // Default to 5 wallets

        const result = await WalletService.createWallets(ctx.from.id.toString(), count);
        
        if (result.success) {
          const message = `
✅ Successfully created ${result.data!.count} wallets!

📊 Wallet Summary:
• Total wallets: ${result.data!.count}
• Addresses: ${result.data!.wallets.map(w => w.address).join('\n• ')}

🔒 Your private keys are encrypted and stored securely.
          `;
          ctx.reply(message);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in create command:', error);
        ctx.reply('❌ An error occurred while creating wallets.');
      }
    });

    // View wallets command
    this.bot.command('wallets', async (ctx) => {
      try {
        const result = await WalletService.getWallets(ctx.from.id.toString());
        
        if (result.success) {
          if (result.data!.wallets.length === 0) {
            ctx.reply('📭 No wallets found. Use /create to create some wallets.');
            return;
          }

          let message = `📊 Your Wallets (${result.data!.wallets.length}):\n\n`;
          
          result.data!.wallets.forEach((wallet, index) => {
            message += `${index + 1}. ${wallet.address}\n`;
            message += `   Balance: ${wallet.balance || '0'} BNB\n`;
            message += `   Created: ${wallet.createdAt.toLocaleDateString()}\n\n`;
          });

          ctx.reply(message);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in wallets command:', error);
        ctx.reply('❌ An error occurred while fetching wallets.');
      }
    });

    // Buy tokens command
    this.bot.command('buy', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        const tokenAddress = args[1];
        const bnbAmount = parseFloat(args[2]);

        if (!tokenAddress || !bnbAmount) {
          ctx.reply('❌ Usage: /buy <token_address> <bnb_amount>\nExample: /buy 0x1234...abcd 0.1');
          return;
        }

        // Validate inputs
        const addressValidation = ValidationUtils.validateAddress(tokenAddress);
        if (!addressValidation.isValid) {
          ctx.reply(`❌ Invalid token address: ${addressValidation.error}`);
          return;
        }

        const amountValidation = ValidationUtils.validateAmount(args[2]);
        if (!amountValidation.isValid) {
          ctx.reply(`❌ Invalid amount: ${amountValidation.error}`);
          return;
        }

        ctx.reply('🔄 Processing buy order...');

        const result = await TradingService.buyTokens(
          tokenAddress,
          bnbAmount,
          ctx.from.id.toString()
        );

        if (result.success) {
          const message = `
✅ Buy order submitted successfully!

📊 Transaction Details:
• Token: ${SecurityUtils.maskSensitiveData(tokenAddress, 6)}
• Amount per wallet: ${bnbAmount} BNB
• Wallets used: ${result.data!.successCount}/${result.data!.totalWallets}
• Transaction hash: ${result.data!.txHash}

🔍 Check your transaction on BSCScan:
https://bscscan.com/tx/${result.data!.txHash}
          `;
          ctx.reply(message);
        } else {
          ctx.reply(`❌ Buy order failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in buy command:', error);
        ctx.reply('❌ An error occurred while processing buy order.');
      }
    });

    // Sell tokens command
    this.bot.command('sell', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        const tokenAddress = args[1];
        const sellPercentage = parseInt(args[2]);

        if (!tokenAddress || isNaN(sellPercentage)) {
          ctx.reply('❌ Usage: /sell <token_address> <percentage>\nExample: /sell 0x1234...abcd 50');
          return;
        }

        // Validate inputs
        const addressValidation = ValidationUtils.validateAddress(tokenAddress);
        if (!addressValidation.isValid) {
          ctx.reply(`❌ Invalid token address: ${addressValidation.error}`);
          return;
        }

        const percentageValidation = ValidationUtils.validatePercentage(sellPercentage);
        if (!percentageValidation.isValid) {
          ctx.reply(`❌ Invalid percentage: ${percentageValidation.error}`);
          return;
        }

        ctx.reply('🔄 Processing sell order...');

        const result = await TradingService.sellTokens(
          tokenAddress,
          sellPercentage,
          ctx.from.id.toString()
        );

        if (result.success) {
          const message = `
✅ Sell order submitted successfully!

📊 Transaction Details:
• Token: ${SecurityUtils.maskSensitiveData(tokenAddress, 6)}
• Sell percentage: ${sellPercentage}%
• Wallets used: ${result.data!.successCount}/${result.data!.totalWallets}
• Transaction hash: ${result.data!.txHash}

🔍 Check your transaction on BSCScan:
https://bscscan.com/tx/${result.data!.txHash}
          `;
          ctx.reply(message);
        } else {
          ctx.reply(`❌ Sell order failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in sell command:', error);
        ctx.reply('❌ An error occurred while processing sell order.');
      }
    });

    // Check balance command
    this.bot.command('balance', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        const tokenAddress = args[1];

        if (!tokenAddress) {
          ctx.reply('❌ Usage: /balance <token_address>\n\n📝 Note: This checks token balances across all your wallets.\nUse /wallets to see your wallet addresses and BNB balances.\n\nExample: /balance 0x1234...abcd');
          return;
        }

        // Validate address
        const addressValidation = ValidationUtils.validateAddress(tokenAddress);
        if (!addressValidation.isValid) {
          ctx.reply(`❌ Invalid token address: ${addressValidation.error}`);
          return;
        }

        ctx.reply('🔄 Fetching token balances...');

        const result = await TradingService.getTokenBalances(
          tokenAddress,
          ctx.from.id.toString()
        );

        if (result.success) {
          const { balances, totalBalance } = result.data!;
          
          if (balances.length === 0) {
            ctx.reply('📭 No wallets found. Use /create to create some wallets.');
            return;
          }

          let message = `💰 Token Balance Summary:\n\n`;
          message += `Token: ${balances[0].tokenName} (${balances[0].tokenSymbol})\n`;
          message += `Address: ${SecurityUtils.maskSensitiveData(tokenAddress, 6)}\n`;
          message += `Total Balance: ${totalBalance} ${balances[0].tokenSymbol}\n\n`;
          message += `📊 Individual Balances:\n`;

          balances.forEach((balance, index) => {
            if (Number(balance.balance) > 0) {
              message += `${index + 1}. ${SecurityUtils.maskSensitiveData(balance.address, 4)}\n`;
              message += `   Balance: ${balance.balance} ${balance.tokenSymbol}\n\n`;
            }
          });

          const zeroBalanceCount = balances.filter(b => Number(b.balance) === 0).length;
          if (zeroBalanceCount > 0) {
            message += `${zeroBalanceCount} wallets have zero balance.`;
          }

          ctx.reply(message);
        } else {
          let errorMessage = `❌ Error fetching balances: ${result.error}`;
          
          // Provide helpful hints for common errors
          if (result.error?.includes('does not implement ERC20 standard')) {
            errorMessage += '\n\n💡 This might be a wallet address instead of a token address.\nUse /wallets to see your wallet addresses.';
          } else if (result.error?.includes('Contract does not exist')) {
            errorMessage += '\n\n💡 Please check that this is a valid token contract address.';
          }
          
          ctx.reply(errorMessage);
        }
      } catch (error) {
        console.error('Error in balance command:', error);
        ctx.reply('❌ An error occurred while fetching balances.');
      }
    });

    // Statistics command
    this.bot.command('stats', async (ctx) => {
      try {
        const result = await WalletService.getUserStats(ctx.from.id.toString());
        
        if (result.success) {
          const stats = result.data!;
          const message = `
📊 Your Trading Statistics:

👛 Wallets:
• Total wallets: ${stats.totalWallets}
• Wallets with balance: ${stats.walletsWithBalance}
• Total BNB balance: ${stats.totalBalance} BNB

⏰ Activity:
• Last activity: ${stats.lastActivity.toLocaleString()}

💡 Tips:
• Use /wallets to see detailed wallet information
• Use /balance <token> to check specific token balances
• Start with small amounts when trading new tokens
          `;
          ctx.reply(message);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in stats command:', error);
        ctx.reply('❌ An error occurred while fetching statistics.');
      }
    });

    // Auto Trading Commands
    this.bot.command('autobuy', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        if (args.length < 4) {
          ctx.reply(`❌ Usage: /autobuy <token_address> <trigger_price> <bnb_amount>
Example: /autobuy 0x1234...abcd 0.0001 0.01
This will buy 0.01 BNB worth when price drops to 0.0001 BNB`);
          return;
        }

        const tokenAddress = args[1];
        const triggerPrice = parseFloat(args[2]);
        const amount = parseFloat(args[3]);

        const result = await this.autoTradingService.createOrder(
          ctx.from.id.toString(),
          tokenAddress,
          'BUY',
          triggerPrice,
          amount
        );

        if (result.success) {
          const order = result.data!;
          
          // Get current price to show USD equivalent
          const priceResult = await this.autoTradingService.getTokenPrice(tokenAddress);
          let priceInfo = '';
          if (priceResult.success) {
            const { bnbPriceUSD } = priceResult.data!;
            const triggerPriceUSD = order.triggerPrice * bnbPriceUSD;
            priceInfo = `\n💵 Trigger Price: $${triggerPriceUSD.toFixed(12)} USD (${order.triggerPrice.toFixed(18)} BNB)`;
          } else {
            priceInfo = `\n💰 Trigger Price: ${order.triggerPrice.toFixed(18)} BNB`;
          }
          
          ctx.reply(`✅ Auto buy order created!
📊 Order ID: ${order.id}
🪙 Token: ${order.tokenSymbol} (${order.tokenAddress.slice(0, 8)}...)
${priceInfo}
💵 Amount: ${order.amount} BNB
⏰ Created: ${order.createdAt.toLocaleString()}

The bot will automatically buy when the price drops to or below ${order.triggerPrice} BNB.`);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in autobuy command:', error);
        ctx.reply('❌ An error occurred while creating auto buy order.');
      }
    });

    this.bot.command('autosell', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        if (args.length < 4) {
          ctx.reply(`❌ Usage: /autosell <token_address> <trigger_price> <percentage> [profit_target%] [stop_loss%]
Example: /autosell 0x1234...abcd 0.0002 50 100 20
This will sell 50% when price reaches 0.0002 BNB, with 100% profit target and 20% stop loss`);
          return;
        }

        const tokenAddress = args[1];
        const triggerPrice = parseFloat(args[2]);
        const percentage = parseFloat(args[3]);
        const profitTarget = args[4] ? parseFloat(args[4]) : undefined;
        const stopLoss = args[5] ? parseFloat(args[5]) : undefined;

        const result = await this.autoTradingService.createOrder(
          ctx.from.id.toString(),
          tokenAddress,
          'SELL',
          triggerPrice,
          percentage,
          profitTarget,
          stopLoss
        );

        if (result.success) {
          const order = result.data!;
          
          // Get current price to show USD equivalent
          const priceResult = await this.autoTradingService.getTokenPrice(tokenAddress);
          let priceInfo = '';
          if (priceResult.success) {
            const { bnbPriceUSD } = priceResult.data!;
            const triggerPriceUSD = order.triggerPrice * bnbPriceUSD;
            priceInfo = `\n💵 Trigger Price: $${triggerPriceUSD.toFixed(12)} USD (${order.triggerPrice.toFixed(18)} BNB)`;
          } else {
            priceInfo = `\n💰 Trigger Price: ${order.triggerPrice.toFixed(18)} BNB`;
          }
          
          let message = `✅ Auto sell order created!
📊 Order ID: ${order.id}
🪙 Token: ${order.tokenSymbol} (${order.tokenAddress.slice(0, 8)}...)
${priceInfo}
📈 Sell Percentage: ${order.amount}%
⏰ Created: ${order.createdAt.toLocaleString()}`;

          if (profitTarget) {
            message += `\n🎯 Profit Target: ${profitTarget}%`;
          }
          if (stopLoss) {
            message += `\n🛑 Stop Loss: ${stopLoss}%`;
          }

          message += `\n\nThe bot will automatically sell ${percentage}% when the price reaches ${triggerPrice} BNB.`;

          ctx.reply(message);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in autosell command:', error);
        ctx.reply('❌ An error occurred while creating auto sell order.');
      }
    });

    this.bot.command('myorders', async (ctx) => {
      try {
        const orders = this.autoTradingService.getUserOrders(ctx.from.id.toString());
        
        if (orders.length === 0) {
          ctx.reply('📋 You have no auto trading orders.');
          return;
        }

        let message = `📋 Your Auto Trading Orders (${orders.length}):\n\n`;
        
        orders.forEach((order, index) => {
          const status = order.isActive ? '🟢 Active' : '🔴 Executed';
          const type = order.orderType === 'BUY' ? '🛒 Buy' : '💰 Sell';
          
          message += `${index + 1}. ${type} Order\n`;
          message += `   ID: ${order.id.slice(0, 8)}...\n`;
          message += `   Token: ${order.tokenSymbol}\n`;
          message += `   Trigger: ${order.triggerPrice} BNB\n`;
          message += `   Amount: ${order.amount}${order.orderType === 'BUY' ? ' BNB' : '%'}\n`;
          message += `   Status: ${status}\n`;
          message += `   Created: ${order.createdAt.toLocaleDateString()}\n`;
          
          if (order.executedAt) {
            message += `   Executed: ${order.executedAt.toLocaleDateString()}\n`;
            message += `   Execution Price: ${order.executionPrice} BNB\n`;
          }
          
          if (order.profitTarget) {
            message += `   Profit Target: ${order.profitTarget}%\n`;
          }
          if (order.stopLoss) {
            message += `   Stop Loss: ${order.stopLoss}%\n`;
          }
          
          message += '\n';
        });

        ctx.reply(message);
      } catch (error) {
        console.error('Error in myorders command:', error);
        ctx.reply('❌ An error occurred while fetching your orders.');
      }
    });

    this.bot.command('cancelorder', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
          ctx.reply(`❌ Usage: /cancelorder <order_id>
Example: /cancelorder abc12345-6789-0123-4567-890123456789`);
          return;
        }

        const orderId = args[1];
        const result = await this.autoTradingService.cancelOrder(orderId, ctx.from.id.toString());

        if (result.success) {
          ctx.reply(`✅ Order ${orderId.slice(0, 8)}... has been cancelled.`);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in cancelorder command:', error);
        ctx.reply('❌ An error occurred while cancelling the order.');
      }
    });

    this.bot.command('price', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
          ctx.reply(`❌ Usage: /price <token_address>
Example: /price 0x169cca643ce005cf007cc36690fad9a92b154444`);
          return;
        }

        const tokenAddress = args[1];
        const result = await this.autoTradingService.getTokenPrice(tokenAddress);

        if (result.success) {
          const { priceBNB, priceUSD, bnbPriceUSD } = result.data!;
          ctx.reply(`💰 Token Price: $${priceUSD.toFixed(12)} USD
💎 BNB Price: $${bnbPriceUSD.toFixed(2)} USD
🪙 Token: ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}
📊 Price in BNB: ${priceBNB.toFixed(18)} BNB
⏰ Updated: ${result.timestamp.toLocaleString()}`);
        } else {
          ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in price command:', error);
        ctx.reply('❌ An error occurred while fetching the price.');
      }
    });

    // Copy Trading Commands
    this.bot.command('copy', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
          ctx.reply(`❌ Usage: /copy <target_wallet> <copy_ratio> [max_position_size] [delay_ms]
Example: /copy 0x1234...abcd 0.1 0.05 2000
- target_wallet: Wallet address to copy
- copy_ratio: How much to copy (0.1 = 10% of their position)
- max_position_size: Max BNB per trade (optional, default 0.1)
- delay_ms: Delay before copying in ms (optional, default 2000)`);
          return;
        }

        const targetWallet = args[1];
        const copyRatio = parseFloat(args[2]);
        const maxPositionSize = args[3] ? parseFloat(args[3]) : 0.1;
        const delayMs = args[4] ? parseInt(args[4]) : 2000;

        // Validate inputs
        const addressValidation = ValidationUtils.validateAddress(targetWallet);
        if (!addressValidation.isValid) {
          ctx.reply(`❌ Invalid target wallet: ${addressValidation.error}`);
          return;
        }

        if (copyRatio <= 0 || copyRatio > 1) {
          ctx.reply('❌ Copy ratio must be between 0.01 and 1.0');
          return;
        }

        ctx.reply('🔄 Setting up copy trading...');

        const result = await CopyTradingService.setupCopyTrading(
          ctx.from.id.toString(),
          targetWallet,
          copyRatio,
          maxPositionSize,
          delayMs
        );

        if (result.success) {
          ctx.reply(`✅ Copy trading setup successful!
🎯 Target: ${SecurityUtils.maskSensitiveData(targetWallet, 6)}
📊 Copy Ratio: ${(copyRatio * 100).toFixed(1)}%
💰 Max Position: ${maxPositionSize} BNB
⏱️ Delay: ${delayMs}ms
🔄 Monitoring started!`);
        } else {
          ctx.reply(`❌ Setup failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in copy command:', error);
        ctx.reply('❌ An error occurred while setting up copy trading.');
      }
    });

    this.bot.command('copystatus', async (ctx) => {
      try {
        const status = CopyTradingService.getCopyTradingStatus(ctx.from.id.toString());
        
        if (!status.isEnabled) {
          ctx.reply('❌ Copy trading is not enabled. Use /copy to set it up.');
          return;
        }

        const config = status.config!;
        const activeTrades = status.activeTrades;
        
        let message = `📊 Copy Trading Status
🎯 Target: ${SecurityUtils.maskSensitiveData(config.targetWallet, 6)}
📈 Copy Ratio: ${(config.copyRatio * 100).toFixed(1)}%
💰 Max Position: ${config.maxPositionSize} BNB
⏱️ Delay: ${config.delayMs}ms
🔄 Status: ${config.enabled ? '🟢 Active' : '🔴 Inactive'}

📋 Recent Trades (${activeTrades.length}):`;

        if (activeTrades.length === 0) {
          message += '\n• No recent trades';
        } else {
          activeTrades.slice(-5).forEach((trade, index) => {
            const statusEmoji = trade.status === 'EXECUTED' ? '✅' : 
                              trade.status === 'FAILED' ? '❌' : '⏳';
            message += `\n${index + 1}. ${statusEmoji} ${trade.tradeType} ${trade.copiedAmount.toFixed(4)} BNB`;
            if (trade.ourTxHash) {
              message += `\n   TX: ${trade.ourTxHash.slice(0, 10)}...`;
            }
          });
        }

        ctx.reply(message);
      } catch (error) {
        console.error('Error in copystatus command:', error);
        ctx.reply('❌ An error occurred while fetching copy trading status.');
      }
    });

    this.bot.command('copystop', async (ctx) => {
      try {
        CopyTradingService.disableCopyTrading(ctx.from.id.toString());
        ctx.reply('🛑 Copy trading stopped successfully!');
      } catch (error) {
        console.error('Error in copystop command:', error);
        ctx.reply('❌ An error occurred while stopping copy trading.');
      }
    });

    this.bot.command('copystart', async (ctx) => {
      try {
        CopyTradingService.enableCopyTrading(ctx.from.id.toString());
        ctx.reply('▶️ Copy trading started successfully!');
      } catch (error) {
        console.error('Error in copystart command:', error);
        ctx.reply('❌ An error occurred while starting copy trading.');
      }
    });

    this.bot.command('copymonitor', async (ctx) => {
      try {
        const status = CopyTradingService.getCopyTradingStatus(ctx.from.id.toString());
        
        if (!status.isEnabled) {
          ctx.reply('❌ Copy trading is not enabled. Use /copy to set it up.');
          return;
        }

        const config = status.config!;
        const activeTrades = status.activeTrades;
        
        let message = `🔍 Copy Trading Monitor
🎯 Target: ${SecurityUtils.maskSensitiveData(config.targetWallet, 6)}
📈 Copy Ratio: ${(config.copyRatio * 100).toFixed(1)}%
💰 Max Position: ${config.maxPositionSize} BNB
⏱️ Delay: ${config.delayMs}ms
🔄 Status: ${config.enabled ? '🟢 Active' : '🔴 Inactive'}

📊 Recent Activity:
• Total Trades: ${activeTrades.length}
• Successful: ${activeTrades.filter(t => t.status === 'EXECUTED').length}
• Failed: ${activeTrades.filter(t => t.status === 'FAILED').length}
• Pending: ${activeTrades.filter(t => t.status === 'PENDING').length}

💡 The bot is monitoring BSC blocks every 3 seconds for transactions from your target wallet. Check the console logs for detailed activity.`;

        ctx.reply(message);
      } catch (error) {
        console.error('Error in copymonitor command:', error);
        ctx.reply('❌ An error occurred while fetching monitoring status.');
      }
    });
  }
}

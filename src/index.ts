import dotenv from 'dotenv';
import { BotService } from './services/bot';
import { config } from './config';

// Load environment variables
dotenv.config();

/**
 * Main application entry point
 * Safe Four-Meme Trader Bot
 */

async function main() {
  try {
    console.log('🚀 Starting Safe Four-Meme Trader Bot...');
    console.log(`📊 Environment: ${config.NODE_ENV}`);
    console.log(`🌐 BSC RPC: ${config.BSC_RPC_URL}`);
    console.log(`🔒 Encryption: ${config.security.enableEncryption ? 'Enabled' : 'Disabled'}`);
    console.log(`⚡ Rate Limiting: ${config.security.enableRateLimiting ? 'Enabled' : 'Disabled'}`);

    // Initialize and start the bot
    const bot = new BotService();
    await bot.start();

    // Graceful shutdown handling
    process.once('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    console.log('✅ Bot is running! Press Ctrl+C to stop.');

  } catch (error) {
    console.error('💥 Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error: Error) => {
    console.error('💥 Application error:', error);
    process.exit(1);
  });
}

export { BotService, config };

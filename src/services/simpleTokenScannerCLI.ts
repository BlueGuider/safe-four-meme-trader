import { TokenCreationScanner } from './tokenCreationScanner';

/**
 * Simple CLI Interface for Token Creation Scanner
 * 
 * This provides a simple command-line interface for managing the token creation scanner
 * without depending on TelegramBotService.
 */
export class SimpleTokenScannerCLI {
  private scanner: TokenCreationScanner;

  constructor() {
    this.scanner = new TokenCreationScanner();
    console.log('🔧 Simple Token Scanner CLI initialized');
  }

  /**
   * Add a creator to monitor
   */
  addCreator(address: string): void {
    if (!this.isValidAddress(address)) {
      console.log('❌ Invalid wallet address format');
      return;
    }

    this.scanner.addMonitoredCreator(address);
    console.log(`✅ Creator added: ${address.slice(0, 8)}...`);
  }

  /**
   * Remove a creator from monitoring
   */
  removeCreator(address: string): void {
    if (!this.isValidAddress(address)) {
      console.log('❌ Invalid wallet address format');
      return;
    }

    this.scanner.removeMonitoredCreator(address);
    console.log(`✅ Creator removed: ${address.slice(0, 8)}...`);
  }

  /**
   * List all monitored creators
   */
  listCreators(): void {
    const creators = this.scanner.getMonitoredCreators();

    if (creators.length === 0) {
      console.log('📋 No creators are currently being monitored');
      return;
    }

    console.log('📋 Monitored Creators:');
    creators.forEach((creator, index) => {
      console.log(`   ${index + 1}. ${creator}`);
    });

    const status = this.scanner.getStatus();
    console.log(`\n💰 Buy Amount: ${status.buyAmount} BNB`);
    console.log(`⏰ Sell Time: ${status.sellTimeSeconds} seconds`);
  }

  /**
   * Start scanning
   */
  async startScanning(): Promise<void> {
    try {
      await this.scanner.startScanning();
      console.log('✅ Token creation scanner started!');
    } catch (error) {
      console.log(`❌ Failed to start scanning: ${error}`);
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning(): Promise<void> {
    try {
      await this.scanner.stopScanning();
      console.log('✅ Token creation scanner stopped!');
    } catch (error) {
      console.log(`❌ Failed to stop scanning: ${error}`);
    }
  }

  /**
   * Show status
   */
  showStatus(): void {
    const status = this.scanner.getStatus();

    console.log('📊 Token Creation Scanner Status:');
    console.log(`   🔄 Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
    console.log(`   👥 Monitored Creators: ${status.monitoredCreatorsCount}`);
    console.log(`   💰 Buy Amount: ${status.buyAmount} BNB`);
    console.log(`   ⏰ Sell Time: ${status.sellTimeSeconds} seconds`);
    console.log(`   🔍 Scan Interval: ${status.scanInterval}ms`);
    console.log(`   📍 Last Processed Block: ${status.lastProcessedBlock}`);
  }

  /**
   * Set buy amount
   */
  setBuyAmount(amount: number): void {
    if (isNaN(amount) || amount <= 0 || amount > 10) {
      console.log('❌ Buy amount must be between 0.001 and 10 BNB');
      return;
    }

    this.scanner.setBuyAmount(amount);
    console.log(`✅ Buy amount set to: ${amount} BNB`);
  }

  /**
   * Set sell time
   */
  setSellTime(seconds: number): void {
    if (isNaN(seconds) || seconds <= 0 || seconds > 3600) {
      console.log('❌ Sell time must be between 1 and 3600 seconds');
      return;
    }

    this.scanner.setSellTime(seconds);
    console.log(`✅ Sell time set to: ${seconds} seconds`);
  }

  /**
   * Show help
   */
  showHelp(): void {
    console.log(`
🤖 Simple Token Scanner CLI Commands

📝 Management:
• addCreator(address) - Add a creator to monitor
• removeCreator(address) - Remove a creator from monitoring
• listCreators() - List all monitored creators

🎮 Control:
• startScanning() - Start the token creation scanner
• stopScanning() - Stop the token creation scanner
• showStatus() - Get current status

⚙️ Configuration:
• setBuyAmount(amount) - Set buy amount in BNB (0.001-10)
• setSellTime(seconds) - Set sell time in seconds (1-3600)

📊 Information:
• showHelp() - Show this help message

💡 Example Usage:
const cli = new SimpleTokenScannerCLI();
cli.addCreator('0x1234...');
cli.setBuyAmount(0.1);
cli.setSellTime(7);
cli.startScanning();
`);
  }

  /**
   * Validate Ethereum address
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get the scanner instance
   */
  getScanner(): TokenCreationScanner {
    return this.scanner;
  }
}

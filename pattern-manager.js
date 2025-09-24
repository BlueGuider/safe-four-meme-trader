const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');
const readline = require('readline');

/**
 * Pattern Management CLI
 * Interactive tool for managing trading patterns
 */

class PatternManager {
  constructor() {
    this.scanner = new PatternBasedScanner();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🔧 Pattern-Based Token Scanner - Pattern Manager\n');
    this.showMenu();
  }

  showMenu() {
    console.log('\n📋 Pattern Management Menu:');
    console.log('1. View all patterns');
    console.log('2. Add new pattern');
    console.log('3. Edit existing pattern');
    console.log('4. Delete pattern');
    console.log('5. Enable/disable pattern');
    console.log('6. View pattern performance');
    console.log('7. Test pattern matching');
    console.log('8. Reset pattern statistics');
    console.log('9. Exit');
    console.log('');

    this.rl.question('Select an option (1-9): ', (answer) => {
      this.handleMenuChoice(answer.trim());
    });
  }

  async handleMenuChoice(choice) {
    switch (choice) {
      case '1':
        this.viewPatterns();
        break;
      case '2':
        await this.addPattern();
        break;
      case '3':
        await this.editPattern();
        break;
      case '4':
        await this.deletePattern();
        break;
      case '5':
        await this.togglePattern();
        break;
      case '6':
        this.viewPerformance();
        break;
      case '7':
        this.testPatternMatching();
        break;
      case '8':
        this.resetStats();
        break;
      case '9':
        console.log('👋 Goodbye!');
        this.rl.close();
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid option. Please try again.');
        this.showMenu();
    }
  }

  viewPatterns() {
    console.log('\n📋 Current Patterns:');
    const patterns = this.scanner.getPatterns();
    
    if (patterns.length === 0) {
      console.log('   No patterns found.');
    } else {
      patterns.forEach((pattern, index) => {
        console.log(`\n${index + 1}. ${pattern.name} (${pattern.id})`);
        console.log(`   Description: ${pattern.description}`);
        console.log(`   Gas Price: ${pattern.gasPrice.min}-${pattern.gasPrice.max} ${pattern.gasPrice.unit}`);
        console.log(`   Gas Limit: ${pattern.gasLimit.min.toLocaleString()}-${pattern.gasLimit.max.toLocaleString()}`);
        console.log(`   Buy Amount: ${pattern.trading.buyAmount} BNB`);
        console.log(`   Hold Time: ${pattern.trading.holdTimeSeconds} seconds`);
        console.log(`   Priority: ${pattern.priority}`);
        console.log(`   Enabled: ${pattern.enabled ? 'Yes' : 'No'}`);
      });
    }
    
    this.showMenu();
  }

  async addPattern() {
    console.log('\n➕ Add New Pattern:');
    
    const pattern = {
      id: await this.askQuestion('Pattern ID (e.g., whale_creator_2): '),
      name: await this.askQuestion('Pattern Name: '),
      description: await this.askQuestion('Description: '),
      enabled: true,
      priority: parseInt(await this.askQuestion('Priority (1-10, lower = higher priority): ')) || 5,
      gasPrice: {
        min: parseFloat(await this.askQuestion('Min Gas Price (gwei): ')) || 1.0,
        max: parseFloat(await this.askQuestion('Max Gas Price (gwei): ')) || 10.0,
        unit: 'gwei'
      },
      gasLimit: {
        min: parseInt(await this.askQuestion('Min Gas Limit: ')) || 1000000,
        max: parseInt(await this.askQuestion('Max Gas Limit: ')) || 5000000
      },
      trading: {
        buyAmount: parseFloat(await this.askQuestion('Buy Amount (BNB): ')) || 0.01,
        holdTimeSeconds: parseInt(await this.askQuestion('Hold Time (seconds): ')) || 30,
        maxSlippage: parseFloat(await this.askQuestion('Max Slippage (%): ')) || 5.0,
        stopLossPercent: parseFloat(await this.askQuestion('Stop Loss (%): ')) || 20.0,
        takeProfitPercent: parseFloat(await this.askQuestion('Take Profit (%): ')) || 100.0
      },
      filters: {
        minTransactionValue: parseFloat(await this.askQuestion('Min Transaction Value (BNB): ')) || 0.01,
        maxTransactionValue: parseFloat(await this.askQuestion('Max Transaction Value (BNB): ')) || 10.0,
        requiredConfirmations: parseInt(await this.askQuestion('Required Confirmations: ')) || 1
      }
    };

    this.scanner.addPattern(pattern);
    console.log('✅ Pattern added successfully!');
    this.showMenu();
  }

  async editPattern() {
    const patterns = this.scanner.getPatterns();
    if (patterns.length === 0) {
      console.log('❌ No patterns to edit.');
      this.showMenu();
      return;
    }

    console.log('\n✏️  Edit Pattern:');
    patterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ${pattern.name} (${pattern.id})`);
    });

    const choice = parseInt(await this.askQuestion('Select pattern to edit (number): ')) - 1;
    if (choice < 0 || choice >= patterns.length) {
      console.log('❌ Invalid selection.');
      this.showMenu();
      return;
    }

    const pattern = patterns[choice];
    console.log(`\nEditing: ${pattern.name}`);
    
    const updates = {};
    const newName = await this.askQuestion(`Name (current: ${pattern.name}): `);
    if (newName) updates.name = newName;
    
    const newBuyAmount = await this.askQuestion(`Buy Amount (current: ${pattern.trading.buyAmount}): `);
    if (newBuyAmount) updates.trading = { ...pattern.trading, buyAmount: parseFloat(newBuyAmount) };
    
    const newHoldTime = await this.askQuestion(`Hold Time (current: ${pattern.trading.holdTimeSeconds}): `);
    if (newHoldTime) updates.trading = { ...pattern.trading, holdTimeSeconds: parseInt(newHoldTime) };

    if (Object.keys(updates).length > 0) {
      this.scanner.updatePattern(pattern.id, updates);
      console.log('✅ Pattern updated successfully!');
    } else {
      console.log('ℹ️  No changes made.');
    }
    
    this.showMenu();
  }

  async deletePattern() {
    const patterns = this.scanner.getPatterns();
    if (patterns.length === 0) {
      console.log('❌ No patterns to delete.');
      this.showMenu();
      return;
    }

    console.log('\n🗑️  Delete Pattern:');
    patterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ${pattern.name} (${pattern.id})`);
    });

    const choice = parseInt(await this.askQuestion('Select pattern to delete (number): ')) - 1;
    if (choice < 0 || choice >= patterns.length) {
      console.log('❌ Invalid selection.');
      this.showMenu();
      return;
    }

    const pattern = patterns[choice];
    const confirm = await this.askQuestion(`Are you sure you want to delete "${pattern.name}"? (y/N): `);
    
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      this.scanner.removePattern(pattern.id);
      console.log('✅ Pattern deleted successfully!');
    } else {
      console.log('ℹ️  Deletion cancelled.');
    }
    
    this.showMenu();
  }

  async togglePattern() {
    const patterns = this.scanner.getPatterns();
    if (patterns.length === 0) {
      console.log('❌ No patterns to toggle.');
      this.showMenu();
      return;
    }

    console.log('\n🔄 Toggle Pattern:');
    patterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ${pattern.name} (${pattern.id}) - ${pattern.enabled ? 'Enabled' : 'Disabled'}`);
    });

    const choice = parseInt(await this.askQuestion('Select pattern to toggle (number): ')) - 1;
    if (choice < 0 || choice >= patterns.length) {
      console.log('❌ Invalid selection.');
      this.showMenu();
      return;
    }

    const pattern = patterns[choice];
    const newState = !pattern.enabled;
    this.scanner.togglePattern(pattern.id, newState);
    console.log(`✅ Pattern ${newState ? 'enabled' : 'disabled'} successfully!`);
    this.showMenu();
  }

  viewPerformance() {
    console.log('\n📈 Pattern Performance:');
    const performance = this.scanner.getPatternPerformance();
    
    if (performance.length === 0) {
      console.log('   No performance data available yet.');
    } else {
      performance.forEach((perf, index) => {
        console.log(`\n${index + 1}. ${perf.patternName}`);
        console.log(`   Matches: ${perf.matches}`);
        console.log(`   Trades: ${perf.trades}`);
        console.log(`   Success Rate: ${perf.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${perf.avgProfit.toFixed(4)} BNB`);
      });
    }
    
    this.showMenu();
  }

  testPatternMatching() {
    console.log('\n🧪 Testing Pattern Matching...');
    this.scanner.testPatternMatching();
    this.showMenu();
  }

  resetStats() {
    const confirm = this.askQuestion('Are you sure you want to reset all pattern statistics? (y/N): ');
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      this.scanner.resetPatternStats();
      console.log('✅ Pattern statistics reset successfully!');
    } else {
      console.log('ℹ️  Reset cancelled.');
    }
    this.showMenu();
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Run the pattern manager
const manager = new PatternManager();
manager.start().catch(console.error);

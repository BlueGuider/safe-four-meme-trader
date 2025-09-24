# 🎯 Pattern-Based Token Scanner

## Overview

The Pattern-Based Token Scanner is an intelligent system that analyzes gas patterns in token creation transactions to identify profitable trading opportunities. Instead of blindly copying trades, it uses sophisticated pattern matching to determine which tokens are worth trading based on the creator's gas usage patterns.

## 🧠 How It Works

### 1. **Gas Pattern Analysis**
- Monitors all `createToken` transactions on four.meme contract
- Analyzes gas price and gas limit patterns
- Calculates confidence scores for each pattern match

### 2. **Pattern Matching**
- Compares transaction metrics against predefined patterns
- Each pattern represents a different type of creator (whale, smart money, bot, etc.)
- Uses weighted scoring system for accurate matching

### 3. **Intelligent Trading**
- Each pattern has its own trading parameters
- Different buy amounts, hold times, and risk management per pattern
- Automatic execution based on pattern confidence

## 📊 Pattern Structure

Each pattern contains:

```json
{
  "id": "whale_creator_1",
  "name": "Whale Creator Pattern 1",
  "description": "High gas price, high gas limit - likely a whale",
  "enabled": true,
  "priority": 1,
  "gasPrice": {
    "min": 5.0,
    "max": 20.0,
    "unit": "gwei"
  },
  "gasLimit": {
    "min": 2000000,
    "max": 5000000
  },
  "trading": {
    "buyAmount": 0.01,
    "holdTimeSeconds": 30,
    "maxSlippage": 3.0,
    "stopLossPercent": 20.0,
    "takeProfitPercent": 100.0
  },
  "filters": {
    "minTransactionValue": 0.1,
    "maxTransactionValue": 10.0,
    "requiredConfirmations": 1
  }
}
```

## 🎯 Pattern Types

### **Whale Creator Patterns**
- **Characteristics**: High gas price (5-20 gwei), high gas limit (2M-5M)
- **Strategy**: Larger buy amounts, longer hold times
- **Risk**: Lower risk, higher confidence

### **Smart Money Patterns**
- **Characteristics**: Medium gas price (2-8 gwei), optimized gas limit (1.5M-2.5M)
- **Strategy**: Balanced approach, moderate hold times
- **Risk**: Medium risk, good success rate

### **Bot Creator Patterns**
- **Characteristics**: Low gas price (0.5-3 gwei), high gas limit (3M-8M)
- **Strategy**: Smaller amounts, quick trades
- **Risk**: Higher risk, potential for quick profits

### **Premium Creator Patterns**
- **Characteristics**: Very high gas price (15-50 gwei), optimized gas limit
- **Strategy**: Large amounts, longer hold times
- **Risk**: Low risk, high potential returns

## 🚀 Usage

### **Basic Usage**

```javascript
const { PatternBasedScanner } = require('./dist/patternBasedScanners');

// Create scanner instance
const scanner = new PatternBasedScanner();

// Start monitoring
await scanner.startScanning();
```

### **Pattern Management**

```javascript
// Add new pattern
scanner.addPattern({
  id: 'custom_pattern_1',
  name: 'Custom Pattern',
  // ... pattern configuration
});

// Update pattern
scanner.updatePattern('pattern_id', {
  trading: { buyAmount: 0.02 }
});

// Toggle pattern
scanner.togglePattern('pattern_id', false);

// Remove pattern
scanner.removePattern('pattern_id');
```

### **Performance Monitoring**

```javascript
// Get pattern performance
const performance = scanner.getPatternPerformance();
console.log(performance);

// Get pattern statistics
const stats = scanner.getPatternStats();
console.log(stats);
```

## 🛠️ Management Tools

### **Pattern Manager CLI**
```bash
node pattern-manager.js
```

Interactive tool for:
- Viewing all patterns
- Adding new patterns
- Editing existing patterns
- Deleting patterns
- Enabling/disabling patterns
- Viewing performance statistics
- Testing pattern matching

### **Test Scripts**
```bash
# Test pattern matching logic
node test-pattern-scanner.js

# Run live scanner
node pattern-scanner-example.js
```

## 📈 Confidence Scoring

The system uses a weighted confidence scoring system:

- **Gas Price Match (40%)**: How well the gas price fits the pattern range
- **Gas Limit Match (30%)**: How well the gas limit fits the pattern range
- **Transaction Value (20%)**: How well the transaction value fits the pattern
- **Creator History (10%)**: Historical success rate of the creator

## 🎯 Trading Logic

### **Pattern Selection**
1. Calculate confidence for all enabled patterns
2. Filter patterns with confidence > 50%
3. Sort by priority (lower number = higher priority)
4. Select the highest priority pattern with highest confidence

### **Trade Execution**
1. Buy tokens using pattern-specific amount
2. Set stop-loss and take-profit based on pattern settings
3. Hold for pattern-specific duration
4. Sell tokens automatically

### **Risk Management**
- Each pattern has its own risk parameters
- Stop-loss and take-profit levels per pattern
- Maximum slippage limits
- Transaction value filters

## 📊 Performance Tracking

### **Pattern Statistics**
- **Matches**: Number of times pattern was matched
- **Trades**: Number of successful trades executed
- **Success Rate**: Percentage of successful trades
- **Average Profit**: Average profit per trade

### **Real-time Monitoring**
- Live pattern matching updates
- Performance statistics every 30 seconds
- Detailed logging of all activities

## 🔧 Configuration

### **Scanner Settings**
- **Scan Interval**: 500ms (fast detection)
- **Max Blocks Per Scan**: 1 (optimized for speed)
- **Target Contract**: Four.meme V2 contract

### **Pattern Settings**
- **Max Patterns**: 20 patterns
- **Default Priority**: 10
- **Pattern Matching Timeout**: 5000ms
- **Enable Pattern Logging**: true

## 📁 File Structure

```
├── patternBasedScanners.ts    # Main scanner service
├── patterns.json              # Pattern configuration file
├── test-pattern-scanner.js    # Test script
├── pattern-scanner-example.js # Example usage
├── pattern-manager.js         # Pattern management CLI
└── PATTERN_BASED_SCANNER_README.md
```

## 🎯 Advantages Over Copy Trading

### **Intelligence**
- Analyzes creator behavior patterns
- Makes informed decisions based on gas usage
- Adapts to different creator types

### **Flexibility**
- Easy to add/edit/remove patterns
- Different strategies for different creators
- Configurable risk management per pattern

### **Performance**
- Tracks pattern success rates
- Optimizes based on historical data
- Reduces false positives

### **Scalability**
- Can handle multiple pattern types
- Easy to add new creator patterns
- Centralized pattern management

## 🚨 Important Notes

1. **Pattern Accuracy**: Patterns should be based on historical data analysis
2. **Risk Management**: Each pattern has its own risk parameters
3. **Performance Monitoring**: Regularly review pattern performance
4. **Pattern Updates**: Update patterns based on market changes
5. **Testing**: Always test new patterns before enabling

## 🎉 Getting Started

1. **Setup Environment**: Ensure `.env` file is configured
2. **Load Patterns**: Patterns are loaded from `patterns.json`
3. **Test Patterns**: Run `node test-pattern-scanner.js`
4. **Manage Patterns**: Use `node pattern-manager.js` for easy management
5. **Start Scanner**: Run `node pattern-scanner-example.js`

The Pattern-Based Token Scanner provides a sophisticated, intelligent approach to token trading that goes beyond simple copy trading to analyze and profit from different creator patterns! 🚀


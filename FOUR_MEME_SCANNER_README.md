# Four.Meme Token Creation Scanner

## Overview

The TokenCreationScanner has been modified to specifically monitor transactions between creator wallet addresses and the four.meme contract (`0x5c952063c7fc8610ffdb798152d69f0b9550762b`). When a monitored creator calls the `createToken` function, the bot automatically buys the newly created token and sells it after a specified time.

## Key Changes

### 1. Target Contract Monitoring
- **Before**: Scanned for contract creation transactions (`tx.to === null`)
- **After**: Monitors transactions TO the four.meme contract (`0x5c952063c7fc8610ffdb798152d69f0b9550762b`)

### 2. Function Detection
- **Before**: Analyzed contract creation patterns
- **After**: Detects `createToken` function calls using method ID `0x519ebb10`

### 3. Token Address Extraction
- **Before**: Used contract creation receipt
- **After**: Extracts token address from `TokenCreate` event logs

## How It Works

1. **Block Scanning**: The scanner monitors BSC blocks every 3 seconds
2. **Transaction Filtering**: Only processes transactions TO the four.meme contract
3. **Creator Check**: Verifies the transaction is from a monitored creator wallet
4. **Function Detection**: Checks if the transaction calls `createToken` function
5. **Token Extraction**: Extracts the created token address from event logs
6. **Automatic Trading**: Buys the token immediately and schedules a sell

## Usage

### Basic Setup

```javascript
const { TokenCreationScanner } = require('./dist/services/tokenCreationScanner');

// Create scanner instance
const scanner = new TokenCreationScanner();

// Add creator addresses to monitor
scanner.addMonitoredCreator('0x815f173371323a3f8ea9bf15059e91c9577ef7a7');
scanner.addMonitoredCreator('0x3ffec7beae34121288a5303262f45f05699ad2a8');

// Configure settings
scanner.setBuyAmount(0.0001); // Buy 0.0001 BNB worth (small amount)
scanner.setSellTime(7); // Sell after 7 seconds

// Start monitoring
await scanner.startScanning();
```

### Example Transaction Flow

When a monitored creator (`0x815f173371323a3f8ea9bf15059e91c9577ef7a7` or `0x3ffec7beae34121288a5303262f45f05699ad2a8`) creates a token:

```
Transaction Hash: 0x5a094f25ca0e31783d1ea4ee4a3e6349ea5fb206b314939729aff2beb760cbc5
From: 0x886ba1c91Fb4e4200A6F8f9bb22402E01CB0d629
To: 0x5c952063c7fc8610ffdb798152d69f0b9550762b
Function: createToken(bytes code, bytes poolsCode)
Method ID: 0x519ebb10
```

The scanner will:
1. ✅ Detect the transaction is from a monitored creator
2. ✅ Verify it's a `createToken` call
3. ✅ Extract the token address from logs
4. ✅ Buy the token immediately
5. ✅ Schedule sell after specified time

## Configuration

### Scanner Settings

```javascript
// Buy amount per token (in BNB)
scanner.setBuyAmount(0.0001); // 0.0001 BNB (small amount)

// Time to hold before selling (in seconds)
scanner.setSellTime(7); // 7 seconds

// Add/remove monitored creators
scanner.addMonitoredCreator('0x...');
scanner.removeMonitoredCreator('0x...');

// Get current status
const status = scanner.getStatus();
console.log(status);
```

### Monitoring Multiple Creators

```javascript
const creators = [
  '0x815f173371323a3f8ea9bf15059e91c9577ef7a7',
  '0x3ffec7beae34121288a5303262f45f05699ad2a8'
];

creators.forEach(creator => {
  scanner.addMonitoredCreator(creator);
});
```

## Event Detection

The scanner looks for the `TokenCreate` event:

```solidity
event TokenCreate(
  address indexed creator,
  address indexed token,
  uint256 requestId,
  string name,
  string symbol,
  uint256 totalSupply,
  uint256 launchTime,
  uint256 launchFee
);
```

Event signature hash: `keccak256("TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)")`

## Testing

### Run Test Script

```bash
node test-four-meme-scanner.js
```

### Run Example

```bash
node four-meme-scanner-example.js
```

## Important Notes

1. **Creator Monitoring**: Only transactions from added creator addresses will trigger automatic trading
2. **Contract Verification**: The scanner verifies created contracts are valid ERC20 tokens
3. **Error Handling**: Failed transactions are logged but don't stop the scanner
4. **Rate Limiting**: Scans every 3 seconds to avoid overwhelming the RPC endpoint
5. **Block Processing**: Processes up to 5 blocks per scan to handle high activity periods

## Security Considerations

- **Private Keys**: Ensure your wallet private keys are properly secured
- **Buy Amounts**: Start with small amounts for testing
- **Creator Verification**: Only add trusted creator addresses
- **Network Fees**: Account for BNB gas fees in your wallet balances

## Troubleshooting

### Common Issues

1. **No tokens detected**: Check if creator addresses are correctly added
2. **Buy failures**: Ensure wallets have sufficient BNB for gas fees
3. **Token verification fails**: Some tokens may not implement standard ERC20 functions

### Debug Logs

The scanner provides detailed logging:
- `🎯 Token creation detected` - When a token is found
- `✅ Successfully bought token` - When buy succeeds
- `✅ Successfully sold token` - When sell succeeds
- `❌ Failed to buy/sell` - When transactions fail

## Integration with Existing System

The modified scanner integrates seamlessly with the existing trading infrastructure:

- **TradingService**: Handles buy/sell operations
- **ContractService**: Provides token information
- **WalletService**: Manages wallet operations
- **PriceTrackingService**: Tracks token prices

## Performance

- **Scan Interval**: 500ms (fast mode for quick detection)
- **Block Processing**: 1 block per scan (optimized for speed)
- **Memory Usage**: Minimal, only stores necessary transaction data
- **Network Usage**: Optimized to reduce RPC calls

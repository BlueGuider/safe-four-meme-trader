# Safe Four-Meme Trader Bot

A secure and enhanced four.meme token trading bot with comprehensive security features, input validation, and MEV protection.

## 🔒 Security Features

- **Encrypted Private Key Storage**: All private keys are encrypted using AES-256-GCM
- **Input Validation**: Comprehensive validation for all user inputs
- **Rate Limiting**: Protection against spam and abuse
- **MEV Protection**: Transaction bundling for protection against MEV attacks
- **Error Handling**: Robust error handling with user-friendly messages
- **Access Control**: Secure wallet access with proper authorization

## 🚀 Features

- **Multi-Wallet Management**: Create and manage multiple BSC wallets
- **Four.Meme Trading**: Buy and sell four.meme tokens using official contracts
- **Token Balance Tracking**: Monitor token balances across all wallets
- **Telegram Bot Interface**: Easy-to-use Telegram commands
- **Gas Optimization**: Smart gas price management
- **Bundle Transactions**: Submit multiple transactions as bundles for efficiency

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Telegram Bot Token
- BSC RPC URL (Alchemy recommended)
- BloxRoute API Key (for MEV protection)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd safe-four-meme-trader
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```

4. **Configure your environment**
   Edit `.env` file with your configuration:
   ```env
   # Required
   BOT_TOKEN=your_telegram_bot_token_here
   BSC_RPC_URL=https://bsc-dataseed.binance.org
   ENCRYPTION_KEY=your_32_character_encryption_key_here
   
   # Optional
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   BLOXROUTE_API_KEY=your_bloxroute_api_key_here
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the bot**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 🤖 Bot Commands

### Wallet Management
- `/create <count>` - Create new wallets (max 10)
- `/wallets` - View your wallets and balances
- `/stats` - View your trading statistics

### Trading
- `/buy <token_address> <bnb_amount>` - Buy tokens with BNB
- `/sell <token_address> <percentage>` - Sell percentage of tokens
- `/balance <token_address>` - Check token balances

### Information
- `/help` - Show help message
- `/start` - Show welcome message

## 📊 Usage Examples

1. **Create wallets**
   ```
   /create 5
   ```

2. **Buy tokens**
   ```
   /buy 0x1234567890abcdef1234567890abcdef12345678 0.1
   ```

3. **Sell tokens**
   ```
   /sell 0x1234567890abcdef1234567890abcdef12345678 50
   ```

4. **Check balances**
   ```
   /balance 0x1234567890abcdef1234567890abcdef12345678
   ```

## 🔧 Configuration

### Security Settings
```env
# Maximum wallets per user
MAX_WALLETS_PER_USER=10

# Transaction limits
MAX_TRANSACTION_AMOUNT=10
MIN_TRANSACTION_AMOUNT=0.001

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Enable/disable features
ENABLE_ENCRYPTION=true
ENABLE_RATE_LIMITING=true
ENABLE_INPUT_VALIDATION=true
```

### Trading Settings
```env
# Gas settings
GAS_PRICE_MULTIPLIER=1.1
MAX_GAS_PRICE=20
MIN_GAS_PRICE=1
GAS_LIMIT_BUFFER=20

# Trading limits
MAX_SLIPPAGE=5
ENABLE_MEV_PROTECTION=true
BUNDLE_TIMEOUT=30000
```

## 🏗️ Project Structure

```
src/
├── config/           # Configuration files
├── contracts/        # Contract ABIs and interfaces
├── services/         # Core business logic
│   ├── wallet.ts     # Wallet management
│   ├── trading.ts    # Trading operations
│   ├── contracts.ts  # Contract interactions
│   └── bot.ts        # Telegram bot
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
│   ├── security.ts   # Security utilities
│   ├── validation.ts # Input validation
│   └── web3.ts       # Web3 utilities
└── index.ts          # Main application entry point
```

## 🔐 Security Considerations

1. **Private Key Protection**
   - All private keys are encrypted before storage
   - Keys are never logged or exposed in error messages
   - Access is controlled through user sessions

2. **Input Validation**
   - All user inputs are validated and sanitized
   - Address format validation
   - Amount and percentage validation
   - Rate limiting to prevent abuse

3. **Error Handling**
   - Comprehensive error handling throughout
   - User-friendly error messages
   - No sensitive information in error logs

4. **Access Control**
   - Users can only access their own wallets
   - Session-based access control
   - Secure file operations

## 🚨 Important Notes

- **Never share your private keys** with anyone
- **Always verify token addresses** before trading
- **Start with small amounts** when trading new tokens
- **Use official four.meme contracts** only
- **Keep your encryption key secure** and backed up

## 🐛 Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check if BOT_TOKEN is correct
   - Verify network connection
   - Check bot logs for errors

2. **Transaction failures**
   - Ensure sufficient BNB balance
   - Check gas price settings
   - Verify token address is correct

3. **Wallet creation fails**
   - Check file permissions
   - Verify encryption key is set
   - Check disk space

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## 📈 Performance

- **Concurrent Operations**: Multiple wallets can trade simultaneously
- **Bundle Transactions**: Efficient transaction submission
- **Gas Optimization**: Smart gas price management
- **Rate Limiting**: Prevents system overload

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational purposes only. Trading cryptocurrencies involves risk. Use at your own risk. The authors are not responsible for any financial losses.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation

---

**Stay Safe, Trade Smart! 🚀**

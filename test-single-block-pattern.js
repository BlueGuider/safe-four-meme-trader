const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');
const { publicClient } = require('./dist/utils/web3');
const { keccak256, toHex } = require('viem');

/**
 * Quick test script to analyze patterns in a single block
 * This is useful for testing the pattern analysis on specific blocks
 */

const FOUR_MEME_CONTRACT = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';

/**
 * Analyze a single block for token creation patterns
 */
async function analyzeSingleBlock(blockNumber) {
  console.log(`🔍 Analyzing block ${blockNumber} for token creation patterns...\n`);
  
  try {
    // Create scanner instance
    const scanner = new PatternBasedScanner();
    const patterns = scanner.getPatterns();
    
    console.log(`📋 Available patterns: ${patterns.length}`);
    patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern.name} - Gas: ${pattern.gasPrice.min}-${pattern.gasPrice.max} ${pattern.gasPrice.unit}, Limit: ${pattern.gasLimit.min.toLocaleString()}-${pattern.gasLimit.max.toLocaleString()}`);
    });
    console.log('');

    // Get block with transactions
    const block = await publicClient.getBlock({
      blockNumber: BigInt(blockNumber),
      includeTransactions: true
    });

    console.log(`📦 Block ${blockNumber}: ${block.transactions.length} transactions`);
    console.log(`⏰ Block timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
    console.log('');

    let fourMemeTransactions = 0;
    let tokenCreations = 0;
    let patternMatches = 0;

    // Analyze each transaction in the block
    for (const tx of block.transactions) {
      try {
        // Check if this transaction is TO the four.meme contract
        if (tx.to && tx.to.toLowerCase() === FOUR_MEME_CONTRACT.toLowerCase()) {
          fourMemeTransactions++;
          console.log(`🎯 Four.meme transaction found: ${tx.hash}`);

          // Check if this is a createToken function call
          const isCreateTokenCall = await isCreateTokenFunction(tx);
          if (isCreateTokenCall) {
            tokenCreations++;
            console.log(`✅ Token creation detected!`);

            // Extract token address using scanner method
            const tokenAddress = await scanner.extractTokenAddressFromLogs(tx);
            if (tokenAddress) {
              console.log(`📍 Token address: ${tokenAddress}`);

              // Calculate gas metrics
              const gasPriceGwei = Number(tx.gasPrice) / 1e9;
              const gasLimit = Number(tx.gas);
              const transactionValue = Number(tx.value) / 1e18;

              console.log(`⛽ Gas Price: ${gasPriceGwei.toFixed(2)} gwei`);
              console.log(`⛽ Gas Limit: ${gasLimit.toLocaleString()}`);
              console.log(`💰 TX Value: ${transactionValue.toFixed(6)} BNB`);

              // Create mock token creation event for pattern analysis
              const mockTokenCreation = {
                tokenAddress: tokenAddress,
                creatorAddress: tx.from,
                blockNumber: blockNumber,
                transactionHash: tx.hash,
                timestamp: new Date(),
                gasPrice: gasPriceGwei,
                gasLimit: gasLimit,
                transactionValue: transactionValue
              };

              // Test pattern matching
              const matches = findMatchingPatterns(mockTokenCreation, patterns);
              
              if (matches.length > 0) {
                patternMatches++;
                const bestMatch = matches[0];
                
                console.log(`🎯 PATTERN MATCHED: ${bestMatch.pattern.name}`);
                console.log(`📊 Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`);
                console.log(`💰 Would buy: ${bestMatch.pattern.trading.buyAmount} BNB`);
                console.log(`⏰ Would hold: ${bestMatch.pattern.trading.holdTimeSeconds} seconds`);
                console.log(`🛡️ Stop loss: ${bestMatch.pattern.trading.stopLossPercent}%`);
                console.log(`🎯 Take profit: ${bestMatch.pattern.trading.takeProfitPercent}%`);
              } else {
                console.log(`❌ No patterns matched`);
              }
            } else {
              console.log(`⚠️ Could not extract token address`);
            }
          } else {
            console.log(`⚠️ Not a createToken call`);
          }
          console.log(''); // Empty line for readability
        }
      } catch (error) {
        console.log(`❌ Error analyzing transaction ${tx.hash}: ${error.message}`);
      }
    }

    // Print summary
    console.log('📊 BLOCK ANALYSIS SUMMARY');
    console.log('=========================');
    console.log(`📦 Block: ${blockNumber}`);
    console.log(`📊 Total transactions: ${block.transactions.length}`);
    console.log(`🎯 Four.meme transactions: ${fourMemeTransactions}`);
    console.log(`✅ Token creations: ${tokenCreations}`);
    console.log(`🎯 Pattern matches: ${patternMatches}`);

    if (patternMatches > 0) {
      console.log(`\n✅ This block would have triggered ${patternMatches} trading opportunity(ies)!`);
    } else {
      console.log(`\n❌ No trading opportunities found in this block.`);
    }

  } catch (error) {
    console.error('❌ Error analyzing block:', error);
  }
}

/**
 * Check if a transaction is calling the createToken function
 */
async function isCreateTokenFunction(tx) {
  try {
    if (!tx.input || tx.input === '0x') {
      return false;
    }

    const createTokenMethodId = '0x519ebb10';
    return tx.input.toLowerCase().startsWith(createTokenMethodId.toLowerCase());
  } catch (error) {
    console.log(`⚠️ Error checking createToken function: ${error}`);
    return false;
  }
}


/**
 * Find patterns that match the token creation
 */
function findMatchingPatterns(tokenCreation, patterns) {
  const matches = [];

  for (const pattern of patterns) {
    const confidence = calculatePatternConfidence(tokenCreation, pattern);
    
    if (confidence === 1.0) { // Perfect match - all requirements met
      matches.push({
        pattern,
        confidence,
        gasPriceGwei: tokenCreation.gasPrice,
        gasLimit: tokenCreation.gasLimit,
        transactionValue: tokenCreation.transactionValue
      });
    }
  }

  // Sort by priority and confidence
  matches.sort((a, b) => {
    if (a.pattern.priority !== b.pattern.priority) {
      return a.pattern.priority - b.pattern.priority;
    }
    return b.confidence - a.confidence;
  });

  return matches;
}

/**
 * Calculate pattern confidence score - Binary match (1.0 if all requirements met, 0.0 otherwise)
 */
function calculatePatternConfidence(tokenCreation, pattern) {
  // Convert gas price to gwei if needed
  const gasPriceInGwei = pattern.gasPrice.unit === 'gwei' ? tokenCreation.gasPrice : tokenCreation.gasPrice / 1e9;
  
  // Check if ALL requirements are met
  const gasPriceMatch = gasPriceInGwei >= pattern.gasPrice.min && gasPriceInGwei <= pattern.gasPrice.max;
  const gasLimitMatch = tokenCreation.gasLimit >= pattern.gasLimit.min && tokenCreation.gasLimit <= pattern.gasLimit.max;
  const transactionValueMatch = tokenCreation.transactionValue >= pattern.filters.minTransactionValue && 
                               tokenCreation.transactionValue <= pattern.filters.maxTransactionValue;
  
  // Return 1.0 if ALL requirements are met, 0.0 otherwise
  return (gasPriceMatch && gasLimitMatch && transactionValueMatch) ? 1.0 : 0.0;
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 Single Block Pattern Analysis Test');
  console.log('=====================================\n');

  // Get block number from command line argument or use default
  const blockNumber = process.argv[2] ? parseInt(process.argv[2]) : 62301305;

  console.log(`🎯 Analyzing block: ${blockNumber}`);
  console.log(`📋 This will test the existing pattern analysis functions on historical data\n`);

  await analyzeSingleBlock(blockNumber);

  console.log('\n✅ Single block analysis completed!');
  console.log('\n📝 To analyze more blocks, you can:');
  console.log('   1. Change the blockNumber variable in this script');
  console.log('   2. Run: node test-block-pattern-analysis.js (for block range)');
  console.log('   3. Run: node test-pattern-scanner.js (for pattern testing)');
}

// Run the analysis
main().catch(console.error);

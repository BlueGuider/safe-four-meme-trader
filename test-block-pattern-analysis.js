const { PatternBasedScanner } = require('./dist/services/patternBasedScanner');
const { publicClient } = require('./dist/utils/web3');
const { keccak256, toHex } = require('viem');

/**
 * Test script to analyze patterns in specific block range
 * This script uses the existing pattern analysis functions to test
 * pattern matching on historical blocks 62301300 ~ 62301400
 */

const FOUR_MEME_CONTRACT = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';

/**
 * Analyze a specific block range for token creation patterns
 */
async function analyzeBlockRange(startBlock, endBlock) {
  console.log(`🔍 Analyzing blocks ${startBlock} to ${endBlock} for token creation patterns...\n`);
  
  try {
    // Create scanner instance to use existing pattern analysis functions
    const scanner = new PatternBasedScanner();
    
    // Get patterns for analysis
    const patterns = scanner.getPatterns();
    console.log(`📋 Loaded ${patterns.length} patterns for analysis:`);
    patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern.name} (${pattern.id})`);
      console.log(`      Gas Price: ${pattern.gasPrice.min}-${pattern.gasPrice.max} ${pattern.gasPrice.unit}`);
      console.log(`      Gas Limit: ${pattern.gasLimit.min.toLocaleString()}-${pattern.gasLimit.max.toLocaleString()}`);
      console.log(`      Enabled: ${pattern.enabled ? 'Yes' : 'No'}`);
    });
    console.log('');

    let totalTransactions = 0;
    let fourMemeTransactions = 0;
    let tokenCreations = 0;
    let patternMatches = 0;
    const patternResults = new Map();

    // Analyze each block in the range
    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      try {
        console.log(`📦 Analyzing block ${blockNum}...`);
        
        // Get block with transactions
        const block = await publicClient.getBlock({
          blockNumber: BigInt(blockNum),
          includeTransactions: true
        });

        totalTransactions += block.transactions.length;
        console.log(`   📊 Block ${blockNum}: ${block.transactions.length} transactions`);

        // Analyze each transaction in the block
        for (const tx of block.transactions) {
          try {
            // Check if this transaction is TO the four.meme contract
            if (tx.to && tx.to.toLowerCase() === FOUR_MEME_CONTRACT.toLowerCase()) {
              fourMemeTransactions++;
              console.log(`   🎯 Found four.meme transaction: ${tx.hash}`);

              // Check if this is a createToken function call
              const isCreateTokenCall = await isCreateTokenFunction(tx);
              if (isCreateTokenCall) {
                tokenCreations++;
                console.log(`   ✅ Token creation detected: ${tx.hash}`);

                // Extract token address using scanner method
                const tokenAddress = await scanner.extractTokenAddressFromLogs(tx);
                if (tokenAddress) {
                  console.log(`   📍 Token address: ${tokenAddress}`);

                  // Calculate gas metrics
                  const gasPriceGwei = Number(tx.gasPrice) / 1e9;
                  const gasLimit = Number(tx.gas);
                  const transactionValue = Number(tx.value) / 1e18;

                  console.log(`   ⛽ Gas Price: ${gasPriceGwei.toFixed(2)} gwei`);
                  console.log(`   ⛽ Gas Limit: ${gasLimit.toLocaleString()}`);
                  console.log(`   💰 TX Value: ${transactionValue.toFixed(6)} BNB`);

                  // Create mock token creation event for pattern analysis
                  const mockTokenCreation = {
                    tokenAddress: tokenAddress,
                    creatorAddress: tx.from,
                    blockNumber: blockNum,
                    transactionHash: tx.hash,
                    timestamp: new Date(),
                    gasPrice: gasPriceGwei,
                    gasLimit: gasLimit,
                    transactionValue: transactionValue
                  };

                  // Test pattern matching using existing scanner functions
                  const matches = findMatchingPatterns(mockTokenCreation, patterns);
                  
                  if (matches.length > 0) {
                    patternMatches++;
                    const bestMatch = matches[0];
                    
                    console.log(`   🎯 PATTERN MATCHED: ${bestMatch.pattern.name}`);
                    console.log(`   📊 Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`);
                    console.log(`   💰 Would buy: ${bestMatch.pattern.trading.buyAmount} BNB`);
                    console.log(`   ⏰ Would hold: ${bestMatch.pattern.trading.holdTimeSeconds} seconds`);

                    // Track pattern results
                    const patternId = bestMatch.pattern.id;
                    if (!patternResults.has(patternId)) {
                      patternResults.set(patternId, {
                        name: bestMatch.pattern.name,
                        matches: 0,
                        avgConfidence: 0,
                        totalConfidence: 0
                      });
                    }
                    
                    const result = patternResults.get(patternId);
                    result.matches++;
                    result.totalConfidence += bestMatch.confidence;
                    result.avgConfidence = result.totalConfidence / result.matches;
                  } else {
                    console.log(`   ❌ No patterns matched`);
                  }
                } else {
                  console.log(`   ⚠️ Could not extract token address`);
                }
              } else {
                console.log(`   ⚠️ Not a createToken call`);
              }
            }
          } catch (error) {
            console.log(`   ❌ Error analyzing transaction ${tx.hash}: ${error.message}`);
          }
        }
        
        console.log(''); // Empty line for readability
        
      } catch (error) {
        console.log(`❌ Error analyzing block ${blockNum}: ${error.message}`);
      }
    }

    // Print summary
    console.log('📊 ANALYSIS SUMMARY');
    console.log('==================');
    console.log(`📦 Blocks analyzed: ${endBlock - startBlock + 1}`);
    console.log(`📊 Total transactions: ${totalTransactions}`);
    console.log(`🎯 Four.meme transactions: ${fourMemeTransactions}`);
    console.log(`✅ Token creations: ${tokenCreations}`);
    console.log(`🎯 Pattern matches: ${patternMatches}`);
    console.log('');

    if (patternResults.size > 0) {
      console.log('🎯 PATTERN MATCH RESULTS');
      console.log('========================');
      for (const [patternId, result] of patternResults) {
        console.log(`📋 ${result.name} (${patternId})`);
        console.log(`   Matches: ${result.matches}`);
        console.log(`   Avg Confidence: ${(result.avgConfidence * 100).toFixed(1)}%`);
        console.log('');
      }
    } else {
      console.log('❌ No patterns were matched in this block range');
    }

  } catch (error) {
    console.error('❌ Error analyzing block range:', error);
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

    // createToken function signature: createToken(bytes code, bytes poolsCode)
    // Method ID: 0x519ebb10
    const createTokenMethodId = '0x519ebb10';
    
    return tx.input.toLowerCase().startsWith(createTokenMethodId.toLowerCase());
  } catch (error) {
    console.log(`⚠️ Error checking createToken function: ${error}`);
    return false;
  }
}

/**
 * Extract the created token address from transaction logs
 */
async function extractTokenAddressFromLogs(tx) {
  try {
    // Get transaction receipt to access logs
    const receipt = await publicClient.getTransactionReceipt({
      hash: tx.hash
    });

    if (!receipt || !receipt.logs) {
      return null;
    }

    // Look for TokenCreate event logs from four.meme contract
    const tokenCreateEventHash = keccak256(toHex('TokenCreate(address,address,uint256,string,string,uint256,uint256)'));
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === FOUR_MEME_CONTRACT.toLowerCase()) {
        // Check if this is a TokenCreate event
        if (log.topics.length >= 3 && log.topics[0] === tokenCreateEventHash) {
          // Extract token address from the second indexed parameter
          const tokenAddress = '0x' + log.topics[2]?.slice(26) || '';
          if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
            return tokenAddress.toLowerCase();
          }
        }
      }
    }

    // Fallback: Look for any logs from the four.meme contract and try to extract addresses
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === FOUR_MEME_CONTRACT.toLowerCase()) {
        // Try to extract token address from log topics
        if (log.topics.length >= 2) {
          // The first topic is usually the event signature, second topic might be the token address
          const potentialTokenAddress = '0x' + log.topics[1]?.slice(26) || '';
          if (potentialTokenAddress && potentialTokenAddress !== '0x0000000000000000000000000000000000000000') {
            return potentialTokenAddress.toLowerCase();
          }
        }
      }
    }

    // If we can't find it in logs, try to get it from the transaction receipt's contractAddress
    if (receipt.contractAddress) {
      return receipt.contractAddress.toLowerCase();
    }

    return null;
  } catch (error) {
    console.log(`⚠️ Error extracting token address from logs: ${error}`);
    return null;
  }
}

/**
 * Find patterns that match the token creation (copied from PatternBasedScanner)
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
 * Calculate pattern confidence score (copied from PatternBasedScanner)
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
 * Main function to run the analysis
 */
async function main() {
  console.log('🧪 Testing Pattern Analysis on Historical Blocks');
  console.log('===============================================\n');

  const startBlock = 62301300;
  const endBlock = 62301400;

  console.log(`🎯 Target block range: ${startBlock} to ${endBlock}`);
  console.log(`📋 This will analyze ${endBlock - startBlock + 1} blocks for token creation patterns\n`);

  await analyzeBlockRange(startBlock, endBlock);

  console.log('\n✅ Analysis completed!');
  console.log('\n📝 This test shows how the existing pattern-based scanner would perform');
  console.log('   on historical data, allowing you to validate pattern effectiveness');
  console.log('   before running live scanning.');
}

// Run the analysis
main().catch(console.error);

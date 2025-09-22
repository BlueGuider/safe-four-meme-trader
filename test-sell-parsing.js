#!/usr/bin/env node

/**
 * Test file to verify SELL transaction parsing and copying
 * This tests the specific SELL transaction that wasn't being copied
 */

import { CopyTradingService } from './src/services/copyTrading.js';

async function testSellTransactionParsing() {
  console.log('🧪 Testing SELL Transaction Parsing...\n');

  // Test transaction data from the real SELL transaction
  const testSellTransaction = {
    hash: '0x961207bb64351d28e0ec56436c724803bb39d1581adc77f0799080c5d7c8ee22',
    from: '0x56d5f3491C100b00b9823fa427D8B92cd6A6FcaE',
    to: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
    value: '0x0', // No BNB sent (SELL transaction)
    input: '0xe63aaf360000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d0fa182ba4a6fad2fbdf5f38216fc37b924b444400000000000000000000000056d5f3491c100b00b9823fa427d8b92cd6a6fcae0000000000000000000000000000000000000000000337a42f613b6c3efa960000000000000000000000000000000000000000000000000000c3b814f3c358bd0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000b8159ba378904f803639d274cec79f788931c9c8',
    blockNumber: '0x3b2c8ac', // 61989356
    transactionIndex: '0x1c', // 28
    gas: '0x34a5b', // 215673
    gasPrice: '0x165a0bc00', // 6 gwei
    nonce: '0x12e8', // 4846
  };

  console.log('📋 Test Transaction Details:');
  console.log(`   Hash: ${testSellTransaction.hash}`);
  console.log(`   From: ${testSellTransaction.from}`);
  console.log(`   To: ${testSellTransaction.to}`);
  console.log(`   Value: ${testSellTransaction.value} (should be 0 for SELL)`);
  console.log(`   Input: ${testSellTransaction.input.slice(0, 10)}...`);
  console.log(`   Block: ${parseInt(testSellTransaction.blockNumber, 16)}`);
  console.log('');

  try {
    // Test 1: Check if it's a known trading contract
    console.log('🔍 Test 1: Checking if contract is known...');
    const isKnownContract = await CopyTradingService.isKnownTradingContract(testSellTransaction.to);
    console.log(`   Known trading contract: ${isKnownContract}`);
    
    // Test 2: Check if it's a token contract
    console.log('🔍 Test 2: Checking if it\'s a token contract...');
    const isTokenContract = await CopyTradingService.isTokenContract(testSellTransaction.to);
    console.log(`   Token contract: ${isTokenContract}`);
    console.log('');

    // Test 3: Parse transaction data
    console.log('🔍 Test 3: Parsing transaction data...');
    const tradeInfo = await CopyTradingService.parseTransactionData(testSellTransaction);
    if (tradeInfo) {
      console.log('   ✅ Transaction parsed successfully!');
      console.log(`   Type: ${tradeInfo.type}`);
      console.log(`   Token: ${tradeInfo.tokenAddress}`);
      console.log(`   BNB Amount: ${tradeInfo.bnbAmount}`);
      console.log(`   Token Amount: ${tradeInfo.tokenAmount}`);
    } else {
      console.log('   ❌ Failed to parse transaction data');
      console.log('   🔄 Trying internal transaction analysis...');
      
      // Test 4: Try internal transaction analysis
      const internalTradeInfo = await CopyTradingService.analyzeInternalTransactions(testSellTransaction);
      if (internalTradeInfo) {
        console.log('   ✅ Internal transaction analysis successful!');
        console.log(`   Type: ${internalTradeInfo.type}`);
        console.log(`   Token: ${internalTradeInfo.tokenAddress}`);
        console.log(`   BNB Amount: ${internalTradeInfo.bnbAmount}`);
        console.log(`   Token Amount: ${internalTradeInfo.tokenAmount}`);
      } else {
        console.log('   ❌ Internal transaction analysis also failed');
      }
    }
    console.log('');

    // Test 5: Test the complete analysis flow
    console.log('🔍 Test 5: Testing complete analysis flow...');
    const config = {
      targetWallet: '0x56d5f3491C100b00b9823fa427D8B92cd6A6FcaE',
      enabled: true,
      copyRatio: 0.01,
      maxPositionSize: 0.0001,
      minPositionSize: 0.0001,
      delayMs: 0,
      allowedTokens: [],
      blockedTokens: []
    };
    
    // This would normally be called by the monitoring system
    console.log('   📊 This transaction should be detected and copied');
    console.log('   📊 Expected: SELL 3.89M ASTERMODE tokens');
    console.log('   📊 Expected copy: 1% of tokens (38,895 tokens)');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  console.log('\n✅ Test completed!');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSellTransactionParsing().catch(console.error);
}

export { testSellTransactionParsing };

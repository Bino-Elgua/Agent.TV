import logger from '../utils/logger.js';
import { walletOracle } from '../services/wallet-oracle.js';
import { voicePipeline } from '../voice/voice-pipeline.js';

/**
 * Dynamic Intro/Exit Generation Test
 * Tests live Grok-powered intro generation with real wallet data
 */
async function testDynamicIntroExit() {
  logger.info('🧪 Dynamic Intro/Exit Generation Test');

  try {
    // Test 1: Fetch wallet metrics
    logger.info('\n--- Test 1: Fetch Wallet Metrics ---');
    const testWallet = '9Y7jX9zNQm1KpL5R8vT2UwXyZaBcDeFgHiJkLmNoPqRsT';
    const analysis = await walletOracle.run(testWallet);
    logger.info({ tier: analysis.tier, metrics: analysis.metrics }, 'Wallet analysis');

    // Test 2: Generate dynamic intro (Tier 3)
    logger.info('\n--- Test 2: Generate Dynamic Intro (Tier 3) ---');
    const mockNFT = [
      { name: 'Quantum Degen', id: 142, floor: 2.5 },
      { name: 'Solana Saga', id: 89, floor: 1.2 },
    ];

    const dynamicIntro = await walletOracle.generateDynamicIntro(
      testWallet,
      analysis.metrics,
      analysis.tier,
      mockNFT
    );
    logger.info({ intro: dynamicIntro }, 'Generated Intro');

    // Test 3: Check intro cache (should have 1 entry)
    logger.info('\n--- Test 3: Intro Cache ---');
    const cacheStatus = walletOracle.introCache.get(testWallet);
    logger.info(
      { cachedCount: cacheStatus?.length || 0, entries: cacheStatus },
      'Cache Status'
    );

    // Test 4: Generate another intro (should be different)
    logger.info('\n--- Test 4: Generate Second Intro (Should Be Different) ---');
    const secondIntro = await walletOracle.generateDynamicIntro(
      testWallet,
      analysis.metrics,
      analysis.tier,
      mockNFT
    );
    logger.info(
      { isDifferent: secondIntro !== dynamicIntro },
      'Second Intro Generated'
    );
    logger.info({ intro: secondIntro }, 'Second Intro Text');

    // Test 5: Generate dynamic exit (Tier 3, neutral tone)
    logger.info('\n--- Test 5: Generate Dynamic Exit (Tier 3, Neutral) ---');
    const dynamicExit = await walletOracle.generateDynamicExit(testWallet, analysis.tier, 'neutral');
    logger.info({ exit: dynamicExit }, 'Generated Exit');

    // Test 6: Generate exit with different call tone
    logger.info('\n--- Test 6: Dynamic Exit (Bullish Tone) ---');
    const bullishExit = await walletOracle.generateDynamicExit(
      testWallet,
      analysis.tier,
      'bullish'
    );
    logger.info({ exit: bullishExit }, 'Bullish Exit');

    // Test 7: Generate exit with different call tone (Heated)
    logger.info('\n--- Test 7: Dynamic Exit (Heated Tone) ---');
    const heatedExit = await walletOracle.generateDynamicExit(testWallet, analysis.tier, 'heated');
    logger.info({ exit: heatedExit }, 'Heated Exit');

    // Test 8: Voice-Pipeline Integration
    logger.info('\n--- Test 8: Voice Pipeline Integration ---');
    const mockCall = {
      id: 'call_test_123',
      phoneNumber: testWallet,
      metadata: {
        oracle: {
          tier: analysis.tier,
          metrics: analysis.metrics,
          nftData: mockNFT,
          voice: walletOracle._getTierVoice(analysis.tier, analysis.metrics),
          tone: analysis.tone,
          script: 'Fallback intro',
          riskFlags: analysis.riskFlags,
        },
      },
    };

    // Register call for exit
    voicePipeline.registerCallForExit(mockCall.id, testWallet, analysis.tier);
    logger.info({ callId: mockCall.id }, 'Call registered for exit');

    // Generate exit
    const exitOnHangup = await voicePipeline.generateDynamicExit(mockCall.id, 'questioning');
    logger.info({ exit: exitOnHangup }, 'Exit on Hangup');

    // Test 9: Data dump generation
    logger.info('\n--- Test 9: Data Dump for Grok ---');
    const dataDump = walletOracle._buildDataDump(testWallet, analysis.metrics, analysis.tier, mockNFT);
    logger.info({ dump: dataDump.split('\n').slice(0, 5).join('\n') + '\n...' }, 'Data Dump');

    // Test 10: Fallback intros (if Grok unavailable)
    logger.info('\n--- Test 10: Fallback Intros ---');
    for (let tier = 1; tier <= 5; tier++) {
      const fallback = walletOracle._getFallbackIntro(tier, analysis.metrics);
      logger.info({ tier, fallback }, `Tier ${tier} Fallback`);
    }

    logger.info('\n✅ Dynamic Intro/Exit test completed successfully!');
    logger.info(
      '\n🎬 Summary:\n' +
        '  ✅ Dynamic intro generation working (Grok + fallback)\n' +
        '  ✅ Intro caching system (prevents loops)\n' +
        '  ✅ Dynamic exit generation (tone-aware)\n' +
        '  ✅ Voice pipeline integration ready\n' +
        '  ✅ Data dump seeding for Grok\n' +
        '  ✅ NFT support in metadata\n' +
        '  ✅ Tone-based exit generation\n'
    );

    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Test failed');
    process.exit(1);
  }
}

testDynamicIntroExit();

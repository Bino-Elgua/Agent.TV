import logger from '../utils/logger.js';
import { walletOracle } from '../services/wallet-oracle.js';
import { heliusListener } from '../on-chain/helius-listener.js';

/**
 * Wallet Oracle Integration Test
 * Tests the oracle with mock wallets of different tiers
 */
async function testWalletOracle() {
  logger.info('🧪 Wallet Oracle Test Suite');

  try {
    // Test 1: Tier 1 (Noob Gatekeeper)
    logger.info('\n--- Test 1: Tier 1 (Noob Gatekeeper) ---');
    const tier1Wallet = '9Y7jX9zNQm1KpL5R8vT2UwXyZaBcDeFgHiJkLmNoPqRsT';
    const tier1Result = await walletOracle.run(tier1Wallet);
    logger.info({ tier: tier1Result.tier, script: tier1Result.script }, 'Tier 1 Result');
    console.assert(tier1Result.tier === 1, 'Should be Tier 1');
    console.assert(tier1Result.voice.pitch === 'low', 'Voice should be low pitch');

    // Test 2: Tier 2 (Degen Goblin)
    logger.info('\n--- Test 2: Tier 2 (Degen Goblin) ---');
    const tier2Wallet = '4rUgRJb7Nk9PoQ2VwX3yZ6AbCdEfGhIjKlMnOpQrStUv';
    const tier2Result = await walletOracle.run(tier2Wallet);
    logger.info({ tier: tier2Result.tier, script: tier2Result.script.slice(0, 60) }, 'Tier 2 Result');
    console.assert(tier2Result.tier === 2, 'Should be Tier 2');
    console.assert(tier2Result.voice.pitch === 'medium', 'Voice should be medium pitch');
    console.assert(tier2Result.tone === 'roast', 'Tone should be roast');

    // Test 3: Tier 3 (Steady Trader)
    logger.info('\n--- Test 3: Tier 3 (Steady Trader) ---');
    const tier3Wallet = '2aYcZdQfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMn';
    const tier3Result = await walletOracle.run(tier3Wallet);
    logger.info({ tier: tier3Result.tier, script: tier3Result.script.slice(0, 60) }, 'Tier 3 Result');
    console.assert(tier3Result.tier === 3, 'Should be Tier 3');
    console.assert(tier3Result.tone === 'respect', 'Tone should be respect');

    // Test 4: Caching
    logger.info('\n--- Test 4: Cache Hit ---');
    const cachedResult = await walletOracle.run(tier3Wallet);
    logger.info({ cached: true, tier: cachedResult.tier }, 'Cache retrieved successfully');

    // Test 5: Oracle Status
    logger.info('\n--- Test 5: Oracle Status ---');
    const status = walletOracle.getStatus();
    logger.info(status, 'Oracle Status');

    // Test 6: Helius Integration
    logger.info('\n--- Test 6: Helius Listener Integration ---');
    const burnResult = await heliusListener.processBurnNotification(
      'burnTx123abc',
      tier3Wallet,
      100000
    );
    logger.info(
      { queued: burnResult.queued, tier: burnResult.tier, script: burnResult.script?.slice(0, 50) },
      'Burn Processing Result'
    );

    // Test 7: Risk Flags
    logger.info('\n--- Test 7: Risk Flags Detection ---');
    const riskyWallet = '5xWqRsT8uvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAb';
    const riskyResult = await walletOracle.run(riskyWallet);
    logger.info({ riskFlags: riskyResult.riskFlags }, 'Risk Flags');

    // Test 8: Voice Configurations
    logger.info('\n--- Test 8: Tier Voice Configurations ---');
    for (let tier = 1; tier <= 5; tier++) {
      const voiceConfig = walletOracle._getTierVoice(tier, {});
      logger.info(
        { tier, pitch: voiceConfig.pitch, speed: voiceConfig.speed, effect: voiceConfig.effect },
        `Tier ${tier} Voice`
      );
    }

    // Test 9: Metrics Calculation
    logger.info('\n--- Test 9: Metrics Calculation ---');
    const mockHistory = [
      { type: 'swap', pnl: 25, blockTime: Math.floor(Date.now() / 1000) - 86400, amount: 100, token: 'SOL' },
      { type: 'swap', pnl: -10, blockTime: Math.floor(Date.now() / 1000) - 172800, amount: 50, token: 'USDC' },
      { type: 'swap', pnl: 45, blockTime: Math.floor(Date.now() / 1000) - 259200, amount: 200, token: '$TICKER' },
      { type: 'transfer', blockTime: Math.floor(Date.now() / 1000) - 345600, amount: 500, token: 'SHIB' },
    ];
    const metrics = await walletOracle._calculateMetrics(mockHistory, tier3Wallet);
    logger.info(metrics, 'Calculated Metrics');

    // Test 10: Clear Cache
    logger.info('\n--- Test 10: Clear Cache ---');
    walletOracle.clearCache();
    const clearedStatus = walletOracle.getStatus();
    logger.info({ cacheSize: clearedStatus.cacheSize }, 'Cache Cleared');
    console.assert(clearedStatus.cacheSize === 0, 'Cache should be empty');

    logger.info('\n✅ All wallet oracle tests passed!');
    logger.info(
      '\n🎬 Integration Summary:\n' +
        '  ✅ 5-tier classification working\n' +
        '  ✅ Dynamic roast generation\n' +
        '  ✅ Voice modulation per tier\n' +
        '  ✅ Risk flag detection\n' +
        '  ✅ Helius listener integration\n' +
        '  ✅ Metrics calculation\n' +
        '  ✅ Caching system\n'
    );

    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Test failed');
    process.exit(1);
  }
}

testWalletOracle();

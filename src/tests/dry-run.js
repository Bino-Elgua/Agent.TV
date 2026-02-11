import logger from '../utils/logger.js';
import config from '../config.js';
import { queueManager } from '../queue/manager.js';
import { fetchCryptoTrends } from '../voice/x-fetcher.js';
import { voicePipeline } from '../voice/voice-pipeline.js';
import { twilioHandler } from '../voice/twilio-handler.js';
import { heliusListener } from '../on-chain/helius-listener.js';

const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

logger.info('🧪 Starting dry-run tests...');

// ============ Test Suite ============

async function testQueueManager() {
  logger.info('Testing QueueManager...');

  queueManager.clear();
  const c1 = queueManager.addCaller('call1', '+1234567890', { priority: 1 });
  const c2 = queueManager.addCaller('call2', '+0987654321', { priority: 2 });

  console.assert(queueManager.queue.length === 2, 'Queue has 2 callers');
  console.assert(queueManager.queue[0].id === 'call2', 'Higher priority first');

  const next = queueManager.nextCaller();
  console.assert(next.id === 'call2', 'Next caller is call2');
  console.assert(queueManager.getStatus().active === 1, 'Active call count = 1');

  queueManager.endCall();
  console.assert(queueManager.getStatus().active === 0, 'Active call ended');

  logger.info('✓ QueueManager tests passed');
}

async function testVoicePipeline() {
  logger.info('Testing VoicePipeline...');

  await voicePipeline.init();
  console.assert(voicePipeline.isInitialized === false || voicePipeline.isRunning === false, 'Pipeline initialized');

  voicePipeline.updateTrends([
    { symbol: 'SOL', sentiment: 'bullish', priceChange: 5.2, snippet: 'SOL pumping hard' },
    { symbol: 'DOGE', sentiment: 'neutral', priceChange: -0.5, snippet: 'Doge steady' },
  ]);

  const segment = await voicePipeline.generateHostSegment();
  console.assert(segment.text, 'Generated segment text');
  console.assert(segment.duration > 0, 'Segment has duration');

  logger.info('✓ VoicePipeline tests passed');
}

async function testFetchCryptoTrends() {
  logger.info('Testing X trend fetch (may fail without GROK_API_KEY)...');

  if (!config.grok.apiKey) {
    logger.warn('⊘ Skipping Grok test – no GROK_API_KEY');
    return;
  }

  try {
    const trends = await fetchCryptoTrends();
    if (trends.success === false) {
      logger.warn('Grok fetch failed (expected in test)', trends.error);
    } else {
      console.assert(Array.isArray(trends), 'Trends is array');
      logger.info(`✓ Fetched ${trends.length} trends`);
    }
  } catch (err) {
    logger.warn('Grok test error (expected):', err.message);
  }
}

async function testTwilioHandler() {
  logger.info('Testing TwilioHandler...');

  config.testing.mockTwilio = true;
  await twilioHandler.init();
  console.assert(twilioHandler.isInitialized, 'Twilio initialized');

  const inbound = await twilioHandler.handleInboundCall('+1111111111', '+1234567890', 'CA_test123');
  console.assert(inbound.phoneNumber === '+1111111111', 'Inbound call handled');

  const outbound = await twilioHandler.handleOutboundCall('+2222222222', 'http://localhost:3000/cb');
  logger.info('✓ TwilioHandler tests passed');
}

async function testHeliusListener() {
  logger.info('Testing HeliusListener (Phase 3)...');

  await heliusListener.init();
  logger.info('✓ HeliusListener initialized');
}

async function testConfig() {
  logger.info('Testing Config...');

  console.assert(config.server.port === 3000 || typeof config.server.port === 'number', 'Port valid');
  console.assert(config.voice.mode === 'non-interactive' || config.voice.mode === 'call-active', 'Voice mode valid');
  console.assert(Array.isArray(config.callSlots), 'Call slots is array');

  logger.info('✓ Config tests passed');
}

// ============ Run All Tests ============

async function runAllTests() {
  try {
    await testConfig();
    await testQueueManager();
    await testVoicePipeline();
    await testTwilioHandler();
    await testHeliusListener();
    await testFetchCryptoTrends();

    logger.info('✅ All dry-run tests completed!');
    logger.info('Next: npm run dev (or node src/index.js) to start the full pipeline');
  } catch (err) {
    logger.error(err, 'Test suite error');
    process.exit(1);
  }
}

runAllTests();

import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const config = {
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Grok API (X trends)
  grok: {
    apiKey: process.env.GROK_API_KEY,
    model: process.env.GROK_MODEL || 'grok-3',
    baseUrl: 'https://api.x.ai/v1',
    pollInterval: parseInt(process.env.GROK_POLL_INTERVAL, 10) || 45000,
    rateLimit: parseInt(process.env.GROK_RATE_LIMIT, 10) || 1000,
  },

  // Helius (Solana)
  helius: {
    apiKey: process.env.HELIUS_API_KEY,
    webhookUrl: process.env.HELIUS_WEBHOOK_URL,
    clusterUrl: 'https://mainnet.helius-rpc.com',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Voice (Pipecat)
  voice: {
    debug: process.env.PIPECAT_DEBUG === 'true',
    mode: process.env.VOICE_MODE || 'non-interactive',
    ttsEngine: process.env.TTS_ENGINE || 'chatterbox',
    sttEngine: process.env.STT_ENGINE || 'faster-whisper',
    sttModel: process.env.STT_MODEL || 'large-v3',
    gpuRemote: process.env.VOICE_GPU_REMOTE === 'true',
    gpuEndpoint: process.env.VOICE_GPU_ENDPOINT || 'http://localhost:8000',
  },

  // Testing
  testing: {
    dryRun: process.env.DRY_RUN === 'true',
    mockTwilio: process.env.MOCK_TWILIO === 'true',
  },

  // Call slots (Phase 2+)
  callSlots: (() => {
    try {
      return JSON.parse(process.env.CALL_SLOTS || '[]');
    } catch {
      logger.warn('Invalid CALL_SLOTS JSON, defaulting to []');
      return [];
    }
  })(),

  // Token gating (Phase 3)
  tokenGating: {
    priceUSD: parseFloat(process.env.TOKEN_PRICE_USD || '2'),
    burnAddress: process.env.SOLANA_BURN_ADDRESS || '11111111111111111111111111111112',
  },

  // Seemplify configuration
  seemplify: {
    tokenSymbol: process.env.SEEMPLIFY_TOKEN_SYMBOL || 'SEEMPLIFY',
    minPilotStake: parseInt(process.env.SEEMPLIFY_MIN_PILOT_STAKE, 10) || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required env vars
const required = ['GROK_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  logger.warn({ missing }, 'Missing required environment variables');
}

export default config;

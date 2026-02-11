import logger from '../utils/logger.js';
import config from '../config.js';
import { buildDynamicPrompt } from '../services/host-system.js';
import { walletOracle } from '../services/wallet-oracle.js';
import queueManager from '../queue/manager.js';

export class VoicePipeline {
  constructor() {
    this.isRunning = false;
    this.isLocalMode = !config.voice.gpuRemote;
    this.currentTrends = [];
    this.messageBuffer = [];
    this.oracle = walletOracle;
  }

  async init() {
    logger.info({ mode: config.voice.mode, gpu: config.voice.gpuEndpoint }, 'Initializing voice pipeline');

    if (this.isLocalMode) {
      logger.warn('Running in LOCAL mode – Pipecat voice disabled. Use remote GPU for full functionality.');
      logger.info(`To enable: set VOICE_GPU_REMOTE=true and point VOICE_GPU_ENDPOINT to RunPod/vLLM instance`);
    } else {
      logger.info(`Connecting to GPU at ${config.voice.gpuEndpoint}`);
      // Phase 2: Actual Pipecat init would go here
      // const pipeline = create_pipeline(...)
    }

    this.attachQueueListeners();
    return true;
  }

  attachQueueListeners() {
    queueManager.on('caller-added', caller => {
      logger.info({ caller }, 'Queue event: caller added, may interrupt current segment');
      this.interruptIfNeeded();
    });

    queueManager.on('call-active', call => {
      logger.info({ call }, 'Queue event: call active, prioritize caller voice');
      // **NEW: Apply oracle analysis to active call**
      this.handleActiveCallWithOracle(call);
    });
  }

  /**
   * UPGRADED: Handle call entry with dynamic oracle intro
   * - Generate fresh 15-sec intro via Grok (no canned scripts)
   * - Switch TTS voice per tier
   * - Register call for dynamic exit on hangup
   */
  async handleActiveCallWithOracle(call) {
    if (call.metadata?.oracle) {
      const oracle = call.metadata.oracle;
      const walletAddress = call.phoneNumber; // Caller's wallet
      const tier = oracle.tier;

      logger.info(
        { tier, wallet: walletAddress, callId: call.id },
        'Call entry: generating dynamic oracle intro'
      );

      // Switch TTS voice based on tier
      this.switchTTSVoice(oracle.voice);

      try {
        // UPGRADED: Generate dynamic intro via Grok
        const dynamicIntro = await this.oracle.generateDynamicIntro(
          walletAddress,
          oracle.metrics,
          tier,
          oracle.nftData // Optional NFT holdings
        );

        // Queue oracle intro (15 seconds)
        this.queueSegment({
          type: 'oracle-intro',
          text: dynamicIntro,
          tone: oracle.tone,
          duration: 15000, // 15 sec for intro
          callId: call.id,
        });

        // Register call for dynamic exit
        this.registerCallForExit(call.id, walletAddress, tier);

        // Warn on risk flags
        if (oracle.riskFlags && oracle.riskFlags.length > 0) {
          logger.warn({ flags: oracle.riskFlags, wallet: walletAddress }, 'Risk flags detected');
        }
      } catch (err) {
        logger.error({ error: err.message, wallet: walletAddress }, 'Failed to generate dynamic intro');
        // Fall back to static intro
        this.queueSegment({
          type: 'oracle-intro',
          text: oracle.script || 'Welcome to the oracle.',
          tone: oracle.tone,
          duration: 5000,
          callId: call.id,
        });
      }
    } else {
      this.handleActiveCall(call);
    }
  }

  /**
   * Register call for dynamic exit on hangup
   */
  registerCallForExit(callId, walletAddress, tier) {
    if (!this.activeCalls) {
      this.activeCalls = new Map();
    }
    this.activeCalls.set(callId, {
      walletAddress,
      tier,
      startTime: Date.now(),
      callTone: 'neutral', // Will be updated by host input
    });
    logger.debug({ callId, wallet: walletAddress }, 'Call registered for dynamic exit');
  }

  /**
   * Generate dynamic exit on call end (5 seconds, threaten/bless/challenge)
   */
  async generateDynamicExit(callId, callTone = 'neutral') {
    if (!this.activeCalls || !this.activeCalls.has(callId)) {
      logger.warn({ callId }, 'Call not registered for exit');
      return null;
    }

    const callData = this.activeCalls.get(callId);
    logger.info({ callId, tier: callData.tier }, 'Generating dynamic exit');

    try {
      const dynamicExit = await this.oracle.generateDynamicExit(
        callData.walletAddress,
        callData.tier,
        callTone
      );

      // Clean up
      this.activeCalls.delete(callId);

      return dynamicExit;
    } catch (err) {
      logger.error({ error: err.message, callId }, 'Failed to generate dynamic exit');
      return 'Until the next call.';
    }
  }

  switchTTSVoice(voiceConfig) {
    if (this.isLocalMode) {
      logger.debug({ voice: voiceConfig.description }, 'TTS voice would switch (local mode)');
      return;
    }

    // Real: Call TTS service to change voice characteristics
    logger.debug({ pitch: voiceConfig.pitch, speed: voiceConfig.speed }, 'Switching TTS voice');
  }

  queueSegment(segment) {
    this.messageBuffer.push(segment);
    logger.debug({ type: segment.type, text: segment.text.slice(0, 50) }, 'Segment queued');
  }

  updateTrends(trends) {
    this.currentTrends = trends || [];
    logger.debug({ count: trends?.length || 0 }, 'Trends updated');
  }

  buildSystemPrompt() {
    const callerCount = queueManager.queue.length;
    return buildDynamicPrompt(this.currentTrends, callerCount);
  }

  async generateHostSegment() {
    const prompt = this.buildSystemPrompt();
    
    if (this.isLocalMode) {
      // Stub: return placeholder
      logger.debug('Generating host segment (LOCAL MODE – use GPU endpoint for real TTS)');
      return {
        text: `[Local mode] Fetched ${this.currentTrends.length} trends. Top: ${this.currentTrends[0]?.symbol || 'N/A'}`,
        duration: 10000,
      };
    }

    // Phase 2: Call LLM inference
    // const response = await post(`${config.voice.gpuEndpoint}/generate`, { prompt, max_tokens: 256 })
    // const text = response.data.text

    // Phase 2: TTS
    // const audio = await tts(text)

    return { text: 'placeholder', duration: 5000 };
  }

  async playSegment(segment) {
    if (this.isLocalMode) {
      logger.info({ text: segment.text }, 'Would play: (LOCAL mode, no audio output)');
      return;
    }

    logger.info(`Playing ${segment.duration}ms audio segment`);
    // Actual Pipecat playback
  }

  interruptIfNeeded() {
    if (config.voice.mode !== 'call-active') return;
    logger.info('Interrupt: caller waiting, end current segment');
  }

  async handleActiveCall(call) {
    logger.info(`Call active: ${call.phoneNumber}`);
    // Phase 2: route to Twilio handler, manage STT/TTS for caller
  }

  async run() {
    if (this.isRunning) {
      logger.warn('Pipeline already running');
      return;
    }

    this.isRunning = true;
    logger.info('Voice pipeline loop starting...');

    const loopInterval = 30000; // 30s per segment
    let iteration = 0;

    const loop = async () => {
      if (!this.isRunning) return;

      try {
        iteration++;
        logger.debug({ iteration }, 'Pipeline iteration');

        const segment = await this.generateHostSegment();
        await this.playSegment(segment);

        setTimeout(loop, loopInterval);
      } catch (err) {
        logger.error({ error: err.message }, 'Pipeline error');
        setTimeout(loop, loopInterval);
      }
    };

    loop();
  }

  stop() {
    this.isRunning = false;
    logger.info('Voice pipeline stopped');
  }
}

export const voicePipeline = new VoicePipeline();
export default voicePipeline;

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
   * NEW: Handle call entry with wallet oracle analysis
   * If caller has oracle metadata (from burn), use it to customize intro
   */
  async handleActiveCallWithOracle(call) {
    if (call.metadata?.oracle) {
      const oracle = call.metadata.oracle;
      logger.info(
        { tier: oracle.tier, wallet: call.phoneNumber, tone: oracle.tone },
        'Applying oracle roast to call'
      );

      // Switch TTS voice based on tier
      this.switchTTSVoice(oracle.voice);

      // Queue oracle intro script
      this.queueSegment({
        type: 'oracle-intro',
        text: oracle.script,
        tone: oracle.tone,
        duration: 5000,
      });

      // Add risk flags if any
      if (oracle.riskFlags && oracle.riskFlags.length > 0) {
        logger.warn({ flags: oracle.riskFlags }, 'Risk flags detected in caller wallet');
      }
    } else {
      this.handleActiveCall(call);
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

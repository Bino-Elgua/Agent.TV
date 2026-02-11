import logger from '../utils/logger.js';
import config from '../config.js';
import queueManager from '../queue/manager.js';

export class TwilioHandler {
  constructor() {
    this.activeCalls = new Map();
    this.isInitialized = false;
  }

  async init() {
    if (config.testing.mockTwilio) {
      logger.warn('MOCK_TWILIO enabled – no real Twilio calls');
      this.isInitialized = true;
      return;
    }

    // Phase 2+: Initialize Twilio client
    // import twilio from 'twilio'
    // this.client = twilio(config.twilio.accountSid, config.twilio.authToken)

    logger.info('Twilio handler initialized');
    this.isInitialized = true;
  }

  async handleInboundCall(fromNumber, toNumber, callSid) {
    logger.info({ from: fromNumber, callSid }, 'Inbound call');

    // Add to queue
    const caller = queueManager.addCaller(callSid, fromNumber, {
      direction: 'inbound',
      priority: 1,
    });

    // Phase 2: TwiML response for call-in prompt
    // "Thanks for calling CryptoCall FM! You're in the queue. Describe your position."
    // This would be sent as TwiML in a webhook response

    return caller;
  }

  async handleOutboundCall(toNumber, callbackUrl) {
    logger.info({ to: toNumber }, 'Making outbound call');

    if (config.testing.mockTwilio) {
      logger.warn(`[MOCK] Would call ${toNumber}`);
      return { mockCallSid: 'CA_mock_' + Date.now() };
    }

    // Phase 2+: Real outbound
    // const call = await this.client.calls.create({
    //   from: config.twilio.phoneNumber,
    //   to: toNumber,
    //   url: callbackUrl,
    // })
    // return call;

    return null;
  }

  async recordCall(callSid, recordingUrl) {
    logger.info({ callSid, recordingUrl }, 'Call recorded');
    // Phase 2: Store recording metadata
  }

  async disconnectCall(callSid) {
    logger.info({ callSid }, 'Disconnecting call');

    queueManager.endCall();

    if (config.testing.mockTwilio) {
      logger.warn(`[MOCK] Would hang up ${callSid}`);
      return;
    }

    // Real hangup
  }

  getWebhookRouter(express) {
    const router = express.Router();

    // Inbound call webhook
    router.post('/voice-webhook', async (req, res) => {
      const { From, To, CallSid } = req.body;
      logger.debug({ From, To, CallSid }, 'Voice webhook');

      try {
        await this.handleInboundCall(From, To, CallSid);

        // Phase 2: TwiML response
        const twiml = `
          <Response>
            <Say>Thanks for calling CryptoCall FM! You are in the queue. Please describe your position or prediction.</Say>
            <Record maxLength="120" action="/twilio/recording-complete" />
          </Response>
        `;

        res.type('text/xml');
        res.send(twiml);
      } catch (err) {
        logger.error({ error: err.message }, 'Webhook error');
        res.status(500).send('Error');
      }
    });

    // Recording completion webhook
    router.post('/recording-complete', (req, res) => {
      const { CallSid, RecordingUrl } = req.body;
      logger.debug({ CallSid, RecordingUrl }, 'Recording complete');

      this.recordCall(CallSid, RecordingUrl);

      res.status(200).send('OK');
    });

    // Status callback
    router.post('/call-status', (req, res) => {
      const { CallSid, CallStatus } = req.body;
      logger.debug({ CallSid, CallStatus }, 'Call status update');

      if (CallStatus === 'completed') {
        this.disconnectCall(CallSid);
      }

      res.status(200).send('OK');
    });

    return router;
  }
}

export const twilioHandler = new TwilioHandler();
export default twilioHandler;

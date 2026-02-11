import logger from '../utils/logger.js';
import config from '../config.js';
import queueManager from '../queue/manager.js';
import { walletOracle } from '../services/wallet-oracle.js';
import { withRetry } from '../utils/error-handler.js';

export class HeliusListener {
  constructor() {
    this.isInitialized = false;
    this.webhookSecret = null;
    this.oracle = walletOracle;
  }

  async init() {
    logger.info('Initializing Helius listener (Phase 3)');

    if (!config.helius.apiKey) {
      logger.warn('HELIUS_API_KEY not set, Helius features disabled');
      return;
    }

    // Phase 3: Register webhook with Helius
    // const response = await post(`https://api.helius.xyz/v0/webhook`, {
    //   webhook_url: config.helius.webhookUrl,
    //   api_key: config.helius.apiKey,
    //   transaction_types: ['BURN'],
    // })

    logger.info('Helius webhook registered (Phase 3 placeholder)');
    this.isInitialized = true;
  }

  async validateBurnTransaction(txSignature) {
    const validate = async () => {
      logger.debug({ txSig: txSignature }, 'Validating burn tx');

      // Phase 3: Query Solana RPC for tx details
      // const tx = await solanaConnection.getTransaction(txSignature)
      // const mint = extract_token_mint(tx)
      // const amount = extract_burn_amount(tx)

      return {
        valid: true,
        mint: 'PUMP_PLACEHOLDER',
        amount: 1000000,
        burnerAddress: '...',
      };
    };

    return withRetry(validate, 'validate-burn-tx');
  }

  async processBurnNotification(txSignature, burnerAddress, burnAmount) {
    logger.info(
      { txSig: txSignature, burner: burnerAddress, amount: burnAmount },
      'Processing burn notification'
    );

    // Phase 3: Calculate tokens for $2 USD equivalent
    const tokenPrice = 0.05; // Placeholder
    const tokensFor2Usd = Math.ceil(2 / tokenPrice);

    if (burnAmount >= tokensFor2Usd) {
      logger.info({ burner: burnerAddress }, 'Burn meets gating requirement, analyzing wallet...');

      // **NEW: Resurrect wallet persona via oracle**
      const oracleAnalysis = await this.oracle.run(burnerAddress);
      logger.info(
        { burner: burnerAddress, tier: oracleAnalysis.tier, script: oracleAnalysis.script.slice(0, 50) },
        'Oracle resurrection complete'
      );

      // Add burner to priority queue with oracle metadata
      queueManager.addCaller(`burn_${txSignature.slice(0, 8)}`, burnerAddress, {
        priority: 10 + oracleAnalysis.tier, // Higher tier = higher priority
        metadata: {
          burnAmount,
          tokenPrice,
          txSignature,
          oracle: {
            tier: oracleAnalysis.tier,
            script: oracleAnalysis.script,
            tone: oracleAnalysis.tone,
            voice: oracleAnalysis.voice,
            riskFlags: oracleAnalysis.riskFlags,
            metrics: oracleAnalysis.metrics,
          },
        },
      });

      return {
        queued: true,
        position: queueManager.queue.length,
        tier: oracleAnalysis.tier,
        script: oracleAnalysis.script,
      };
    }

    logger.warn({ amount: burnAmount, required: tokensFor2Usd }, 'Burn insufficient');
    return { queued: false };
  }

  async getWebhookHandler() {
    return async (req, res) => {
      const { signature, lamports, mint, source } = req.body;
      logger.debug({ signature, source }, 'Helius webhook received');

      try {
        // Validate burn
        const validation = await this.validateBurnTransaction(signature);
        if (!validation.valid) {
          return res.status(400).json({ error: 'Invalid burn' });
        }

        // Process
        const result = await this.processBurnNotification(signature, source, validation.amount);

        res.json(result);
      } catch (err) {
        logger.error({ error: err.message }, 'Helius webhook error');
        res.status(500).json({ error: err.message });
      }
    };
  }

  async pollBurns() {
    // Phase 3: Fallback poller if webhook unavailable
    logger.debug('Polling Solana for recent burns (fallback)');

    const polls = async () => {
      // Query recent tx for burns to SOLANA_BURN_ADDRESS
      // const txs = await solanaConnection.getSignaturesForAddress(
      //   new PublicKey(config.tokenGating.burnAddress),
      //   { limit: 10 }
      // )
    };

    // Run every 5 min
    setInterval(() => polls().catch(err => logger.error(err, 'Burn poll error')), 5 * 60 * 1000);
  }
}

export const heliusListener = new HeliusListener();
export default heliusListener;

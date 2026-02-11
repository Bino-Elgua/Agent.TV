import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * WalletOracle – On-chain wallet analysis engine
 * Analyzes 30-day trading history, assigns Tier 1-5, generates roasts
 * Integrates with Helius RPC, Grok API, QuickNode
 */
export class WalletOracle {
  constructor(config = {}) {
    this.heliusKey = config.heliusKey || process.env.HELIUS_API_KEY;
    this.grokKey = config.grokKey || process.env.GROK_API_KEY;
    this.quicknodeKey = config.quicknodeKey || process.env.QUICKNODE_API_KEY;
    this.lookbackDays = config.lookbackDays || parseInt(process.env.WALLET_LOOKBACK_DAYS || '30');
    this.roastLevel = config.roastLevel || (process.env.ROAST_LEVEL || 'fire');
    this.cache = new Map(); // wallet -> analysis
  }

  /**
   * Main entry: analyze wallet → return {tier, script, tone, voice, risk}
   */
  async run(walletAddress) {
    logger.info({ wallet: walletAddress }, 'Oracle analyzing wallet');

    // Check cache first
    if (this.cache.has(walletAddress)) {
      const cached = this.cache.get(walletAddress);
      if (Date.now() - cached.timestamp < 3600000) {
        // Cache valid for 1 hour
        logger.debug({ wallet: walletAddress }, 'Oracle cache hit');
        return cached.data;
      }
    }

    try {
      // Fetch wallet history
      const history = await this._fetchWalletHistory(walletAddress);
      if (!history) {
        return this._getTier1Response(walletAddress);
      }

      // Calculate metrics
      const metrics = await this._calculateMetrics(history, walletAddress);

      // Assign tier
      const tier = this._assignTier(metrics);

      // Generate script + tone
      const roast = await this._generateRoast(walletAddress, metrics, tier);

      // Determine voice characteristics
      const voice = this._getTierVoice(tier, metrics);

      // Compile response
      const response = {
        wallet: walletAddress,
        tier,
        metrics,
        script: roast.script,
        tone: roast.tone,
        voice,
        riskFlags: this._getRiskFlags(metrics),
        timestamp: new Date().toISOString(),
      };

      // Cache result
      this.cache.set(walletAddress, { data: response, timestamp: Date.now() });

      logger.info({ wallet: walletAddress, tier, script: roast.script.slice(0, 50) }, 'Oracle ready');
      return response;
    } catch (err) {
      logger.error({ wallet: walletAddress, error: err.message }, 'Oracle error, falling back to Tier 1');
      return this._getTier1Response(walletAddress);
    }
  }

  async _fetchWalletHistory(walletAddress) {
    // Try Helius first
    if (this.heliusKey) {
      try {
        return await this._fetchHeliusHistory(walletAddress);
      } catch (err) {
        logger.warn({ error: err.message }, 'Helius fetch failed');
      }
    }

    // Try QuickNode
    if (this.quicknodeKey) {
      try {
        return await this._fetchQuickNodeHistory(walletAddress);
      } catch (err) {
        logger.warn({ error: err.message }, 'QuickNode fetch failed');
      }
    }

    // Return mock data
    return this._getMockHistory(walletAddress);
  }

  async _fetchHeliusHistory(walletAddress) {
    const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${this.heliusKey}`;
    const response = await axios.get(url, { timeout: 5000 });
    return response.data;
  }

  async _fetchQuickNodeHistory(walletAddress) {
    const url = `https://${this.quicknodeKey}.solana-mainnet.quiknode.pro/`;
    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [walletAddress, { limit: 100 }],
      },
      { timeout: 5000 }
    );
    return response.data.result || [];
  }

  _getMockHistory(walletAddress) {
    // Realistic mock wallet history for testing
    const seed = walletAddress.charCodeAt(0);
    const txCount = 20 + (seed % 80);

    const transactions = [];
    for (let i = 0; i < txCount; i++) {
      transactions.push({
        signature: `sig_${i}`,
        blockTime: Math.floor(Date.now() / 1000) - i * 86400,
        type: ['swap', 'transfer', 'burn'][i % 3],
        amount: (Math.random() * 10 + 0.1).toFixed(2),
        token: ['SOL', 'USDC', '$TICKER', 'SHIB', 'PEPE'][i % 5],
        pnl: (Math.random() * 100 - 50).toFixed(2),
      });
    }

    return transactions;
  }

  async _calculateMetrics(history, walletAddress) {
    if (!Array.isArray(history) || history.length === 0) {
      return {};
    }

    // Transaction count & volume
    const txCount = history.length;
    const totalVolume = history.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    // Win/loss ratio
    const trades = history.filter(tx => tx.type === 'swap' || tx.pnl !== undefined);
    const wins = trades.filter(tx => parseFloat(tx.pnl || 0) > 0).length;
    const losses = trades.filter(tx => parseFloat(tx.pnl || 0) < 0).length;
    const winRatio = losses === 0 ? 1 : wins / (wins + losses);

    // PnL metrics
    const totalPnL = trades.reduce((sum, tx) => sum + parseFloat(tx.pnl || 0), 0);
    const avgPnL = trades.length > 0 ? totalPnL / trades.length : 0;

    // Volatility & drawdown
    const pnls = trades.map(tx => parseFloat(tx.pnl || 0));
    const maxDrawdown = Math.min(...pnls, 0);
    const volatility = this._calculateStdDev(pnls);

    // Meme exposure
    const memeTokens = ['SHIB', 'DOGE', 'PEPE', 'BONK', 'WIF'];
    const memeExposure = history.filter(tx => memeTokens.includes(tx.token?.toUpperCase())).length / txCount;

    // Rug exposure (assume losses > 50% are rugs)
    const rugTrades = trades.filter(tx => parseFloat(tx.pnl || 0) < -50).length;
    const rugRatio = trades.length > 0 ? rugTrades / trades.length : 0;

    // Hot/cold streak (last 7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const recentTrades = trades.filter(tx => (tx.blockTime || 0) > sevenDaysAgo);
    const recentPnL = recentTrades.reduce((sum, tx) => sum + parseFloat(tx.pnl || 0), 0);

    // X sentiment (mock, would use Grok API)
    const xSentiment = await this._fetchXSentiment(walletAddress);

    // Whale status (mock check)
    const isWhale = totalVolume > 50000;

    // Days active
    const oldestTx = Math.min(...history.map(tx => tx.blockTime || Date.now() / 1000));
    const daysActive = Math.floor((Date.now() / 1000 - oldestTx) / 86400);

    return {
      txCount,
      totalVolume: totalVolume.toFixed(2),
      winRatio: (winRatio * 100).toFixed(1),
      totalPnL: totalPnL.toFixed(2),
      avgPnL: avgPnL.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      volatility: volatility.toFixed(2),
      memeExposure: (memeExposure * 100).toFixed(1),
      rugRatio: (rugRatio * 100).toFixed(1),
      recentPnL: recentPnL.toFixed(2),
      isHotStreak: recentPnL > 50,
      isColdStreak: recentPnL < -30,
      isWhale,
      daysActive,
      xSentiment,
    };
  }

  async _fetchXSentiment(walletAddress) {
    // Mock X sentiment, would call Grok API for real
    // Placeholder: return based on wallet address hash
    const seed = walletAddress.charCodeAt(0);
    const sentiments = ['bullish', 'neutral', 'bearish', 'viral', 'noisy'];
    return sentiments[seed % sentiments.length];
  }

  _calculateStdDev(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  _assignTier(metrics) {
    const {
      txCount = 0,
      totalVolume = 0,
      winRatio = 0,
      daysActive = 0,
      isWhale = false,
      xSentiment = 'neutral',
      rugRatio = 0,
    } = metrics;

    // Tier 5: Oracle — 30+ days, >100 txs, consistent PnL, X hype
    if (daysActive >= 30 && txCount > 100 && winRatio > 0.55 && xSentiment === 'viral') {
      return 5;
    }

    // Tier 4: Whale Whisperer — Top holder, high volume, influencers watch
    if (isWhale && totalVolume > 50000 && txCount > 50) {
      return 4;
    }

    // Tier 3: Steady Trader — Positive EV, low volatility
    if (winRatio > 0.55 && txCount > 20 && rugRatio < 0.2) {
      return 3;
    }

    // Tier 2: Degen Goblin — High meme %, rugs > wins
    if (rugRatio > 0.3 || winRatio < 0.4) {
      return 2;
    }

    // Tier 1: Noob Gatekeeper — < 10 txs, small volume, no patterns
    return 1;
  }

  async _generateRoast(walletAddress, metrics, tier) {
    const { isHotStreak, isColdStreak, winRatio, rugRatio, memeExposure } = metrics;

    let script = '';
    let tone = 'neutral';

    if (tier === 5) {
      script =
        `You don't trade — you *speak* to the chain. ${winRatio}% wins, ${rugRatio}% rugs. ` +
        `You're not an investor; you're a *prophecy*. ${isHotStreak ? "Hot streak. Don't flop." : 'Consistent. Intimidating.'}`;
      tone = 'ritual';
    } else if (tier === 4) {
      script =
        `Whale wallet. They're watching. You hold $${metrics.totalVolume}+ worth. ` +
        `${isHotStreak ? 'Show us you ain\'t luck.' : 'Cold streak? Even whales bleed.'} ` +
        `But you're here, and that matters.`;
      tone = 'awe';
    } else if (tier === 3) {
      script =
        `Clean book. ${winRatio}% wins, low rug exposure. You actually *trade* instead of chase memes. ` +
        `${isHotStreak ? 'Hot week. Keep it up.' : isColdStreak ? 'Rough week, but the numbers show discipline.' : 'Steady as she goes.'}`;
      tone = 'respect';
    } else if (tier === 2) {
      script =
        `Another rug chaser. ${memeExposure}% meme exposure, ${rugRatio}% rugs. How many times you gonna learn? ` +
        `${isHotStreak ? "But hey, today you're up." : 'But you showed up anyway. That is something.'} ` +
        `Let's see if you survive this one.`;
      tone = 'roast';
    } else {
      script =
        `${metrics.txCount < 3 ? 'First time?' : 'Mystery wallet. Let\'s'} write your origin story. ` +
        `Only ${metrics.txCount} moves on the board. Welcome. ${isHotStreak ? 'You\'re up today — nice.' : 'Let\'s build from here.'}`;
      tone = 'gentle';
    }

    return { script, tone };
  }

  _getTierVoice(tier, metrics) {
    const voiceMap = {
      1: { pitch: 'low', speed: 'slow', effect: 'gentle', description: 'Calm, welcoming' },
      2: { pitch: 'medium', speed: 'fast', effect: 'sharp', description: 'Brutal roast' },
      3: { pitch: 'medium', speed: 'medium', effect: 'clean', description: 'Respect' },
      4: { pitch: 'high', speed: 'medium', effect: 'awe', description: 'Awe + pressure' },
      5: { pitch: 'deep', speed: 'slow', effect: 'ritual', description: 'Deep, echoing ritual' },
    };
    return voiceMap[tier] || voiceMap[1];
  }

  _getRiskFlags(metrics) {
    const flags = [];

    if (metrics.rugRatio > 0.4) {
      flags.push('HIGH_RUG_EXPOSURE');
    }
    if (metrics.maxDrawdown < -70) {
      flags.push('SEVERE_DRAWDOWN');
    }
    if (metrics.volatility > 50) {
      flags.push('EXTREME_VOLATILITY');
    }
    if (metrics.memeExposure > 70) {
      flags.push('MEME_HEAVY');
    }
    if (metrics.isColdStreak) {
      flags.push('COLD_STREAK');
    }

    return flags;
  }

  _getTier1Response(walletAddress) {
    return {
      wallet: walletAddress,
      tier: 1,
      metrics: {},
      script: `Mystery wallet. Let's write your origin story. Welcome to the prophecy.`,
      tone: 'gentle',
      voice: { pitch: 'low', speed: 'slow', effect: 'gentle', description: 'Calm, welcoming' },
      riskFlags: [],
      timestamp: new Date().toISOString(),
    };
  }

  clearCache() {
    this.cache.clear();
  }

  getStatus() {
    return {
      cacheSize: this.cache.size,
      lookbackDays: this.lookbackDays,
      roastLevel: this.roastLevel,
      heliusConfigured: !!this.heliusKey,
      grokConfigured: !!this.grokKey,
      quicknodeConfigured: !!this.quicknodeKey,
    };
  }
}

export const walletOracle = new WalletOracle();
export default walletOracle;

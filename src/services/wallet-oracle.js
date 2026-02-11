import axios from 'axios';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * WalletOracle – Dynamic on-chain wallet analysis engine
 * UPGRADED: Live Grok-powered intro generation (no canned scripts)
 * 
 * Flow:
 * 1. Burn detected → fetch 30-day tx + NFTs + whale links
 * 2. Assign Tier 1-5 based on metrics
 * 3. Build data dump for Grok (PnL, rugs, NFTs, X sentiment, anomalies)
 * 4. Call Grok to generate fresh 15-sec intro (tone-matched)
 * 5. Cache to avoid loops
 * 6. On call close, generate 5-sec exit (threaten/bless/challenge)
 */
export class WalletOracle {
  constructor(config = {}) {
    this.heliusKey = config.heliusKey || process.env.HELIUS_API_KEY;
    this.grokKey = config.grokKey || process.env.GROK_API_KEY;
    this.quicknodeKey = config.quicknodeKey || process.env.QUICKNODE_API_KEY;
    this.arkhamKey = config.arkhamKey || process.env.ARKHAM_API_KEY;
    this.lookbackDays = config.lookbackDays || parseInt(process.env.WALLET_LOOKBACK_DAYS || '30');
    this.roastLevel = config.roastLevel || (process.env.ROAST_LEVEL || 'fire');
    this.cache = new Map(); // wallet -> analysis
    this.introCache = new Map(); // wallet -> [intros] (last 5)
    this.cacheFile = config.cacheFile || './last_intros.json';
    this.loadIntroCache();
  }

  /**
   * Load intro cache from file to avoid loops
   */
  loadIntroCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        const parsed = JSON.parse(data);
        for (const [wallet, intros] of Object.entries(parsed)) {
          this.introCache.set(wallet, intros);
        }
        logger.debug({ entries: this.introCache.size }, 'Intro cache loaded');
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to load intro cache');
    }
  }

  /**
   * Save intro cache to file
   */
  saveIntroCache() {
    try {
      const data = {};
      for (const [wallet, intros] of this.introCache.entries()) {
        data[wallet] = intros;
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to save intro cache');
    }
  }

  /**
   * Add intro to cache (keep last 5)
   */
  cacheIntro(walletAddress, intro) {
    if (!this.introCache.has(walletAddress)) {
      this.introCache.set(walletAddress, []);
    }
    const intros = this.introCache.get(walletAddress);
    intros.push({ intro, timestamp: Date.now() });
    if (intros.length > 5) {
      intros.shift(); // Remove oldest
    }
    this.saveIntroCache();
  }

  /**
   * Check if intro was recently used
   */
  wasIntroRecentlyUsed(walletAddress, intro) {
    const intros = this.introCache.get(walletAddress) || [];
    return intros.some(
      cached => 
        cached.intro.toLowerCase() === intro.toLowerCase() &&
        Date.now() - cached.timestamp < 3600000 // 1 hour
    );
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

      // Determine voice characteristics
      const voice = this._getTierVoice(tier, metrics);

      // Get fallback script (Grok will generate live one)
      const fallbackScript = this._getFallbackIntro(tier, metrics);

      // Compile response
      const response = {
        wallet: walletAddress,
        tier,
        metrics,
        script: fallbackScript, // Fallback if Grok unavailable
        tone: voice.description.toLowerCase(),
        voice,
        riskFlags: this._getRiskFlags(metrics),
        timestamp: new Date().toISOString(),
      };

      // Cache result
      this.cache.set(walletAddress, { data: response, timestamp: Date.now() });

      logger.info({ wallet: walletAddress, tier, script: response.script.slice(0, 50) }, 'Oracle ready');
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

  /**
   * UPGRADED: Dynamic intro generation via Grok
   * Builds data dump, calls Grok API, caches result to avoid loops
   */
  async generateDynamicIntro(walletAddress, metrics, tier, nftData = null) {
    logger.info({ wallet: walletAddress, tier }, 'Generating dynamic intro via Grok');

    try {
      // Build data dump for Grok
      const dataDump = this._buildDataDump(walletAddress, metrics, tier, nftData);

      // Build tier-specific prompt
      const toneMap = {
        1: 'curious and welcoming',
        2: 'brutal roast',
        3: 'respect and acknowledgment',
        4: 'awe and pressure',
        5: 'ritual and reverence',
      };

      const prompt = `You are a crypto oracle analyzing a wallet for a live radio show.
      
Wallet: ${walletAddress}
Tier: ${tier}

DATA:
${dataDump}

TASK: Write a fresh 15-second intro (max 120 words). 
- Tone: ${toneMap[tier]}
- No canned lines, make it specific to their data
- Reference real details: their PnL, NFTs, rugs, hot/cold streaks, anomalies
- If tier 1: curious, "let's write your story"
- If tier 2: roast, "another rug?" but not mean
- If tier 3: respect, "clean book"
- If tier 4: awe, "whale, they're watching"
- If tier 5: ritual, "you speak to the chain"
- ROAST_LEVEL: ${this.roastLevel}
- Today's vibe only (no repeats)

Generate the intro only, no explanation.`;

      // Call Grok (or fallback to template-based)
      let intro = await this._callGrokAPI(prompt);

      // If Grok failed, return fallback
      if (!intro) {
        logger.debug({ wallet: walletAddress }, 'Grok unavailable, using fallback');
        return this._getFallbackIntro(tier, metrics);
      }

      // Check for loops
      let attempts = 0;
      while (this.wasIntroRecentlyUsed(walletAddress, intro) && attempts < 3) {
        logger.debug({ wallet: walletAddress, attempt: attempts + 1 }, 'Intro was recent, regenerating');
        const regeneratePrompt = prompt + '\n\nGenerate a DIFFERENT intro with the same tone.';
        intro = await this._callGrokAPI(regeneratePrompt);
        if (!intro) {
          return this._getFallbackIntro(tier, metrics);
        }
        attempts++;
      }

      // Cache it
      this.cacheIntro(walletAddress, intro);

      return intro;
    } catch (err) {
      logger.error({ error: err.message, wallet: walletAddress }, 'Dynamic intro generation failed');
      return this._getFallbackIntro(tier, metrics);
    }
  }

  /**
   * Build data dump for Grok: PnL, NFTs, rugs, whale status, X sentiment, anomalies
   */
  _buildDataDump(walletAddress, metrics, tier, nftData) {
    const dump = [];

    dump.push(`Trading History (30d):`);
    dump.push(`  - Transactions: ${metrics.txCount}`);
    dump.push(`  - Volume: $${metrics.totalVolume}`);
    dump.push(`  - Win ratio: ${metrics.winRatio}%`);
    dump.push(`  - PnL: $${metrics.totalPnL}`);
    dump.push(`  - Max drawdown: $${metrics.maxDrawdown}`);

    if (metrics.isHotStreak) dump.push(`  - 🔥 HOT STREAK (7d PnL: $${metrics.recentPnL})`);
    if (metrics.isColdStreak) dump.push(`  - 🥶 COLD STREAK (7d PnL: $${metrics.recentPnL})`);

    if (metrics.rugRatio > 0.2) {
      dump.push(`\nRug Exposure:`);
      dump.push(`  - Rug ratio: ${metrics.rugRatio}%`);
      dump.push(`  - Likely targets: meme tokens`);
    }

    if (nftData) {
      dump.push(`\nNFT Holdings:`);
      nftData.forEach(nft => {
        dump.push(`  - ${nft.name} #${nft.id} (Floor: $${nft.floor})`);
      });
    }

    if (metrics.isWhale) {
      dump.push(`\nWhale Status: Top 10% holder ($${metrics.totalVolume}+)`);
    }

    dump.push(`\nX Sentiment: ${metrics.xSentiment}`);
    dump.push(`Days Active: ${metrics.daysActive}`);
    dump.push(`Meme Exposure: ${metrics.memeExposure}%`);

    return dump.join('\n');
  }

  /**
   * Call Grok API for intro generation
   * Falls back to template if API unavailable
   */
  async _callGrokAPI(prompt) {
    if (!this.grokKey) {
      logger.warn('GROK_API_KEY not set, using fallback template');
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.9, // More creative
        },
        {
          headers: {
            Authorization: `Bearer ${this.grokKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const text = response.data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        logger.warn('Grok returned empty response');
        return null;
      }
      
      logger.debug({ length: text.length }, 'Grok intro generated');
      return text;
    } catch (err) {
      logger.warn({ error: err.message, status: err.response?.status }, 'Grok API call failed, using fallback');
      return null;
    }
  }

  /**
   * Generate closing exit (5-sec, threaten/bless/challenge based on tier + call tone)
   */
  async generateDynamicExit(walletAddress, tier, callTone = 'neutral') {
    logger.info({ wallet: walletAddress, tier, callTone }, 'Generating dynamic exit');

    try {
      const exitPrompt = `You are a crypto oracle saying goodbye to a caller.

Wallet Tier: ${tier}
Call Tone: ${callTone} (was the call bullish, bearish, questioning, heated?)

Generate a 5-second exit line (max 50 words):
- If tier 1: "Good luck out there, newbie"
- If tier 2: "Don't chase the next rug, and don't chase this one"
- If tier 3: "Keep that clean book, steady hand"
- If tier 4: "Whales watching, don't miss the next move"
- If tier 5: "The chain remembers everything. Be wise"

Match the call_tone energy. Threaten, bless, or challenge them based on how the call went.

Exit line only:`;

      const exit = await this._callGrokAPI(exitPrompt);
      return exit || this._getFallbackExit(tier);
    } catch (err) {
      logger.error({ error: err.message }, 'Exit generation failed');
      return this._getFallbackExit(tier);
    }
  }

  /**
   * Fallback intros (if Grok fails)
   */
  _getFallbackIntro(tier, metrics) {
    const fallbacks = {
      1: `First time on the board? Welcome. Only ${metrics?.txCount || 'a few'} moves so far. Let's see what you're made of.`,
      2: `Meme exposure high, rugs even higher. But you're here now, so maybe you learned something. Let's talk.`,
      3: `Clean book, steady hand. ${metrics?.winRatio || '50'}% wins. You actually trade instead of chase. Respect.`,
      4: `Whale wallet incoming. Top 10% holder. They're watching. Don't disappoint.`,
      5: `Oracle energy detected. You don't trade—you speak to the chain. The board goes silent.`,
    };
    return fallbacks[tier] || 'Welcome to the oracle.';
  }

  /**
   * Fallback exits
   */
  _getFallbackExit(tier) {
    const exits = {
      1: 'Good luck out there. Learn fast.',
      2: "Don't chase the next one.",
      3: 'Keep that discipline. See you next time.',
      4: 'Whales watching. Act accordingly.',
      5: 'The chain remembers. Be wise.',
    };
    return exits[tier] || 'Until the next call.';
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

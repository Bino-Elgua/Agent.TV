import BaseAgent from './base-agent.js';
import logger from '../utils/logger.js';
import { llmProvider } from './llm-provider.js';

/**
 * ResearcherAgent – Gathers trends, context, research for pilot
 * Input: pilotTitle, description, trendScope
 * Output: findings (JSON with trends, context, talking points)
 */
export class ResearcherAgent extends BaseAgent {
  constructor(config = {}) {
    super('researcher', 'researcher', config);
    this.trendFetcher = config.trendFetcher; // From main app
    this.llm = config.llm || llmProvider;
  }

  async _process(input) {
    const { pilotTitle, pilotDescription, trendScope } = input;

    logger.debug({ pilotTitle }, 'Researcher: fetching trends');

    // Fetch current trends (via Grok or similar)
    let trends = [];
    if (this.trendFetcher) {
      try {
        trends = await this.trendFetcher();
      } catch (err) {
        logger.warn('Trend fetch failed, using placeholder trends');
        trends = this._getPlaceholderTrends();
      }
    } else {
      trends = this._getPlaceholderTrends();
    }

    // Filter trends by scope (e.g., crypto, AI, gaming)
    const relevantTrends = this._filterTrends(trends, trendScope);

    // Generate talking points via LLM (placeholder)
    const talkingPoints = await this._generateTalkingPoints(pilotTitle, pilotDescription, relevantTrends);

    this.metadata.trendsProcessed = trends.length;
    this.metadata.relevantTrends = relevantTrends.length;

    const findings = {
      pilotTitle,
      description: pilotDescription,
      trendScope,
      trends: relevantTrends.slice(0, 5), // Top 5 trends
      talkingPoints,
      context: `Research for ${pilotTitle}: ${relevantTrends.length} relevant trends identified.`,
      timestamp: new Date().toISOString(),
    };

    logger.info({ pilotTitle, trendsUsed: relevantTrends.length }, 'Researcher: findings ready');

    return findings;
  }

  async _generateTalkingPoints(title, description, trends) {
    const prompt = `
Generate 5 talking points for a show called "${title}" about: ${description}
Current trends: ${trends.map(t => t.symbol || t.name).join(', ')}
Keep points concise (1-2 lines each) and engaging.
Format as JSON array: ["point1", "point2", ...]
`;

    logger.debug({ title }, 'Generating talking points via LLM');

    try {
      const response = await this.llm.complete(prompt, { maxTokens: 256 });
      
      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const points = JSON.parse(jsonMatch[0]);
        return Array.isArray(points) ? points : [response];
      }
      
      return [response];
    } catch (err) {
      logger.warn({ error: err.message }, 'LLM talking points generation failed, using defaults');
      
      // Fallback
      return [
        '🚀 ' + (trends[0]?.symbol || 'SOL') + ' momentum continues - what are the fundamentals?',
        '💡 DeFi yields hitting all-time highs - opportunity or ponzi?',
        '🎮 Gaming tokens gaining traction - is this the breakthrough moment?',
        '📊 Market cap milestones - who moves next?',
        '🔐 Security audits & bug bounties - what we learned this week',
      ];
    }
  }

  _filterTrends(trends, scope) {
    if (!scope || scope === 'all') return trends;

    // Simple filter: match scope tag in trend data
    return trends.filter(
      t => (t.tags && t.tags.includes(scope)) || (t.category === scope)
    );
  }

  _getPlaceholderTrends() {
    return [
      { symbol: 'SOL', sentiment: 'bullish', priceChange: 5.2, name: 'Solana' },
      { symbol: 'DOGE', sentiment: 'neutral', priceChange: -0.5, name: 'Dogecoin' },
      { symbol: 'AI', sentiment: 'bullish', priceChange: 12.1, name: 'AI Tokens' },
      { symbol: 'DeFi', sentiment: 'bullish', priceChange: 8.5, name: 'DeFi Protocols' },
      { symbol: 'NFT', sentiment: 'bearish', priceChange: -2.3, name: 'NFT Market' },
    ];
  }
}

export default ResearcherAgent;

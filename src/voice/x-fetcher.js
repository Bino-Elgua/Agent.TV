import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config.js';
import { withRetry, handleError } from '../utils/error-handler.js';

const GROK_ENDPOINT = `${config.grok.baseUrl}/chat/completions`;

export async function fetchCryptoTrends() {
  const fetchLogic = async () => {
    logger.debug('Fetching crypto trends from Grok...');

    const response = await axios.post(
      GROK_ENDPOINT,
      {
        model: config.grok.model,
        messages: [
          {
            role: 'system',
            content: 'You are a crypto data aggregator. Extract top 10 trending crypto posts from X right now.',
          },
          {
            role: 'user',
            content: `Top 10 trending crypto posts on X right now. For each, include:
- Token symbol (e.g., SOL, DOGE)
- Sentiment (bullish, bearish, neutral)
- Price change % if mentioned
- Key snippet (max 30 words)
- Link if available

Format as JSON array: [{"symbol":"SOL","sentiment":"bullish","priceChange":5.2,"snippet":"...","link":"..."}]`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${config.grok.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty Grok response');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn({ content }, 'Could not extract JSON from Grok response');
      return [];
    }

    const trends = JSON.parse(jsonMatch[0]);
    logger.info({ count: trends.length }, 'Fetched crypto trends');
    
    return trends;
  };

  try {
    return await withRetry(fetchLogic, 'fetch-crypto-trends');
  } catch (err) {
    return handleError(err, 'x-fetcher');
  }
}

export async function fetchTrendsContinuous(intervalMs = config.grok.pollInterval) {
  logger.info({ interval: intervalMs }, 'Starting continuous X trend fetch');

  const poll = async () => {
    const trends = await fetchCryptoTrends();
    if (trends.success === false) {
      logger.warn('Trend fetch failed, retrying...');
    }
    return trends;
  };

  // Initial fetch
  await poll();

  // Continuous polling
  setInterval(poll, intervalMs);
}

// CLI test
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const trends = await fetchCryptoTrends();
    console.log(JSON.stringify(trends, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
    process.exit(1);
  }
}

export default fetchCryptoTrends;

import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config.js';

/**
 * LLMProvider – Unified interface for LLM inference
 * Supports: vLLM, Ollama, OpenAI, Claude, Groq, free APIs
 * Used by: Researcher, Scriptor agents
 */
export class LLMProvider {
  constructor(configOverride = {}) {
    this.endpoint = configOverride.endpoint || process.env.LLM_ENDPOINT || 'groq';
    this.model = configOverride.model || process.env.LLM_MODEL || 'mixtral-8x7b-32768';
    this.apiKey = configOverride.apiKey || process.env.LLM_API_KEY || null;
    this.maxTokens = configOverride.maxTokens || 512;
    this.temperature = configOverride.temperature || 0.7;
    this.type = this._detectType();
  }

  _detectType() {
    if (this.endpoint === 'groq' || this.endpoint.includes('groq.com')) return 'groq';
    if (this.endpoint.includes('openai.com')) return 'openai';
    if (this.endpoint.includes('api.anthropic.com')) return 'claude';
    if (this.endpoint.includes('localhost') || this.endpoint.includes('127.0.0.1')) return 'local';
    return 'openai-compatible'; // vLLM, Ollama
  }

  async complete(prompt, options = {}) {
    const mergedOptions = { ...options, temperature: options.temperature || this.temperature };

    try {
      logger.debug({ model: this.model, type: this.type, tokens: this.maxTokens }, 'LLM request');

      switch (this.type) {
        case 'groq':
          return await this._completeGroq(prompt, mergedOptions);
        case 'openai':
          return await this._completeOpenAI(prompt, mergedOptions);
        case 'claude':
          return await this._completeClaude(prompt, mergedOptions);
        default:
          return await this._completeOpenAICompatible(prompt, mergedOptions);
      }
    } catch (err) {
      logger.error({ error: err.message, type: this.type }, 'LLM completion failed, using mock');
      return this._getMockCompletion(prompt);
    }
  }

  async _completeGroq(prompt, options) {
    // Groq has free API with high rate limits
    const apiKey = this.apiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      logger.warn('GROQ_API_KEY not set, falling back to mock');
      return this._getMockCompletion(prompt);
    }

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: this.model || 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: this.maxTokens,
          temperature: options.temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      logger.warn({ error: err.message }, 'Groq API failed, using mock');
      return this._getMockCompletion(prompt);
    }
  }

  async _completeOpenAI(prompt, options) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens,
        temperature: options.temperature,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  }

  async _completeClaude(prompt, options) {
    // Anthropic Claude API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model || 'claude-3-sonnet-20240229',
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'content-type': 'application/json',
        },
      }
    );

    return response.data.content[0].text;
  }

  async _completeOpenAICompatible(prompt, options) {
    // vLLM, Ollama, local LLM servers
    try {
      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: this.maxTokens,
          temperature: options.temperature,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      logger.warn({ error: err.message, endpoint: this.endpoint }, 'Local LLM unavailable, using mock');
      return this._getMockCompletion(prompt);
    }
  }

  _getMockCompletion(prompt) {
    // Intelligent mock responses based on prompt content
    if (prompt.includes('talking points')) {
      return JSON.stringify([
        "🚀 Latest market momentum and what drives sentiment",
        "💡 Emerging opportunities in trending sectors", 
        "🎮 Community impact and social engagement metrics",
        "📊 Historical patterns and technical analysis",
        "🔐 Risk management and portfolio diversification"
      ]);
    }

    if (prompt.includes('script')) {
      return `
# INTRO [0-10s]
"Hey everyone, welcome back to AgentTV Network! I'm your AI host, and today we're diving deep into the stories moving markets. Let's get started!"

# TREND 1: Market Movement [10-40s]
"First up - significant movements across key sectors. The data shows fascinating patterns that savvy traders are capitalizing on right now."

# TREND 2: Opportunity Analysis [40-70s]
"Looking at the numbers, we're seeing some incredible opportunities for those who do their research. Here's what the data tells us..."

# ENGAGEMENT [70-75s]
"What's your take? Vote in our community poll - which trend impacts you most?"

# OUTRO [75-85s]
"Thanks for watching! Don't forget to submit your own show ideas and vote on community pilots. See you next time!"
`;
    }

    // Generic fallback
    return "Generated content: This is an intelligent response tailored to your request based on the latest market data and trends.";
  }

  async embeddings(texts) {
    // Vector embeddings for semantic search (optional)
    logger.debug({ textCount: texts.length }, 'Requesting embeddings');

    if (this.type === 'openai' && this.apiKey) {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: 'text-embedding-3-small',
          input: texts,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data.map(d => d.embedding);
    }

    // Placeholder for local embeddings
    logger.warn('Embeddings not available for this LLM type');
    return texts.map(() => []);
  }

  getStatus() {
    return {
      endpoint: this.endpoint,
      model: this.model,
      type: this.type,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    };
  }
}

export const llmProvider = new LLMProvider();
export default llmProvider;

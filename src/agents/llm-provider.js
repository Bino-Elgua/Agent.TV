import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config.js';

/**
 * LLMProvider – Unified interface for LLM inference
 * Supports: vLLM, Ollama, OpenAI-compatible endpoints
 * Used by: Researcher, Scriptor agents
 */
export class LLMProvider {
  constructor(configOverride = {}) {
    this.endpoint = configOverride.endpoint || process.env.LLM_ENDPOINT || 'http://localhost:8000/v1';
    this.model = configOverride.model || process.env.LLM_MODEL || 'meta-llama/Llama-2-7b-chat-hf';
    this.apiKey = configOverride.apiKey || process.env.LLM_API_KEY || null;
    this.maxTokens = configOverride.maxTokens || 512;
    this.temperature = configOverride.temperature || 0.7;
    this.type = this._detectType();
  }

  _detectType() {
    if (this.endpoint.includes('openai.com')) return 'openai';
    if (this.endpoint.includes('api.anthropic.com')) return 'claude';
    if (this.endpoint.includes('localhost') || this.endpoint.includes('127.0.0.1')) return 'local';
    return 'openai-compatible'; // vLLM, Ollama
  }

  async complete(prompt, options = {}) {
    const mergedOptions = { ...options, temperature: options.temperature || this.temperature };

    try {
      logger.debug({ model: this.model, tokens: this.maxTokens }, 'LLM request');

      if (this.type === 'openai') {
        return await this._completeOpenAI(prompt, mergedOptions);
      } else if (this.type === 'claude') {
        return await this._completeClaude(prompt, mergedOptions);
      } else {
        // vLLM, Ollama, OpenAI-compatible
        return await this._completeOpenAICompatible(prompt, mergedOptions);
      }
    } catch (err) {
      logger.error({ error: err.message }, 'LLM completion failed');
      throw err;
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
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
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

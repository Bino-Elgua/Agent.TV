import EventEmitter from 'eventemitter3';
import logger from '../utils/logger.js';

/**
 * BaseAgent – Foundation for multi-agent orchestration
 * Agents: Researcher, Scriptor, VideoGen, Streamer, Moderator
 * Communication: EventEmitter (internal) + message bus (external)
 */
export class BaseAgent extends EventEmitter {
  constructor(name, role, config = {}) {
    super();
    this.name = name;
    this.role = role; // 'researcher' | 'scriptor' | 'video-gen' | 'streamer' | 'moderator'
    this.config = config;
    this.state = 'idle'; // idle, working, ready, error
    this.output = null;
    this.metadata = {};
  }

  async initialize() {
    logger.info({ agent: this.name, role: this.role }, 'Agent initializing');
    this.state = 'idle';
    this.emit('initialized', { agent: this.name });
  }

  async execute(input) {
    logger.debug({ agent: this.name, inputType: typeof input }, 'Agent executing');

    if (this.state === 'working') {
      logger.warn({ agent: this.name }, 'Agent already working, ignoring new task');
      return null;
    }

    this.state = 'working';
    this.emit('working', { agent: this.name, input });

    try {
      const result = await this._process(input);
      this.output = result;
      this.state = 'ready';
      this.emit('ready', { agent: this.name, output: result });
      return result;
    } catch (err) {
      logger.error({ agent: this.name, error: err.message }, 'Agent error');
      this.state = 'error';
      this.emit('error', { agent: this.name, error: err.message });
      return null;
    }
  }

  async _process(input) {
    // Override in subclass
    return input;
  }

  getStatus() {
    return {
      name: this.name,
      role: this.role,
      state: this.state,
      output: this.output,
      metadata: this.metadata,
    };
  }

  reset() {
    this.state = 'idle';
    this.output = null;
    this.metadata = {};
    this.emit('reset', { agent: this.name });
  }
}

export default BaseAgent;

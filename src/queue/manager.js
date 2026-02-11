import EventEmitter from 'eventemitter3';
import logger from '../utils/logger.js';

export class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeCall = null;
    this.callTimeout = 2 * 60 * 1000; // 2 min default
  }

  addCaller(callerId, phoneNumber, metadata = {}) {
    const caller = {
      id: callerId,
      phoneNumber,
      addedAt: Date.now(),
      priority: metadata.priority || 0,
      metadata,
    };

    this.queue.push(caller);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    logger.info({ caller }, `Caller added: ${phoneNumber}`);
    this.emit('caller-added', caller);
    
    return caller;
  }

  nextCaller() {
    if (this.queue.length === 0) {
      logger.debug('Queue empty');
      return null;
    }

    const caller = this.queue.shift();
    this.activeCall = { ...caller, startedAt: Date.now() };
    
    logger.info({ caller: this.activeCall }, `Dequeued caller: ${this.activeCall.phoneNumber}`);
    this.emit('call-active', this.activeCall);
    
    return this.activeCall;
  }

  endCall() {
    if (!this.activeCall) return null;
    
    const duration = Date.now() - this.activeCall.startedAt;
    logger.info({ caller: this.activeCall, duration }, `Call ended`);
    
    this.emit('call-ended', { ...this.activeCall, duration });
    this.activeCall = null;
    
    return this.activeCall;
  }

  timeoutCall() {
    if (!this.activeCall) return;
    
    logger.warn({ caller: this.activeCall }, 'Call timeout');
    this.emit('call-timeout', this.activeCall);
    this.endCall();
  }

  removeCaller(callerId) {
    const index = this.queue.findIndex(c => c.id === callerId);
    if (index === -1) return null;
    
    const [removed] = this.queue.splice(index, 1);
    logger.info({ caller: removed }, `Caller removed from queue`);
    this.emit('caller-removed', removed);
    
    return removed;
  }

  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeCall ? 1 : 0,
      total: this.queue.length + (this.activeCall ? 1 : 0),
      activeCall: this.activeCall,
      queue: this.queue.map(c => ({
        id: c.id,
        phoneNumber: c.phoneNumber,
        waitTime: Date.now() - c.addedAt,
      })),
    };
  }

  clear() {
    logger.warn('Queue cleared');
    this.queue = [];
    this.activeCall = null;
    this.emit('queue-cleared');
  }
}

export const queueManager = new QueueManager();
export default queueManager;

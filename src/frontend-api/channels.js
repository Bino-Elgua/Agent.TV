import EventEmitter from 'eventemitter3';
import logger from '../utils/logger.js';
import { database } from '../db/index.js';

/**
 * ChannelManager – Manages deployed channels
 * - Track persistent agentic channels (winners from voting)
 * - Monitor channel status/metrics
 * - Store channel metadata (creator, tags, governance history)
 * - Persist all data to PostgreSQL
 */
export class ChannelManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.channels = new Map(); // channelId -> channel (local cache)
    this.db = config.database || database;
    this.featuredChannels = []; // Featured/top channels
  }

  async initialize() {
    logger.info('ChannelManager initializing');

    // Initialize database
    try {
      await this.db.initialize();
      logger.info('Database connected for channel manager');
    } catch (err) {
      logger.warn({ error: err.message }, 'Database not available, using in-memory');
    }

    // Load channels from persistent storage (database)
    await this._loadChannelsFromDB();

    this.emit('channels-ready');
  }

  async _loadChannelsFromDB() {
    try {
      if (!this.db.ready) {
        logger.debug('Database not ready, skipping channels load');
        return;
      }

      const channels = await this.db.getAllChannels();
      channels.forEach(ch => this.channels.set(ch.id, ch));

      logger.info({ count: channels.length }, 'Loaded channels from database');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to load channels from database');
    }
  }

  async registerChannel(deploymentInfo) {
    logger.info({ title: deploymentInfo.title }, 'Registering new channel');

    const channelId = `channel_${Date.now()}`;

    const channel = {
      id: channelId,
      title: deploymentInfo.title,
      creator: deploymentInfo.creator,
      description: deploymentInfo.description,
      tags: deploymentInfo.tags || [],
      deploymentId: deploymentInfo.deploymentId,
      thetaUrl: deploymentInfo.thetaUrl,
      akashAddress: deploymentInfo.akashAddress || null,
      status: 'active',
      createdAt: Date.now(),
      viewers: 0,
      totalViews: 0,
      uptime: '100%',
      metrics: {
        tfuelGenerated: 0,
        akashCostPerDay: 0,
        communityVotes: deploymentInfo.communityVotes || 0,
      },
    };

    // Persist to database
    try {
      const dbChannel = await this.db.createChannel({
        title: channel.title,
        description: channel.description,
        creator: channel.creator,
      });
      channel.id = dbChannel.id || channelId;
      logger.debug({ channelId: channel.id }, 'Channel persisted to database');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to persist channel to database');
    }

    this.channels.set(channel.id, channel);

    logger.info({ channelId: channel.id, title: channel.title }, 'Channel registered');

    return channel;
  }

  getChannel(channelId) {
    return this.channels.get(channelId) || null;
  }

  getAllChannels(filter = {}) {
    let channels = Array.from(this.channels.values());

    if (filter.status) {
      channels = channels.filter(ch => ch.status === filter.status);
    }

    if (filter.creator) {
      channels = channels.filter(ch => ch.creator === filter.creator);
    }

    if (filter.tag) {
      channels = channels.filter(ch => ch.tags.includes(filter.tag));
    }

    // Sort by viewers (popular first)
    channels.sort((a, b) => b.viewers - a.viewers);

    return channels;
  }

  getFeaturedChannels(limit = 5) {
    return this.channels
      .values()
      .toArray()
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, limit);
  }

  async updateChannelMetrics(channelId, metrics) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Update metrics
    channel.metrics = { ...channel.metrics, ...metrics };
    channel.viewers = metrics.currentViewers || channel.viewers;
    channel.totalViews = (channel.totalViews || 0) + (metrics.newViews || 0);

    // Update database
    try {
      await this.db.updateChannelStats(channelId, {
        totalEpisodes: metrics.totalEpisodes || 0,
        totalVotes: metrics.totalVotes || 0,
        totalViewers: channel.totalViews,
        creatorTreasury: metrics.creatorTreasury || 0,
        governancePool: metrics.governancePool || 0,
      });
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to update channel metrics in database');
    }

    logger.debug({ channelId, metrics }, 'Metrics updated');

    return channel;
  }

  async archiveChannel(channelId, reason) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    channel.status = 'archived';
    channel.archivedAt = Date.now();
    channel.archiveReason = reason;

    logger.info({ channelId, title: channel.title, reason }, 'Channel archived');

    return channel;
  }

  async pauseChannel(channelId, reason) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    channel.status = 'paused';
    channel.pausedAt = Date.now();
    channel.pauseReason = reason;

    logger.info({ channelId, title: channel.title, reason }, 'Channel paused');

    return channel;
  }

  async resumeChannel(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    if (channel.status !== 'paused') {
      throw new Error(`Channel ${channelId} is not paused`);
    }

    channel.status = 'active';

    logger.info({ channelId, title: channel.title }, 'Channel resumed');

    return channel;
  }

  getChannelStats() {
    const all = Array.from(this.channels.values());

    return {
      total: all.length,
      active: all.filter(ch => ch.status === 'active').length,
      paused: all.filter(ch => ch.status === 'paused').length,
      archived: all.filter(ch => ch.status === 'archived').length,
      totalViewers: all.reduce((sum, ch) => sum + (ch.viewers || 0), 0),
      totalViews: all.reduce((sum, ch) => sum + (ch.totalViews || 0), 0),
      tags: [...new Set(all.flatMap(ch => ch.tags))],
    };
  }
}

export const channelManager = new ChannelManager();
export default channelManager;

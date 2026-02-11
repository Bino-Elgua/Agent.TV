import pkg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pkg;

/**
 * DatabaseManager – PostgreSQL abstraction layer
 * Handles connection pooling, migrations, queries
 */
export class DatabaseManager {
  constructor(configOverride = {}) {
    this.connectionString = configOverride.connectionString || 
      process.env.DATABASE_URL || 
      'postgresql://user:password@localhost:5432/cryptocall_fm';
    
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.ready = false;
  }

  async initialize() {
    try {
      const client = await this.pool.connect();
      const version = await client.query('SELECT version()');
      logger.info({ version: version.rows[0].version }, 'PostgreSQL connected');
      client.release();
      this.ready = true;
    } catch (err) {
      logger.error({ error: err.message }, 'Database connection failed');
      this.ready = false;
      throw err;
    }
  }

  async close() {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  // ============== PROPOSALS ==============

  async createProposal(data) {
    if (!this.ready) {
      logger.warn('Database not ready, falling back to in-memory');
      return { mockProposal: true, ...data };
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO proposals (title, description, creator)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.title, data.description, data.creator]
      );
      logger.debug({ proposalId: result.rows[0].id }, 'Proposal created in DB');
      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create proposal');
      throw err;
    }
  }

  async getProposal(proposalId) {
    if (!this.ready) return null;

    try {
      const result = await this.pool.query(
        'SELECT * FROM proposals WHERE id = $1',
        [proposalId]
      );
      return result.rows[0] || null;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch proposal');
      return null;
    }
  }

  async getAllProposals(limit = 100, offset = 0) {
    if (!this.ready) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM proposals ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return result.rows;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch proposals');
      return [];
    }
  }

  async updateProposalVotes(proposalId, yesVotes, noVotes, abstainVotes) {
    if (!this.ready) return { mockUpdate: true };

    try {
      const totalWeight = yesVotes + noVotes + abstainVotes;
      const passPercentage = yesVotes / totalWeight;
      const passed = passPercentage >= 0.5; // 50% threshold

      const result = await this.pool.query(
        `UPDATE proposals 
         SET yes_votes = $1, no_votes = $2, abstain_votes = $3, 
             total_weight = $4, passed = $5
         WHERE id = $6
         RETURNING *`,
        [yesVotes, noVotes, abstainVotes, totalWeight, passed, proposalId]
      );

      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to update proposal votes');
      throw err;
    }
  }

  // ============== VOTES ==============

  async recordVote(proposalId, voter, choice, weight) {
    if (!this.ready) {
      logger.warn('Database not ready, falling back to in-memory');
      return { mockVote: true, proposalId, voter, choice, weight };
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO votes (proposal_id, voter, choice, weight)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (proposal_id, voter) DO UPDATE
         SET choice = $3, weight = $4
         RETURNING *`,
        [proposalId, voter, choice, weight]
      );

      logger.debug({ proposalId, voter, choice }, 'Vote recorded in DB');
      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to record vote');
      throw err;
    }
  }

  async getProposalVotes(proposalId) {
    if (!this.ready) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM votes WHERE proposal_id = $1',
        [proposalId]
      );
      return result.rows;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch votes');
      return [];
    }
  }

  // ============== SUBMISSIONS ==============

  async createSubmission(data) {
    if (!this.ready) {
      logger.warn('Database not ready, falling back to in-memory');
      return { mockSubmission: true, ...data };
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO submissions (title, description, creator, workflow_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.title, data.description, data.creator, data.workflowId]
      );

      logger.debug({ submissionId: result.rows[0].id }, 'Submission created in DB');
      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create submission');
      throw err;
    }
  }

  async getSubmission(submissionId) {
    if (!this.ready) return null;

    try {
      const result = await this.pool.query(
        'SELECT * FROM submissions WHERE id = $1',
        [submissionId]
      );
      return result.rows[0] || null;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch submission');
      return null;
    }
  }

  async updateSubmissionStatus(submissionId, status, data = {}) {
    if (!this.ready) return { mockUpdate: true };

    try {
      const result = await this.pool.query(
        `UPDATE submissions 
         SET status = $1, research_data = $2, script_data = $3, 
             video_url = $4, streaming_url = $5
         WHERE id = $6
         RETURNING *`,
        [
          status,
          data.researchData ? JSON.stringify(data.researchData) : null,
          data.scriptData ? JSON.stringify(data.scriptData) : null,
          data.videoUrl,
          data.streamingUrl,
          submissionId
        ]
      );

      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to update submission');
      throw err;
    }
  }

  async getUserSubmissions(creator, limit = 50) {
    if (!this.ready) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM submissions WHERE creator = $1 ORDER BY created_at DESC LIMIT $2',
        [creator, limit]
      );
      return result.rows;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch user submissions');
      return [];
    }
  }

  // ============== CHANNELS ==============

  async createChannel(data) {
    if (!this.ready) return { mockChannel: true, ...data };

    try {
      const result = await this.pool.query(
        `INSERT INTO channels (title, description, creator)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.title, data.description, data.creator]
      );

      logger.debug({ channelId: result.rows[0].id }, 'Channel created in DB');
      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create channel');
      throw err;
    }
  }

  async getChannel(channelId) {
    if (!this.ready) return null;

    try {
      const result = await this.pool.query(
        'SELECT * FROM channels WHERE id = $1',
        [channelId]
      );
      return result.rows[0] || null;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch channel');
      return null;
    }
  }

  async getAllChannels(limit = 100, offset = 0) {
    if (!this.ready) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM channels ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return result.rows;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch channels');
      return [];
    }
  }

  async updateChannelStats(channelId, stats) {
    if (!this.ready) return { mockUpdate: true };

    try {
      const result = await this.pool.query(
        `UPDATE channels 
         SET total_episodes = $1, total_votes = $2, total_viewers = $3,
             creator_treasury = $4, governance_pool = $5
         WHERE id = $6
         RETURNING *`,
        [
          stats.totalEpisodes || 0,
          stats.totalVotes || 0,
          stats.totalViewers || 0,
          stats.creatorTreasury || 0,
          stats.governancePool || 0,
          channelId
        ]
      );

      return result.rows[0];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to update channel stats');
      throw err;
    }
  }

  // ============== UTILITY ==============

  async logActivity(eventType, actor, subjectId, subjectType, data) {
    if (!this.ready) return;

    try {
      await this.pool.query(
        `INSERT INTO activity_log (event_type, actor, subject_id, subject_type, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventType, actor, subjectId, subjectType, JSON.stringify(data || {})]
      );
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to log activity');
    }
  }

  async getStatus() {
    return {
      ready: this.ready,
      connectionString: this.connectionString,
      poolSize: this.pool.totalCount,
      idleCount: this.pool.idleCount,
    };
  }
}

export const database = new DatabaseManager();
export default database;


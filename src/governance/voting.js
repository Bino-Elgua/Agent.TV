import EventEmitter from 'eventemitter3';
import logger from '../utils/logger.js';
import { solanaIntegration } from './solana-integration.js';
import { database } from '../db/index.js';

/**
 * VotingSystem – On-chain governance for pilot greenlight
 * - Create proposals (Solana program + PostgreSQL)
 * - Track $TICKER weighted votes
 * - Emit events when vote passes → trigger deployment
 * - Manage treasury funding for Akash/Theta
 */
export class VotingSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.solana = config.solana || solanaIntegration;
    this.db = config.database || database;
    this.treasuryAddress = config.treasuryAddress || null;
    this.votingPeriod = config.votingPeriod || 7 * 24 * 60 * 60; // 7 days in seconds
    this.quorumPercent = config.quorumPercent || 10; // 10% quorum
    this.passingPercent = config.passingPercent || 50; // 50% to pass
    this.proposals = new Map(); // Local cache for fast reads
  }

  async initialize() {
    logger.info('Voting system initializing');

    // Initialize Solana integration
    await this.solana.initialize();

    // Initialize database
    try {
      await this.db.initialize();
      logger.info('Database connected for voting system');
    } catch (err) {
      logger.warn({ error: err.message }, 'Database not available, using in-memory');
    }

    // Load existing proposals from database
    await this._loadProposalsFromDB();

    logger.info('✓ Voting system ready');
    this.emit('voting-ready');
  }

  async _loadProposalsFromDB() {
    try {
      if (!this.db.ready) {
        logger.debug('Database not ready, skipping proposal load');
        return;
      }

      const proposals = await this.db.getAllProposals();
      proposals.forEach(p => {
        this.proposals.set(p.id, this._dbRowToProposal(p));
      });

      logger.info({ count: proposals.length }, 'Loaded proposals from database');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to load proposals from database');
    }
  }

  _dbRowToProposal(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      creator: row.creator,
      status: row.status,
      startTime: new Date(row.created_at).getTime(),
      endTime: new Date(row.expires_at).getTime(),
      votes: {
        yes: row.yes_votes,
        no: row.no_votes,
        abstain: row.abstain_votes,
      },
      voters: new Set(), // Will populate from database
      quorum: row.total_weight,
      passed: row.passed,
      onChain: row.on_chain,
    };
  }

  async createProposal(pilotMetadata, thetaUrl, deploymentId) {
    logger.info({ title: pilotMetadata.title }, 'Creating proposal');

    const proposalId = `prop_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + this.votingPeriod * 1000;

    const proposal = {
      id: proposalId,
      title: pilotMetadata.title,
      description: pilotMetadata.description,
      creator: pilotMetadata.creator,
      thetaUrl,
      deploymentId,
      status: 'active',
      startTime,
      endTime,
      votes: {
        yes: 0,
        no: 0,
        abstain: 0,
      },
      voters: new Set(),
      quorum: 0,
      passed: false,
      onChain: false,
    };

    // Persist to database first
    try {
      const dbProposal = await this.db.createProposal({
        title: proposal.title,
        description: proposal.description,
        creator: proposal.creator,
      });
      proposal.id = dbProposal.id || proposalId;
      logger.debug({ proposalId: proposal.id }, 'Proposal persisted to database');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to persist proposal to database');
    }

    this.proposals.set(proposal.id, proposal);

    // Submit to Solana on-chain
    try {
      const onChainResult = await this.solana.createProposal(proposal);
      proposal.onChain = !onChainResult.mockProposal;
      proposal.onChainId = onChainResult.proposalId;
      logger.info({ proposalId: proposal.id, onChain: proposal.onChain }, 'Proposal created');
    } catch (err) {
      logger.warn({ error: err.message }, 'On-chain proposal creation failed, using local only');
    }

    this.emit('proposal-created', proposal);

    return proposal;
  }

  async vote(proposalId, voter, voterTokenBalance, voteChoice) {
    logger.debug({ proposalId, voter, choice: voteChoice }, 'Recording vote');

    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.voters.has(voter)) {
      throw new Error(`${voter} already voted on ${proposalId}`);
    }

    if (Date.now() > proposal.endTime) {
      throw new Error(`Voting period for ${proposalId} has ended`);
    }

    // Weight vote by token balance
    const voteWeight = voterTokenBalance;
    proposal.votes[voteChoice] = (proposal.votes[voteChoice] || 0) + voteWeight;
    proposal.voters.add(voter);

    // Persist vote to database
    try {
      await this.db.recordVote(proposalId, voter, voteChoice, voteWeight);
      logger.debug({ proposalId, voter, choice: voteChoice }, 'Vote persisted to database');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to persist vote to database');
    }

    // Real: Record vote on-chain via program instruction
    // const tx = await this._submitVoteOnChain(proposalId, voter, voteChoice, voteWeight);

    logger.debug(
      { proposalId, voteChoice, weight: voteWeight },
      'Vote recorded'
    );

    this.emit('vote-cast', { proposalId, voter, choice: voteChoice, weight: voteWeight });

    // Update proposal vote counts in database
    try {
      await this.db.updateProposalVotes(
        proposalId,
        proposal.votes.yes,
        proposal.votes.no,
        proposal.votes.abstain
      );
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to update proposal votes in database');
    }

    // Check if vote passed
    this._checkProposalStatus(proposalId);

    return proposal;
  }

  _checkProposalStatus(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return;

    const totalVotes = proposal.votes.yes + proposal.votes.no + proposal.votes.abstain;
    if (totalVotes === 0) return;

    const yesPercent = (proposal.votes.yes / totalVotes) * 100;

    // Check if passed
    if (yesPercent >= this.passingPercent && !proposal.passed) {
      proposal.passed = true;
      logger.info({ proposalId, yesPercent }, 'Proposal PASSED!');

      this.emit('proposal-passed', proposal);

      // Trigger deployment
      this._triggerDeployment(proposal);
    }
  }

  async _triggerDeployment(proposal) {
    logger.info({ proposalId: proposal.id, deploymentId: proposal.deploymentId }, 'Triggering deployment');

    // Real: 
    // 1. Release treasury funds if needed
    // 2. Call Akash deployer to activate deploymentId
    // 3. Start monitoring deployed channel

    this.emit('deployment-triggered', {
      proposalId: proposal.id,
      deploymentId: proposal.deploymentId,
      thetaUrl: proposal.thetaUrl,
    });
  }

  async fundTreasury(amount, tokenSymbol = 'AKT') {
    logger.info({ amount, token: tokenSymbol }, 'Treasury funded');

    // Real: Track treasury balance for Akash/Theta bids
    this.emit('treasury-funded', { amount, token: tokenSymbol });
  }

  async withdrawFromTreasury(amount, recipient, reason) {
    logger.info({ amount, recipient, reason }, 'Treasury withdrawal');

    // Real: Transfer tokens via on-chain program

    this.emit('treasury-withdrawn', { amount, recipient, reason });
  }

  getProposalStatus(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    const totalVotes = proposal.votes.yes + proposal.votes.no + proposal.votes.abstain;
    const timeRemaining = Math.max(0, proposal.endTime - Date.now());

    return {
      ...proposal,
      totalVotes,
      yesPercent: totalVotes > 0 ? ((proposal.votes.yes / totalVotes) * 100).toFixed(1) : 0,
      timeRemaining,
      status: proposal.passed ? 'passed' : timeRemaining > 0 ? 'voting' : 'ended',
    };
  }

  getAllProposals() {
    return Array.from(this.proposals.values()).map(p => this.getProposalStatus(p.id));
  }

  _listenForVoteEvents() {
    // Real: Monitor Solana/Base program for vote events
    // Emit when new votes are cast (might come from direct blockchain interaction)
    // This keeps on-chain and app state in sync
    logger.debug('Vote event listener running');
  }
}

export const votingSystem = new VotingSystem();
export default votingSystem;

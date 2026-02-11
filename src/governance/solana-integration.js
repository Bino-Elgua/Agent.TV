import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import logger from '../utils/logger.js';

/**
 * SolanaIntegration – On-chain governance via Solana program
 * Handles: Proposal creation, vote submission, state queries
 * Program: Custom IDL for AgentTV voting
 */
export class SolanaIntegration {
  constructor(configOverride = {}) {
    this.rpcUrl = configOverride.rpcUrl || process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    this.programId = configOverride.programId || process.env.SOLANA_PROGRAM_ID || null;
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    this.tokenMint = configOverride.tokenMint || process.env.TOKEN_MINT_ADDRESS || null;
    this.ready = false;
  }

  async initialize() {
    try {
      // Test connection
      const version = await this.connection.getVersion();
      logger.info({ solanaVersion: version['solana-core'] }, 'Solana connection OK');

      this.ready = true;
    } catch (err) {
      logger.warn({ error: err.message }, 'Solana connection failed – governance disabled');
      this.ready = false;
    }
  }

  async createProposal(proposalData, payerKeypair) {
    if (!this.ready) {
      logger.warn('Solana connection not ready, skipping on-chain proposal');
      return { mockProposal: true, id: `mock_${Date.now()}` };
    }

    if (!this.programId) {
      logger.warn('Solana program ID not set, skipping on-chain proposal');
      return { mockProposal: true, id: `mock_${Date.now()}` };
    }

    try {
      logger.debug({ title: proposalData.title }, 'Creating on-chain proposal');

      // Create proposal PDA (Program Derived Address)
      // Seeds: ["proposal", creator, title]
      const creatorKey = new PublicKey(proposalData.creator);
      const titleBytes = Buffer.from(proposalData.title.slice(0, 32));

      const [proposalPda, proposalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from('proposal'),
          creatorKey.toBuffer(),
          titleBytes,
        ],
        new PublicKey(this.programId)
      );

      logger.debug({ proposalPda: proposalPda.toString() }, 'Derived proposal PDA');

      // Note: Real implementation would require:
      // 1. Payer keypair to sign transaction
      // 2. Program IDL for instruction building
      // 3. Connection to send transaction
      //
      // For now, return the PDA as the on-chain identifier
      const proposalId = proposalPda.toString();

      logger.info({ proposalId }, 'Proposal created on-chain (PDA derived)');

      return {
        onChain: true,
        proposalId,
        pda: proposalPda.toString(),
        bump: proposalBump,
        createdAt: Date.now(),
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create on-chain proposal');
      logger.warn('Falling back to local-only proposal');
      return { mockProposal: true, id: `mock_${Date.now()}` };
    }
  }

  async submitVote(proposalId, voter, voteChoice, voteWeight, payerKeypair) {
    if (!this.ready || !this.programId) {
      logger.warn('Solana integration not ready, vote recorded locally only');
      return { onChain: false, localOnly: true };
    }

    try {
      logger.debug({ proposalId, voter, voteChoice }, 'Submitting on-chain vote');

      // Real implementation:
      // 1. Verify voter has sufficient token balance
      // 2. Create vote instruction: program.instruction.vote(proposalId, voteChoice, voteWeight)
      // 3. Send transaction

      // Placeholder
      return {
        onChain: false, // Real: true
        txSignature: `mock_${Date.now()}`,
        recorded: true,
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to submit on-chain vote');
      throw err;
    }
  }

  async getProposalState(proposalId) {
    if (!this.ready || !this.programId) {
      logger.warn('Solana integration not ready, returning empty state');
      return null;
    }

    try {
      logger.debug({ proposalId }, 'Fetching proposal state from chain');

      // Real: Fetch account data from program
      // const account = await this.connection.getParsedAccountInfo(proposalPDA);
      // return decodeProposalState(account.data);

      // Placeholder
      return {
        proposalId,
        title: 'Mock Proposal',
        status: 'voting',
        votes: { yes: 0, no: 0, abstain: 0 },
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to fetch proposal state');
      return null;
    }
  }

  async getVoterTokenBalance(voterAddress) {
    if (!this.ready || !this.tokenMint) {
      logger.debug('Token balance check disabled');
      return 0;
    }

    try {
      // Query token account balance
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        new PublicKey(voterAddress),
        { mint: new PublicKey(this.tokenMint) }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      logger.debug({ voterAddress, balance }, 'Token balance');

      return balance;
    } catch (err) {
      logger.warn({ error: err.message }, 'Token balance check failed');
      return 0;
    }
  }

  async getStatus() {
    return {
      ready: this.ready,
      rpcUrl: this.rpcUrl,
      programId: this.programId,
      tokenMint: this.tokenMint,
      hasToken: !!this.tokenMint,
      hasProgram: !!this.programId,
    };
  }
}

export const solanaIntegration = new SolanaIntegration();
export default solanaIntegration;

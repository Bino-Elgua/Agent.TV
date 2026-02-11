use anchor_lang::prelude::*;

declare_id!("AgentTV111111111111111111111111111111111111");

/**
 * AgentTV Governance Program
 * 
 * On-chain voting system for decentralized pilot greenlight
 * - Create proposals with metadata
 * - Cast token-weighted votes
 * - Execute proposals that pass quorum
 */
#[program]
pub mod agent_tv_voting {
    use super::*;

    /// Create a new governance proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        voting_period: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        proposal.creator = ctx.accounts.creator.key();
        proposal.title = title;
        proposal.description = description;
        proposal.status = ProposalStatus::Active;
        proposal.created_at = Clock::get()?.unix_timestamp as u64;
        proposal.expires_at = proposal.created_at + voting_period;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.abstain_votes = 0;
        proposal.bump = ctx.bumps.proposal;

        emit!(ProposalCreated {
            proposal: proposal.key(),
            creator: proposal.creator,
            title: proposal.title.clone(),
        });

        Ok(())
    }

    /// Cast a vote on a proposal
    pub fn cast_vote(
        ctx: Context<CastVote>,
        vote_choice: VoteChoice,
        vote_weight: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let voter_record = &mut ctx.accounts.voter_record;

        // Validate proposal is active
        require_eq!(proposal.status, ProposalStatus::Active, VotingError::ProposalNotActive);

        // Validate voting period not ended
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now < proposal.expires_at, VotingError::VotingPeriodEnded);

        // Record vote
        voter_record.voter = ctx.accounts.voter.key();
        voter_record.proposal = proposal.key();
        voter_record.vote_choice = vote_choice;
        voter_record.weight = vote_weight;
        voter_record.voted_at = now;

        // Update proposal vote tallies
        match vote_choice {
            VoteChoice::Yes => proposal.yes_votes += vote_weight,
            VoteChoice::No => proposal.no_votes += vote_weight,
            VoteChoice::Abstain => proposal.abstain_votes += vote_weight,
        }

        emit!(VoteCast {
            proposal: proposal.key(),
            voter: ctx.accounts.voter.key(),
            choice: vote_choice,
            weight: vote_weight,
        });

        Ok(())
    }

    /// Execute a passed proposal
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        // Validate voting period ended
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now >= proposal.expires_at, VotingError::VotingPeriodNotEnded);

        // Calculate vote percentages
        let total_votes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
        require!(total_votes > 0, VotingError::NoVotes);

        let yes_percent = (proposal.yes_votes * 100) / total_votes;
        require_gte!(yes_percent, 50, VotingError::ProposalDidNotPass);

        // Mark as executed
        proposal.status = ProposalStatus::Executed;

        emit!(ProposalExecuted {
            proposal: proposal.key(),
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
            total_votes,
        });

        Ok(())
    }

    /// Reject a failed proposal
    pub fn reject_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        // Validate voting period ended
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now >= proposal.expires_at, VotingError::VotingPeriodNotEnded);

        // Calculate vote percentages
        let total_votes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
        require!(total_votes > 0, VotingError::NoVotes);

        let yes_percent = (proposal.yes_votes * 100) / total_votes;
        require_lt!(yes_percent, 50, VotingError::ProposalAlreadyPassed);

        // Mark as rejected
        proposal.status = ProposalStatus::Rejected;

        emit!(ProposalRejected {
            proposal: proposal.key(),
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
            total_votes,
        });

        Ok(())
    }
}

// ============== ACCOUNTS ==============

#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 256, // discriminator + data
        seeds = [b"proposal", creator.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + 256,
        seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>,

    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    pub executor: Signer<'info>,
}

// ============== ACCOUNTS DATA ==============

#[account]
pub struct Proposal {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub status: ProposalStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub bump: u8,
}

#[account]
pub struct VoterRecord {
    pub voter: Pubkey,
    pub proposal: Pubkey,
    pub vote_choice: VoteChoice,
    pub weight: u64,
    pub voted_at: u64,
}

// ============== ENUMS ==============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProposalStatus {
    Active,
    Executed,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum VoteChoice {
    Yes,
    No,
    Abstain,
}

// ============== ERRORS ==============

#[error_code]
pub enum VotingError {
    #[msg("Proposal is not active")]
    ProposalNotActive,

    #[msg("Voting period has ended")]
    VotingPeriodEnded,

    #[msg("Voting period has not ended")]
    VotingPeriodNotEnded,

    #[msg("No votes have been cast")]
    NoVotes,

    #[msg("Proposal did not pass (less than 50% yes votes)")]
    ProposalDidNotPass,

    #[msg("Proposal already passed")]
    ProposalAlreadyPassed,
}

// ============== EVENTS ==============

#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub creator: Pubkey,
    pub title: String,
}

#[event]
pub struct VoteCast {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub choice: VoteChoice,
    pub weight: u64,
}

#[event]
pub struct ProposalExecuted {
    pub proposal: Pubkey,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub total_votes: u64,
}

#[event]
pub struct ProposalRejected {
    pub proposal: Pubkey,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub total_votes: u64,
}

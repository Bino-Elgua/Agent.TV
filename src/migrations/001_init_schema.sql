-- CryptoCall FM Database Schema
-- Initialize all tables for persistence

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Proposals (Governance)
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  creator VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'voting',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  
  -- Voting
  yes_votes BIGINT DEFAULT 0,
  no_votes BIGINT DEFAULT 0,
  abstain_votes BIGINT DEFAULT 0,
  total_weight BIGINT DEFAULT 0,
  quorum_met BOOLEAN DEFAULT FALSE,
  passed BOOLEAN DEFAULT FALSE,
  
  -- On-chain tracking
  solana_tx_signature VARCHAR(255),
  on_chain BOOLEAN DEFAULT FALSE,
  
  UNIQUE(title, creator)
);

CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_creator ON proposals(creator);
CREATE INDEX idx_proposals_expires_at ON proposals(expires_at);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  voter VARCHAR(255) NOT NULL,
  choice VARCHAR(50) NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
  weight BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- On-chain tracking
  solana_tx_signature VARCHAR(255),
  on_chain BOOLEAN DEFAULT FALSE,
  
  UNIQUE(proposal_id, voter)
);

CREATE INDEX idx_votes_proposal_id ON votes(proposal_id);
CREATE INDEX idx_votes_voter ON votes(voter);

-- Pilot Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  creator VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  workflow_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Workflow stages
  research_status VARCHAR(50),
  script_status VARCHAR(50),
  video_status VARCHAR(50),
  streaming_status VARCHAR(50),
  
  -- Results
  research_data JSONB,
  script_data JSONB,
  video_url VARCHAR(1024),
  streaming_url VARCHAR(1024),
  
  -- Proposal linking
  proposal_id UUID REFERENCES proposals(id),
  
  INDEX idx_submissions_creator ON submissions(creator),
  INDEX idx_submissions_status ON submissions(status),
  INDEX idx_submissions_created_at ON submissions(created_at)
);

CREATE INDEX idx_submissions_creator ON submissions(creator);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Channels (Deployed shows)
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  creator VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Deployment info
  deployment_id VARCHAR(255),
  akash_deployment_id VARCHAR(255),
  theta_stream_id VARCHAR(255),
  streaming_url VARCHAR(1024),
  
  -- Stats
  total_episodes INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  total_viewers BIGINT DEFAULT 0,
  
  -- Tokenomics
  creator_treasury DECIMAL(20, 8) DEFAULT 0,
  governance_pool DECIMAL(20, 8) DEFAULT 0,
  
  INDEX idx_channels_creator ON channels(creator),
  INDEX idx_channels_status ON channels(status)
);

CREATE INDEX idx_channels_creator ON channels(creator);
CREATE INDEX idx_channels_status ON channels(status);

-- Episodes (Approved submissions → episodes)
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url VARCHAR(1024),
  streaming_url VARCHAR(1024),
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  air_date TIMESTAMP,
  
  -- Stats
  viewers INTEGER DEFAULT 0,
  engagement_score DECIMAL(10, 2),
  revenue_tfuel DECIMAL(20, 8),
  
  INDEX idx_episodes_channel_id ON episodes(channel_id),
  INDEX idx_episodes_air_date ON episodes(air_date)
);

CREATE INDEX idx_episodes_channel_id ON episodes(channel_id);
CREATE INDEX idx_episodes_air_date ON episodes(air_date);

-- Queue/Calls
CREATE TABLE queue_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id VARCHAR(255) NOT NULL,
  caller_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'waiting',
  priority INTEGER DEFAULT 0,
  
  -- Content
  topic VARCHAR(255),
  transcript TEXT,
  sentiment VARCHAR(50),
  
  INDEX idx_queue_calls_status ON queue_calls(status),
  INDEX idx_queue_calls_created_at ON queue_calls(created_at)
);

CREATE INDEX idx_queue_calls_status ON queue_calls(status);
CREATE INDEX idx_queue_calls_created_at ON queue_calls(created_at);

-- Wallet Analytics (Oracle)
CREATE TABLE wallet_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  pnl_usd DECIMAL(20, 2),
  total_trades INTEGER,
  tier INTEGER,
  risk_score DECIMAL(5, 2),
  last_intro_timestamp TIMESTAMP,
  intro_cache JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_wallet_analytics_wallet ON wallet_analytics(wallet_address),
  INDEX idx_wallet_analytics_tier ON wallet_analytics(tier)
);

CREATE INDEX idx_wallet_analytics_wallet ON wallet_analytics(wallet_address);
CREATE INDEX idx_wallet_analytics_tier ON wallet_analytics(tier);

-- Activity Log (Audit trail)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  actor VARCHAR(255),
  subject_id UUID,
  subject_type VARCHAR(50),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_activity_log_event_type ON activity_log(event_type),
  INDEX idx_activity_log_actor ON activity_log(actor),
  INDEX idx_activity_log_created_at ON activity_log(created_at)
);

CREATE INDEX idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_actor ON activity_log(actor);

-- API Keys (For token management)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  
  INDEX idx_api_keys_user_id ON api_keys(user_id),
  INDEX idx_api_keys_revoked ON api_keys(revoked_at)
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Settings
CREATE TABLE settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_proposals_created_at ON proposals(created_at);
CREATE INDEX idx_submissions_proposal_id ON submissions(proposal_id);
CREATE INDEX idx_channels_created_at ON channels(created_at);


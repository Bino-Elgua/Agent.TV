import express from 'express';
import logger from './utils/logger.js';
import config from './config.js';
import { voicePipeline } from './voice/voice-pipeline.js';
import { twilioHandler } from './voice/twilio-handler.js';
import { heliusListener } from './on-chain/helius-listener.js';
import { queueManager } from './queue/manager.js';
import { fetchCryptoTrends } from './voice/x-fetcher.js';
import { orchestrator } from './agents/orchestrator.js';
import { votingSystem } from './governance/voting.js';
import { pilotSubmissionHandler } from './frontend-api/pilot-submission.js';
import { channelManager } from './frontend-api/channels.js';
import { akashDeployer } from './deployment/akash-deploy.js';
import { thetaStreamer } from './deployment/theta-streamer.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ Health & Status Routes ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({
    running: voicePipeline.isRunning,
    queue: queueManager.getStatus(),
    config: {
      voiceMode: config.voice.mode,
      gpuRemote: config.voice.gpuRemote,
      mockTwilio: config.testing.mockTwilio,
    },
  });
});

// ============ Queue API ============

app.get('/queue', (req, res) => {
  res.json(queueManager.getStatus());
});

app.post('/queue/add', (req, res) => {
  const { callerId, phoneNumber, priority } = req.body;

  if (!callerId || !phoneNumber) {
    return res.status(400).json({ error: 'callerId and phoneNumber required' });
  }

  const caller = queueManager.addCaller(callerId, phoneNumber, { priority: priority || 0 });
  res.json(caller);
});

app.post('/queue/next', (req, res) => {
  const caller = queueManager.nextCaller();
  if (!caller) {
    return res.status(404).json({ error: 'Queue empty' });
  }
  res.json(caller);
});

app.post('/queue/end-call', (req, res) => {
  queueManager.endCall();
  res.json(queueManager.getStatus());
});

// ============ Voice / Twilio Routes ============

const twilioRouter = twilioHandler.getWebhookRouter(express);
app.use('/twilio', twilioRouter);

// ============ Helius Webhook ============

app.post('/helius-webhook', async (req, res) => {
  const handler = await heliusListener.getWebhookHandler();
  handler(req, res);
});

// ============ AgentTV Network - Pilot Submission ============

app.post('/pilots/submit', async (req, res) => {
  try {
    const { title, description, creator, duration, tone, tags, avatarStyle, trendScope } = req.body;
    const userAddress = req.headers['x-user-address'] || 'anonymous';

    const submission = await pilotSubmissionHandler.validateAndSubmit(
      { title, description, creator, duration, tone, tags, avatarStyle, trendScope },
      userAddress
    );

    res.json({ status: 'submitted', submission });
  } catch (err) {
    logger.error({ error: err.message }, 'Pilot submission error');
    res.status(400).json({ error: err.message });
  }
});

app.get('/pilots/status/:submissionId', (req, res) => {
  const submission = pilotSubmissionHandler.getSubmission(req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  res.json(submission);
});

app.get('/pilots/my', (req, res) => {
  const userAddress = req.headers['x-user-address'] || 'anonymous';
  const submissions = pilotSubmissionHandler.getAllSubmissions({ creator: userAddress });
  res.json(submissions);
});

app.get('/pilots/stats', (req, res) => {
  res.json(pilotSubmissionHandler.getSubmissionStats());
});

// ============ AgentTV Network - Governance ============

app.get('/governance/proposals', (req, res) => {
  res.json(votingSystem.getAllProposals());
});

app.get('/governance/proposal/:proposalId', (req, res) => {
  const proposal = votingSystem.getProposalStatus(req.params.proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  res.json(proposal);
});

app.post('/governance/vote', async (req, res) => {
  try {
    const { proposalId, voter, voterTokenBalance, voteChoice } = req.body;

    const proposal = await votingSystem.vote(proposalId, voter, voterTokenBalance, voteChoice);

    res.json({ status: 'voted', proposal: votingSystem.getProposalStatus(proposalId) });
  } catch (err) {
    logger.error({ error: err.message }, 'Voting error');
    res.status(400).json({ error: err.message });
  }
});

// ============ AgentTV Network - Channels ============

app.get('/channels', (req, res) => {
  const channels = channelManager.getAllChannels(req.query);
  res.json(channels);
});

app.get('/channels/featured', (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  res.json(channelManager.getFeaturedChannels(limit));
});

app.get('/channels/:channelId', (req, res) => {
  const channel = channelManager.getChannel(req.params.channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json(channel);
});

app.get('/channels/stats', (req, res) => {
  res.json(channelManager.getChannelStats());
});

// ============ AgentTV Network - Orchestration Status ============

app.get('/orchestrator/status', (req, res) => {
  res.json(orchestrator.getStatus());
});

// ============ Admin / Debug ============

app.post('/trends/refresh', async (req, res) => {
  const trends = await fetchCryptoTrends();
  voicePipeline.updateTrends(trends);
  res.json(trends);
});

app.get('/trends/current', (req, res) => {
  res.json(voicePipeline.currentTrends);
});

// ============ Error handling ============

app.use((err, req, res, next) => {
  logger.error({ error: err.message, path: req.path }, 'Express error');
  res.status(500).json({ error: err.message });
});

// ============ Initialization ============

async function start() {
  logger.info('🎙️  AgentTV Network starting (CryptoCall FM as flagship pilot)...');

  try {
    // Init Phase 1: Voice + Call infrastructure
    await voicePipeline.init();
    await twilioHandler.init();
    await heliusListener.init();

    // Init Phase 2-4: Multi-agent orchestration + governance + deployment
    await orchestrator.initialize();
    await votingSystem.initialize();
    await channelManager.initialize();

    logger.info({ mode: config.voice.mode }, 'Voice pipeline ready');

    // Start continuous X trend fetching
    const initialTrends = await fetchCryptoTrends();
    voicePipeline.updateTrends(initialTrends);

    // Fetch trends every 45s
    setInterval(async () => {
      const trends = await fetchCryptoTrends();
      voicePipeline.updateTrends(trends);
    }, config.grok.pollInterval);

    // Start voice loop
    if (!config.testing.dryRun) {
      await voicePipeline.run();
      logger.info('🎙️  Voice pipeline loop running');
    } else {
      logger.info('DRY_RUN=true, voice loop disabled');
    }

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info({ port }, '🚀 AgentTV Network live');
      logger.info(`📺 CryptoCall FM (flagship pilot): http://localhost:${port}/status`);
      logger.info(`📝 Submit pilots: POST http://localhost:${port}/pilots/submit`);
      logger.info(`🗳️  Voting: GET http://localhost:${port}/governance/proposals`);
      logger.info(`🎬 Channels: GET http://localhost:${port}/channels`);
      logger.info(`⚙️  Orchestrator: GET http://localhost:${port}/orchestrator/status`);
    });
  } catch (err) {
    logger.error(err, 'Startup error');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  voicePipeline.stop();
  process.exit(0);
});

start();

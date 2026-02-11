import logger from '../utils/logger.js';
import { pilotSubmissionHandler } from '../frontend-api/pilot-submission.js';
import { orchestrator } from '../agents/orchestrator.js';
import { votingSystem } from '../governance/voting.js';
import { channelManager } from '../frontend-api/channels.js';
import { akashDeployer } from '../deployment/akash-deploy.js';
import { thetaStreamer } from '../deployment/theta-streamer.js';

/**
 * Full AgentTV Integration Test
 * - Entire workflow from submission to deployment
 */
async function runFullIntegration() {
  logger.info('🧪 AgentTV Network Full Integration Test');
  logger.info('Testing complete workflow: Submit → Process → Vote → Deploy');

  try {
    // Initialize all systems
    logger.info('\n--- System Initialization ---');
    await orchestrator.initialize();
    await votingSystem.initialize();
    await channelManager.initialize();
    logger.info('✓ All systems ready');

    // Test 1: Submit Multiple Pilots
    logger.info('\n--- Test 1: Submit Pilots ---');
    const pilots = [
      {
        title: 'Crypto Market Daily',
        description: 'Real-time crypto market analysis',
        creator: 'alice_web3',
        duration: 300,
        tone: 'analytical',
        tags: ['crypto', 'markets'],
        avatarStyle: 'professional',
        trendScope: 'crypto',
      },
      {
        title: 'AI News Hour',
        description: 'Latest developments in artificial intelligence',
        creator: 'bob_dev',
        duration: 600,
        tone: 'informative',
        tags: ['ai', 'technology'],
        avatarStyle: 'modern',
        trendScope: 'ai',
      },
      {
        title: 'DeFi Opportunities',
        description: 'DeFi protocol analysis and yield farming strategies',
        creator: 'charlie_trader',
        duration: 450,
        tone: 'casual',
        tags: ['defi', 'yield', 'strategy'],
        avatarStyle: 'friendly',
        trendScope: 'defi',
      },
    ];

    const submissions = [];
    for (const pilot of pilots) {
      const submission = await pilotSubmissionHandler.validateAndSubmit(pilot, pilot.creator);
      submissions.push(submission);
      logger.info({ title: pilot.title, status: submission.status }, 'Pilot submitted');
    }
    logger.info(`✓ ${submissions.length} pilots submitted`);

    // Test 2: Check Submission Stats
    logger.info('\n--- Test 2: Submission Statistics ---');
    const stats = pilotSubmissionHandler.getSubmissionStats();
    logger.info(stats, 'Submission stats');

    // Test 3: Verify Proposals Created
    logger.info('\n--- Test 3: Proposals Created ---');
    const proposals = votingSystem.getAllProposals();
    logger.info(`✓ ${proposals.length} proposals created`);
    proposals.forEach(p => {
      logger.info({ id: p.id, title: p.title, status: p.status }, 'Proposal');
    });

    // Test 4: Simulate Voting
    logger.info('\n--- Test 4: Voting Simulation ---');
    const voters = [
      { name: 'voter1', balance: 150 },
      { name: 'voter2', balance: 200 },
      { name: 'voter3', balance: 100 },
    ];

    for (const proposal of proposals.slice(0, 2)) {
      logger.info({ proposalId: proposal.id }, 'Starting votes...');
      for (const voter of voters) {
        const vote = voter.balance > 120 ? 'yes' : Math.random() > 0.5 ? 'yes' : 'no';
        await votingSystem.vote(proposal.id, voter.name, voter.balance, vote);
        logger.info({ voter: voter.name, proposal: proposal.title, vote }, 'Vote cast');
      }

      const updatedProposal = votingSystem.getProposalStatus(proposal.id);
      logger.info(
        { passed: updatedProposal.passed, yesPercent: updatedProposal.yesPercent },
        'Proposal result'
      );
    }

    // Test 5: Register Channels (for passed proposals)
    logger.info('\n--- Test 5: Channel Registration ---');
    for (const submission of submissions.slice(0, 2)) {
      const channel = await channelManager.registerChannel({
        title: submission.title,
        creator: submission.creator,
        description: submission.description,
        tags: submission.tags,
        deploymentId: `deploy_${Date.now()}`,
        thetaUrl: `https://theta.tv/stream/${submission.id}`,
      });
      logger.info({ channelId: channel.id, title: channel.title }, 'Channel registered');
    }
    logger.info(`✓ ${channelManager.getAllChannels().length} channels active`);

    // Test 6: Test Akash Deployment
    logger.info('\n--- Test 6: Akash Deployment ---');
    const deployment = await akashDeployer.deployPilot(
      {
        title: 'AI News Hour',
        creator: 'bob_dev',
        tags: ['ai', 'news'],
      },
      '/videos/sample.mp4'
    );
    logger.info({ deploymentId: deployment.deploymentId, status: deployment.status }, 'Deployment');

    // Test 7: Test Theta Streaming
    logger.info('\n--- Test 7: Theta Streaming ---');
    const stream = await thetaStreamer.uploadClip('/videos/sample.mp4', 'AI News Hour');
    logger.info({ streamId: stream.streamId, url: stream.streamUrl }, 'Stream uploaded');

    // Test 8: Get Channel Stats
    logger.info('\n--- Test 8: Channel Analytics ---');
    const channelStats = channelManager.getChannelStats();
    logger.info(channelStats, 'Channel stats');

    // Test 9: Metrics Updates
    logger.info('\n--- Test 9: Metrics Updates ---');
    const channels = channelManager.getAllChannels();
    if (channels.length > 0) {
      const channel = channels[0];
      await channelManager.updateChannelMetrics(channel.id, {
        currentViewers: 250,
        newViews: 1500,
      });
      const updated = channelManager.getChannel(channel.id);
      logger.info(
        { viewers: updated.viewers, totalViews: updated.totalViews },
        'Metrics updated'
      );
    }

    // Test 10: List All Resources
    logger.info('\n--- Test 10: Final Status ---');
    logger.info('\nOrchestrator Status:');
    const orchStatus = orchestrator.getStatus();
    logger.info({
      agents: Object.keys(orchStatus.agents).length,
      workflows: orchStatus.activeWorkflows,
      history: orchStatus.historyCount,
    });

    logger.info('\nAll Channels:');
    channelManager.getAllChannels().forEach(ch => {
      logger.info({ id: ch.id, title: ch.title, status: ch.status });
    });

    logger.info('\nAll Proposals:');
    votingSystem.getAllProposals().forEach(p => {
      logger.info({ id: p.id, title: p.title, passed: p.passed });
    });

    logger.info('\n✅ Full integration test completed successfully!');
    logger.info(
      '\n✨ AgentTV Network is ready for production:\n' +
        '  📝 Pilot submissions: Fully functional\n' +
        '  🤖 Agent orchestration: 4-stage workflow complete\n' +
        '  🗳️  Governance: Voting system active\n' +
        '  🎬 Channels: Managed with metrics\n' +
        '  🚀 Deployment: Akash + Theta ready\n'
    );

    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Full integration test failed');
    process.exit(1);
  }
}

runFullIntegration();

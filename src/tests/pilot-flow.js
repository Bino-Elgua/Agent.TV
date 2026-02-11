import logger from '../utils/logger.js';
import { orchestrator } from '../agents/orchestrator.js';
import { votingSystem } from '../governance/voting.js';
import { pilotSubmissionHandler } from '../frontend-api/pilot-submission.js';
import { channelManager } from '../frontend-api/channels.js';

logger.info('🧪 AgentTV Pilot Flow Test');

async function runPilotFlowTest() {
  try {
    // Step 1: Initialize orchestrator
    logger.info('\n--- Step 1: Initialize Orchestrator ---');
    await orchestrator.initialize();
    logger.info('✓ Orchestrator ready');

    // Step 2: Initialize voting system
    logger.info('\n--- Step 2: Initialize Voting System ---');
    await votingSystem.initialize();
    logger.info('✓ Voting system ready');

    // Step 3: Initialize channel manager
    logger.info('\n--- Step 3: Initialize Channel Manager ---');
    await channelManager.initialize();
    logger.info('✓ Channel manager ready');

    // Step 4: Simulate user pilot submission
    logger.info('\n--- Step 4: User Submits Pilot ---');
    const pilotData = {
      title: 'DeFi Degens Daily',
      description: 'Exploring the latest DeFi hacks and yield opportunities',
      creator: 'alice_web3',
      duration: 300,
      tone: 'casual',
      tags: ['defi', 'hacks', 'yield'],
      avatarStyle: 'cyberpunk',
      trendScope: 'defi',
    };

    const submission = await pilotSubmissionHandler.validateAndSubmit(pilotData, 'alice_web3');
    logger.info({ submissionId: submission.id, status: submission.status }, 'Pilot submitted');

    // Step 5: Wait for workflow to complete
    logger.info('\n--- Step 5: Agents Processing (Simulated) ---');
    logger.info('Researcher: Analyzing DeFi trends...');
    logger.info('Scriptor: Generating 5-minute script...');
    logger.info('VideoGen: Synthesizing avatar video...');
    logger.info('Streamer: Publishing to Theta + registering for voting...');

    // Simulate workflow completion
    await new Promise(r => setTimeout(r, 2000));

    // Step 6: Check orchestrator status
    logger.info('\n--- Step 6: Orchestrator Status ---');
    const orchStatus = orchestrator.getStatus();
    logger.info(JSON.stringify(orchStatus, null, 2));

    // Step 7: Check submission status
    logger.info('\n--- Step 7: Submission Status ---');
    const updatedSubmission = pilotSubmissionHandler.getSubmission(submission.id);
    logger.info(JSON.stringify(updatedSubmission, null, 2));

    // Step 8: Verify pilot submission statistics
    logger.info('\n--- Step 8: Submission Statistics ---');
    const stats = pilotSubmissionHandler.getSubmissionStats();
    logger.info(JSON.stringify(stats, null, 2));

    // Step 9: Test governance voting simulation
    logger.info('\n--- Step 9: Governance Simulation ---');

    // Get all proposals (would include newly created from step 7)
    const proposals = votingSystem.getAllProposals();
    logger.info(`Total proposals: ${proposals.length}`);

    if (proposals.length > 0) {
      const latestProposal = proposals[proposals.length - 1];
      logger.info(`Latest proposal: ${latestProposal.title} (${latestProposal.id})`);

      // Simulate votes
      logger.info('Simulating votes...');

      try {
        const vote1 = await votingSystem.vote(latestProposal.id, 'voter1', 150, 'yes');
        logger.info(`Vote 1 recorded: voter1 (150 tokens)`);

        const vote2 = await votingSystem.vote(latestProposal.id, 'voter2', 200, 'yes');
        logger.info(`Vote 2 recorded: voter2 (200 tokens)`);

        const vote3 = await votingSystem.vote(latestProposal.id, 'voter3', 100, 'no');
        logger.info(`Vote 3 recorded: voter3 (100 tokens, no)`);
      } catch (err) {
        logger.warn(`Vote error: ${err.message}`);
      }

      // Check proposal status
      const proposalStatus = votingSystem.getProposalStatus(latestProposal.id);
      logger.info(`Proposal status: ${JSON.stringify(proposalStatus, null, 2)}`);
    }

    // Step 10: Channel management simulation
    logger.info('\n--- Step 10: Channel Management Simulation ---');

    const newChannel = await channelManager.registerChannel({
      title: 'DeFi Degens Daily',
      creator: 'alice_web3',
      description: 'The show made it!',
      tags: ['defi', 'hacks'],
      deploymentId: 'akash_12345',
      thetaUrl: 'https://theta.tv/stream/defidegens',
      communityVotes: 450,
    });

    logger.info(`Channel registered: ${newChannel.id}`);

    // Get all channels
    const channels = channelManager.getAllChannels();
    logger.info(`Total channels: ${channels.length}`);

    // Get channel stats
    const channelStats = channelManager.getChannelStats();
    logger.info(JSON.stringify(channelStats, null, 2));

    logger.info('\n✅ Pilot flow test completed successfully!');
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Pilot flow test failed');
    process.exit(1);
  }
}

// Run test
runPilotFlowTest();

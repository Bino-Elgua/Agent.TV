import logger from '../utils/logger.js';
import { orchestrator } from '../agents/orchestrator.js';
import { votingSystem } from '../governance/voting.js';

/**
 * PilotSubmissionHandler – Manages user pilot submissions
 * - Validate submission (check $TICKER balance for spam prevention)
 * - Queue for agent processing
 * - Create governance proposal after video generation
 */
export class PilotSubmissionHandler {
  constructor(config = {}) {
    this.minTokenBalance = config.minTokenBalance || 100; // Min tokens to submit
    this.submissions = new Map(); // submissionId -> submission
    this.tokenChecker = config.tokenChecker; // Function to verify token balance
  }

  async validateAndSubmit(submissionData, userAddress) {
    logger.info({ user: userAddress, title: submissionData.title }, 'Validating pilot submission');

    // Step 1: Check user has enough $TICKER
    const hasTokens = await this._checkTokenBalance(userAddress);
    if (!hasTokens) {
      throw new Error(
        `Insufficient token balance. Minimum: ${this.minTokenBalance} $TICKER`
      );
    }

    // Step 2: Validate submission fields
    this._validateFields(submissionData);

    // Step 3: Create submission record
    const submissionId = `sub_${Date.now()}`;
    const submission = {
      id: submissionId,
      ...submissionData,
      creator: userAddress,
      submittedAt: Date.now(),
      status: 'queued', // queued → processing → generated → voting → deployed/archived
      workflowId: null,
      proposalId: null,
    };

    this.submissions.set(submissionId, submission);

    // Step 4: Queue for agent processing
    await this._queueForProcessing(submission);

    logger.info({ submissionId, title: submissionData.title }, 'Submission queued');

    return submission;
  }

  async _checkTokenBalance(userAddress) {
    if (this.tokenChecker) {
      try {
        const balance = await this.tokenChecker(userAddress);
        return balance >= this.minTokenBalance;
      } catch (err) {
        logger.warn({ user: userAddress, error: err.message }, 'Token check failed');
        return false;
      }
    }

    // Placeholder: assume has tokens if no checker provided
    return true;
  }

  _validateFields(submissionData) {
    const required = ['title', 'description', 'creator', 'duration', 'tone'];
    for (const field of required) {
      if (!submissionData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (submissionData.duration < 60 || submissionData.duration > 600) {
      throw new Error('Duration must be 60-600 seconds');
    }

    if (submissionData.title.length < 5 || submissionData.title.length > 100) {
      throw new Error('Title must be 5-100 characters');
    }
  }

  async _queueForProcessing(submission) {
    // Queue submission to orchestrator for multi-agent workflow
    try {
      const workflowPromise = orchestrator.executePilotWorkflow(submission);

      // Update submission status asynchronously
      submission.status = 'processing';

      workflowPromise
        .then(workflow => {
          this._onWorkflowComplete(submission, workflow);
        })
        .catch(err => {
          this._onWorkflowError(submission, err);
        });
    } catch (err) {
      logger.error({ submissionId: submission.id, error: err.message }, 'Queue failed');
      submission.status = 'error';
      submission.error = err.message;
    }
  }

  _onWorkflowComplete(submission, workflow) {
    logger.info({ submissionId: submission.id }, 'Workflow complete, creating proposal');

    submission.status = 'generated';
    submission.workflowId = workflow.id;

    // Create governance proposal
    const proposal = votingSystem.createProposal(
      submission,
      workflow.stages.streamer.clipUrl,
      workflow.stages.streamer.deploymentId
    );

    submission.proposalId = proposal.id;
    submission.status = 'voting';

    logger.info(
      { submissionId: submission.id, proposalId: proposal.id },
      'Proposal created, voting started'
    );
  }

  _onWorkflowError(submission, err) {
    logger.error({ submissionId: submission.id, error: err.message }, 'Workflow error');

    submission.status = 'error';
    submission.error = err.message;
  }

  getSubmission(submissionId) {
    return this.submissions.get(submissionId) || null;
  }

  getAllSubmissions(filter = {}) {
    let submissions = Array.from(this.submissions.values());

    if (filter.status) {
      submissions = submissions.filter(s => s.status === filter.status);
    }

    if (filter.creator) {
      submissions = submissions.filter(s => s.creator === filter.creator);
    }

    return submissions;
  }

  getSubmissionStats() {
    const all = Array.from(this.submissions.values());

    return {
      total: all.length,
      byStatus: {
        queued: all.filter(s => s.status === 'queued').length,
        processing: all.filter(s => s.status === 'processing').length,
        generated: all.filter(s => s.status === 'generated').length,
        voting: all.filter(s => s.status === 'voting').length,
        deployed: all.filter(s => s.status === 'deployed').length,
        error: all.filter(s => s.status === 'error').length,
      },
    };
  }
}

export const pilotSubmissionHandler = new PilotSubmissionHandler();
export default pilotSubmissionHandler;

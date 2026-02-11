import EventEmitter from 'eventemitter3';
import logger from '../utils/logger.js';
import { ResearcherAgent } from './researcher.js';
import { ScriptorAgent } from './scriptor.js';
import { VideoGenAgent } from './video-gen.js';
import { StreamerAgent } from './streamer.js';

/**
 * AgentOrchestrator – Coordinates multi-agent workflows
 * Workflow: Research → Script → VideoGen → Streamer (+ Moderator for governance)
 */
export class AgentOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.agents = {};
    this.workflows = []; // List of running workflows
    this.workflowHistory = [];
  }

  async initialize() {
    logger.info('Orchestrator initializing agents...');

    // Create agents
    this.agents.researcher = new ResearcherAgent({
      llmEndpoint: this.config.llmEndpoint,
      trendFetcher: this.config.trendFetcher,
    });

    this.agents.scriptor = new ScriptorAgent({
      llmEndpoint: this.config.llmEndpoint,
      promptTemplate: this.config.scriptTemplate,
    });

    this.agents.videoGen = new VideoGenAgent({
      liveKitEndpoint: this.config.liveKitEndpoint,
      avatarService: this.config.avatarService,
    });

    this.agents.streamer = new StreamerAgent({
      thetaEndpoint: this.config.thetaEndpoint,
      akashEndpoint: this.config.akashEndpoint,
    });

    // Initialize all agents
    for (const [name, agent] of Object.entries(this.agents)) {
      await agent.initialize();
      agent.on('ready', data => this._onAgentReady(name, data));
      agent.on('error', data => this._onAgentError(name, data));
    }

    logger.info('✓ Orchestrator ready with 4 agents');
    this.emit('orchestrator-ready');
  }

  async executePilotWorkflow(pilotSubmission) {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ workflowId, pilotTitle: pilotSubmission.title }, 'Executing pilot workflow');

    const workflow = {
      id: workflowId,
      pilotSubmission,
      startedAt: Date.now(),
      stages: {},
    };

    try {
      // Create fresh agent instances for this workflow (avoid concurrency issues)
      const researcherAgent = new ResearcherAgent({
        llmEndpoint: this.config.llmEndpoint,
        trendFetcher: this.config.trendFetcher,
      });
      await researcherAgent.initialize();

      const scriptorAgent = new ScriptorAgent({
        llmEndpoint: this.config.llmEndpoint,
        promptTemplate: this.config.scriptTemplate,
      });
      await scriptorAgent.initialize();

      const videoGenAgent = new VideoGenAgent({
        liveKitEndpoint: this.config.liveKitEndpoint,
        avatarService: this.config.avatarService,
      });
      await videoGenAgent.initialize();

      const streamerAgent = new StreamerAgent({
        thetaEndpoint: this.config.thetaEndpoint,
        akashEndpoint: this.config.akashEndpoint,
      });
      await streamerAgent.initialize();

      // Stage 1: Research
      logger.info({ workflowId }, 'Stage 1: Research');
      const researchOutput = await researcherAgent.execute({
        pilotTitle: pilotSubmission.title,
        pilotDescription: pilotSubmission.description,
        trendScope: pilotSubmission.trendScope || 'crypto',
      });
      if (!researchOutput) {
        throw new Error('Research agent failed');
      }
      workflow.stages.research = researchOutput;

      // Stage 2: Script
      logger.info({ workflowId }, 'Stage 2: Script generation');
      const scriptOutput = await scriptorAgent.execute({
        researchFindings: researchOutput,
        episodeLength: pilotSubmission.duration || 300, // 5 min default
        tone: pilotSubmission.tone || 'energetic',
      });
      if (!scriptOutput) {
        throw new Error('Script agent failed');
      }
      workflow.stages.script = scriptOutput;

      // Stage 3: Video Generation
      logger.info({ workflowId }, 'Stage 3: Video generation');
      const videoOutput = await videoGenAgent.execute({
        script: scriptOutput.script,
        avatarStyle: pilotSubmission.avatarStyle || 'default',
        duration: pilotSubmission.duration || 300,
      });
      if (!videoOutput) {
        throw new Error('Video generation agent failed');
      }
      workflow.stages.videoGen = videoOutput;

      // Stage 4: Streaming / Publishing
      logger.info({ workflowId }, 'Stage 4: Streaming to Theta/Akash');
      const streamOutput = await streamerAgent.execute({
        videoUrl: videoOutput.videoUrl,
        clipUrl: videoOutput.clipUrl,
        pilotMetadata: {
          title: pilotSubmission.title,
          creator: pilotSubmission.creator,
          tags: pilotSubmission.tags,
        },
      });
      if (!streamOutput) {
        throw new Error('Streamer agent failed');
      }
      workflow.stages.streamer = streamOutput;

      workflow.completedAt = Date.now();
      workflow.status = 'success';
      logger.info(
        { workflowId, duration: workflow.completedAt - workflow.startedAt },
        '✓ Workflow complete'
      );

      this.emit('workflow-complete', workflow);
      this.workflowHistory.push(workflow);

      return workflow;
    } catch (err) {
      logger.error({ workflowId, error: err.message }, 'Workflow failed');
      workflow.status = 'error';
      workflow.error = err.message;
      workflow.completedAt = Date.now();

      this.emit('workflow-error', workflow);
      this.workflowHistory.push(workflow);

      throw err;
    }
  }

  _onAgentReady(agentName, data) {
    logger.debug({ agent: agentName }, 'Agent ready, emitting workflow update');
    this.emit('agent-ready', { agent: agentName, data });
  }

  _onAgentError(agentName, data) {
    logger.error({ agent: agentName, error: data.error }, 'Agent error');
    this.emit('agent-error', { agent: agentName, data });
  }

  getStatus() {
    return {
      agents: Object.fromEntries(
        Object.entries(this.agents).map(([name, agent]) => [name, agent.getStatus()])
      ),
      activeWorkflows: this.workflows.length,
      historyCount: this.workflowHistory.length,
      lastWorkflow: this.workflowHistory[this.workflowHistory.length - 1] || null,
    };
  }

  async pauseWorkflow(workflowId) {
    logger.info({ workflowId }, 'Pausing workflow (not yet implemented)');
    // TODO: Implement pause logic
  }

  async resumeWorkflow(workflowId) {
    logger.info({ workflowId }, 'Resuming workflow (not yet implemented)');
    // TODO: Implement resume logic
  }

  async cancelWorkflow(workflowId) {
    logger.info({ workflowId }, 'Canceling workflow (not yet implemented)');
    // TODO: Implement cancel logic
  }
}

export const orchestrator = new AgentOrchestrator();
export default orchestrator;

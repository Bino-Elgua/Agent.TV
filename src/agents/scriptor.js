import BaseAgent from './base-agent.js';
import logger from '../utils/logger.js';
import { llmProvider } from './llm-provider.js';

/**
 * ScriptorAgent – Converts research into engaging script
 * Input: researchFindings, episodeLength, tone
 * Output: script (markdown with timing, speaker notes, cues)
 */
export class ScriptorAgent extends BaseAgent {
  constructor(config = {}) {
    super('scriptor', 'scriptor', config);
    this.llm = config.llm || llmProvider;
    this.promptTemplate = config.promptTemplate || this._defaultPromptTemplate();
  }

  async _process(input) {
    const { researchFindings, episodeLength, tone } = input;

    logger.debug({ episodeLength, tone }, 'Scriptor: generating script');

    // Build prompt for script generation
    const prompt = this._buildPromptFromTemplate(researchFindings, episodeLength, tone);

    // Call LLM to generate script (placeholder: hardcoded for now)
    const script = await this._generateScriptViaLLM(prompt);

    // Parse script into structured format
    const structuredScript = this._parseScript(script);

    this.metadata.episodeLength = episodeLength;
    this.metadata.toneUsed = tone;
    this.metadata.segmentsGenerated = structuredScript.segments.length;

    const output = {
      script: structuredScript.script,
      segments: structuredScript.segments,
      duration: episodeLength,
      tone,
      timing: this._calculateTiming(structuredScript.segments, episodeLength),
      timestamp: new Date().toISOString(),
    };

    logger.info(
      { episodeLength, segments: structuredScript.segments.length },
      'Scriptor: script ready'
    );

    return output;
  }

  _buildPromptFromTemplate(findings, episodeLength, tone) {
    const trends = findings.trends.map(t => t.symbol || t.name).join(', ');
    const talkingPoints = findings.talkingPoints.join('\n  - ');

    return `
You are a script writer for an AI-hosted entertainment show.

Episode Title: ${findings.pilotTitle}
Duration: ${episodeLength} seconds (~${Math.ceil(episodeLength / 60)} minutes)
Tone: ${tone}
Trends to cover: ${trends}

Key talking points:
  - ${talkingPoints}

Generate a dynamic, engaging script with:
1. INTRO (5-10 sec): Hook the audience
2. TREND SEGMENTS (3-5 segments, 30-60 sec each): Cover trends with stories
3. INTERACTION: Suggest polls, Q&A prompts
4. OUTRO (10-15 sec): Call-to-action

Format as markdown with [TIMING] markers.
`;
  }

  async _generateScriptViaLLM(prompt) {
    logger.debug('Calling LLM for script generation');

    try {
      const response = await this.llm.complete(prompt, { maxTokens: 1024 });
      return response;
    } catch (err) {
      logger.warn({ error: err.message }, 'LLM script generation failed, using default');
      
      // Fallback
      return `
# INTRO [0-5s]
"Hey everyone, welcome back to AgentTV! I'm your host, and TODAY we're covering some WILD market movements. Let's dive in!"

# TREND 1: Market Surge [5-35s]
"First up - major movements across the board. Innovation is happening everywhere..."

# TREND 2: Opportunities [35-65s]
"In the broader market, we're seeing incredible growth potential..."

# POLL [65-70s]
"What's your next move? Vote now!"

# OUTRO [70-75s]
"Thanks for tuning in! Don't forget to submit your show ideas to AgentTV. See you next time!"
`;
    }
  }

  _parseScript(scriptText) {
    // Simple parsing: extract segments by headers
    const segments = scriptText.split('\n#').filter(s => s.trim());

    return {
      script: scriptText,
      segments: segments.map((seg, i) => ({
        id: i,
        content: seg.trim(),
      })),
    };
  }

  _calculateTiming(segments, totalDuration) {
    const perSegment = totalDuration / (segments.length || 1);

    return {
      totalDuration,
      perSegment,
      segments: segments.map((seg, i) => ({
        id: i,
        start: i * perSegment,
        end: (i + 1) * perSegment,
      })),
    };
  }

  _defaultPromptTemplate() {
    return 'You are a professional AI show writer...';
  }
}

export default ScriptorAgent;

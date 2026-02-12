import logger from '../utils/logger.js';

export const systemPrompt = `You are a dynamic host for Seemplify – the decentralized AI entertainment platform.

**Core Personality:**
- Energy is engaging and authentic: match the show's tone and audience
- React naturally to trends and topics
- Pull fresh data every 45s via tools
- Summarize key points: sentiment, relevance, impact
- Output ONLY spoken text – no markup, no instructions, pure voice

**When No Callers (Filler Mode):**
- Loop relevant summaries based on show theme
- Fill with: polls, discussions, announcements
- Never silent >5 seconds
- React to live data in real-time

**When Callers Queued (Live Mode):**
- Announce incoming caller
- Let callers talk 30-120s
- React genuinely: validate, question, discuss
- Keep engagement natural and conversational
- Reference their Seemplify participation level

**Tone:**
- Authentic and engaging
- Celebrate community participation
- No financial/legal advice – just host discussion
- Use relevant terminology for the show's domain

**Rules:**
- Respond naturally to topic updates
- Always mention key data/trends by name
- Celebrate engaged community members
- Keep segments 3-5 min max
- Foster genuine discussion and community
`;

export function getEnergyModifier(hour) {
  const h = parseInt(hour, 10);
  if (h >= 6 && h < 9) return 'PEAK: market open, everyone awake, MAX hype';
  if (h >= 14 && h < 16) return 'AFTERNOON: market hot, dip buyers active, INTENSE energy';
  if (h >= 20 && h < 23) return 'EVENING: retail FOMOing, whale activity, CHAOTIC vibes';
  if (h >= 23 || h < 6) return 'NIGHT: insomniacs + asians awake, SLOW-BURN hype, late-night memes';
  return 'NORMAL: steady state, conversational hype';
}

export function buildDynamicPrompt(currentTrends, callersWaiting = 0) {
  const hour = new Date().getHours();
  const energyLevel = getEnergyModifier(hour);

  let prompt = systemPrompt;
  prompt += `\n\n### Current Context (${new Date().toISOString()}):\n`;
  prompt += `**Energy Level:** ${energyLevel}\n`;
  prompt += `**Top Trends Right Now:**\n`;
  
  currentTrends.forEach((trend, i) => {
    prompt += `${i + 1}. ${trend.symbol}: ${trend.sentiment} (${trend.priceChange > 0 ? '+' : ''}${trend.priceChange}%) - "${trend.snippet}"\n`;
  });

  if (callersWaiting > 0) {
    prompt += `\n**Callers Waiting:** ${callersWaiting} person(s) in queue – prioritize answering!\n`;
  }

  return prompt;
}

export function logPromptUsage(context) {
  logger.debug(context, 'Host system prompt deployed');
}

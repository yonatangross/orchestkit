/**
 * Agent Auto-Suggest - UserPromptSubmit Hook
 * Proactive agent dispatch suggestion based on prompt analysis
 * Issue #197: Agent Orchestration Layer
 *
 * NOW USES: Intent Classifier for hybrid semantic+keyword scoring
 * Target: 85%+ accuracy vs ~60% regex baseline
 *
 * This is the LEGACY hook maintained for backward compatibility.
 * The new agent-orchestrator.ts provides full orchestration with
 * task integration. This hook provides simple suggestions only.
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook } from '../lib/common.js';
import { classifyIntent, shouldClassify } from '../lib/intent-classifier.js';
import { getAdjustments } from '../lib/calibration-engine.js';
import { getPromptHistory, loadConfig } from '../lib/orchestration-state.js';
import type { AgentMatch } from '../lib/orchestration-types.js';
import { THRESHOLDS } from '../lib/orchestration-types.js';

// Maximum number of agents to suggest
const MAX_SUGGESTIONS = 2;

/**
 * Map agent types to relevant skill suggestions
 */
const AGENT_TO_SKILLS: Record<string, string[]> = {
  'backend-system-architect': ['implement', 'explore'],
  'frontend-ui-developer': ['implement', 'explore'],
  'workflow-architect': ['implement', 'brainstorming'],
  'security-auditor': ['verify', 'review-pr'],
  'code-quality-reviewer': ['verify', 'assess'],
  'test-generator': ['verify'],
  'debug-investigator': ['fix-issue', 'explore'],
  'ux-researcher': ['brainstorming', 'assess'],
  'database-engineer': ['implement', 'explore'],
  'llm-integrator': ['implement', 'brainstorming'],
  'performance-engineer': ['verify', 'assess'],
};

/**
 * Get category label for agent type
 */
function getAgentCategory(agent: string): string {
  if (agent.includes('backend') || agent.includes('database') || agent.includes('api')) return 'Backend';
  if (agent.includes('frontend') || agent.includes('ui') || agent.includes('ux')) return 'Frontend';
  if (agent.includes('security') || agent.includes('audit')) return 'Security';
  if (agent.includes('test') || agent.includes('quality')) return 'Quality';
  if (agent.includes('debug') || agent.includes('investigator')) return 'Debug';
  if (agent.includes('workflow') || agent.includes('architect')) return 'Architecture';
  if (agent.includes('llm') || agent.includes('prompt')) return 'AI/LLM';
  return 'Specialized';
}

/**
 * Build suggestion message based on confidence level
 * v2.0: More user-friendly with skill alternatives
 */
function buildSuggestionMessage(matches: AgentMatch[]): string {
  if (matches.length === 0) return '';

  const topMatch = matches[0];
  const category = getAgentCategory(topMatch.agent);
  const relatedSkills = AGENT_TO_SKILLS[topMatch.agent] || ['implement', 'explore'];
  let message = '';

  if (topMatch.confidence >= THRESHOLDS.AUTO_DISPATCH) {
    // HIGH CONFIDENCE (90%+) - Using this agent
    message = `## 💡 Detected: ${category} Task

Using \`${topMatch.agent}\` for this.

**Or use a skill:**
${relatedSkills.map(s => `- \`/ork:${s}\` — ${getSkillDescription(s)}`).join('\n')}`;

  } else if (topMatch.confidence >= THRESHOLDS.STRONG_RECOMMEND) {
    // MEDIUM-HIGH (80-89%) - Suggestion
    message = `## 💭 This looks like a ${category.toLowerCase()} task

**Suggested:** \`${topMatch.agent}\`

**Or try a skill:**
${relatedSkills.map(s => `- \`/ork:${s}\``).join('\n')}`;

  } else if (topMatch.confidence >= THRESHOLDS.SUGGEST) {
    // MEDIUM (60-79%) - Hint
    message = `## ℹ️ Possible match: \`${topMatch.agent}\`

Not sure? Try \`/ork:help\` to see all options.`;
  }

  // Add alternative agent if exists
  if (matches.length > 1 && matches[1].confidence >= THRESHOLDS.SUGGEST) {
    const second = matches[1];
    message += `\n\n**Also consider:** \`${second.agent}\``;
  }

  return message;
}

/**
 * Get short skill description for suggestions
 */
function getSkillDescription(skill: string): string {
  const descriptions: Record<string, string> = {
    'implement': 'Full feature workflow',
    'explore': 'Understand existing code',
    'verify': 'Run tests and validations',
    'brainstorming': 'Design exploration',
    'review-pr': 'Code review',
    'fix-issue': 'Debug and fix',
    'assess': 'Quality assessment',
    'commit': 'Create commit',
  };
  return descriptions[skill] || skill;
}

/**
 * Agent auto-suggest hook
 *
 * Uses the new intent classifier for improved accuracy:
 * - Hybrid keyword + phrase + context scoring
 * - Calibration adjustments from outcome learning
 * - Negation detection to reduce false positives
 */
export function agentAutoSuggest(input: HookInput): HookResult {
  const prompt = input.prompt || '';

  // Quick filter using classifier's shouldClassify
  if (!shouldClassify(prompt)) {
    return outputSilentSuccess();
  }

  // Skip if agent-orchestrator is enabled (let it handle classification)
  const config = loadConfig();
  if (config.enableAutoDispatch) {
    // agent-orchestrator.ts will handle this
    logHook('agent-auto-suggest', 'Deferring to agent-orchestrator (auto-dispatch enabled)');
    return outputSilentSuccess();
  }

  logHook('agent-auto-suggest', 'Analyzing prompt with intent classifier...');

  // Get context for classification
  const history = getPromptHistory();
  const adjustments = getAdjustments();

  // Run classification
  const result = classifyIntent(prompt, history, adjustments);

  // Filter to top suggestions
  const matches = result.agents.slice(0, MAX_SUGGESTIONS);

  if (matches.length === 0) {
    logHook('agent-auto-suggest', 'No agent matches found');
    return outputSilentSuccess();
  }

  logHook(
    'agent-auto-suggest',
    `Found matches: ${matches.map(m => `${m.agent}:${m.confidence}`).join(', ')}`
  );

  // Build suggestion message (backward compatible format)
  const suggestionMessage = buildSuggestionMessage(matches);

  if (suggestionMessage) {
    logHook('agent-auto-suggest', `Suggesting ${matches[0].agent} at ${matches[0].confidence}%`);
    return outputPromptContext(suggestionMessage);
  }

  return outputSilentSuccess();
}

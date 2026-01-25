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
 * Build suggestion message based on confidence level
 * (Backward compatible message format)
 */
function buildSuggestionMessage(matches: AgentMatch[]): string {
  if (matches.length === 0) return '';

  const topMatch = matches[0];
  let message = '';

  if (topMatch.confidence >= THRESHOLDS.AUTO_DISPATCH) {
    // HIGH CONFIDENCE - Strong directive
    message = `## 🎯 AGENT DISPATCH RECOMMENDED

**Agent:** \`${topMatch.agent}\` (${topMatch.confidence}% confidence)

This task strongly matches the agent's specialization. **Spawn this agent:**

\`\`\`
Task tool with subagent_type: "${topMatch.agent}"
\`\`\`

Matched: ${topMatch.matchedKeywords.slice(0, 5).join(', ')}`;

  } else if (topMatch.confidence >= THRESHOLDS.STRONG_RECOMMEND) {
    // MEDIUM-HIGH - Recommendation
    message = `## Agent Recommendation

**RECOMMENDED:** \`${topMatch.agent}\` (${topMatch.confidence}% match)
${topMatch.description}

Matched keywords: ${topMatch.matchedKeywords.slice(0, 4).join(', ')}

Consider spawning with: \`Task tool, subagent_type: "${topMatch.agent}"\``;

  } else if (topMatch.confidence >= THRESHOLDS.SUGGEST) {
    // MEDIUM - Suggestion
    message = `## Agent Suggestion

**Consider:** \`${topMatch.agent}\` (${topMatch.confidence}% match)

This agent specializes in: ${topMatch.matchedKeywords.slice(0, 3).join(', ')}`;
  }

  // Add second match if exists and significant
  if (matches.length > 1 && matches[1].confidence >= THRESHOLDS.SUGGEST) {
    const second = matches[1];
    message += `\n\n**Alternative:** \`${second.agent}\` (${second.confidence}% match)`;
  }

  return message;
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

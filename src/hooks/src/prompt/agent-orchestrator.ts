/**
 * Agent Orchestrator - Main UserPromptSubmit Hook for Auto-Dispatch
 * Issue #197: Agent Orchestration Layer with CC 2.1.16 Task Integration
 *
 * At confidence >= 85%: AUTO-DISPATCH directive
 * At confidence 70-84%: Strong recommendation
 * At confidence 50-69%: Suggestion
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 * CC 2.1.16 Compliant: Outputs TaskCreate instructions for task management
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook } from '../lib/common.js';
import { classifyIntent, shouldClassify } from '../lib/intent-classifier.js';
import {
  loadConfig,
  addToPromptHistory,
  cacheClassification,
  isAgentDispatched,
  trackDispatchedAgent,
  getPromptHistory,
} from '../lib/orchestration-state.js';
import type {
  ClassificationResult,
  AgentMatch,
  TaskMetadata,
} from '../lib/orchestration-types.js';
import { THRESHOLDS } from '../lib/orchestration-types.js';

// -----------------------------------------------------------------------------
// Message Builders
// -----------------------------------------------------------------------------

/**
 * Build auto-dispatch directive message (conf >= 85%)
 */
function buildAutoDispatchMessage(match: AgentMatch, taskMeta: TaskMetadata): string {
  return `## 🎯 AUTO-DISPATCH: ${match.agent}

**Confidence:** ${match.confidence}% (auto-dispatch threshold: ${THRESHOLDS.AUTO_DISPATCH}%)

This task strongly matches the agent's specialization. **IMMEDIATELY spawn this agent:**

\`\`\`
Task tool with subagent_type: "${match.agent}"
\`\`\`

**Matched Keywords:** ${match.matchedKeywords.slice(0, 5).join(', ')}

### CC 2.1.16 Task Instruction
Before spawning, create a task to track this work:

\`\`\`json
TaskCreate:
{
  "subject": "${match.agent.replace(/-/g, ' ')} implementation",
  "description": "Agent dispatched automatically at ${match.confidence}% confidence",
  "activeForm": "Working on ${match.description.toLowerCase()}",
  "metadata": ${JSON.stringify(taskMeta)}
}
\`\`\`

After creating the task, spawn the agent with the task ID in the prompt.`;
}

/**
 * Build strong recommendation message (conf 70-84%)
 */
function buildStrongRecommendMessage(match: AgentMatch): string {
  return `## Agent Recommendation

**RECOMMENDED:** \`${match.agent}\` (${match.confidence}% confidence)

${match.description}

**Matched:** ${match.matchedKeywords.slice(0, 4).join(', ')}

**Spawn with:**
\`\`\`
Task tool with subagent_type: "${match.agent}"
\`\`\``;
}

/**
 * Build suggestion message (conf 50-69%)
 */
function buildSuggestionMessage(match: AgentMatch): string {
  return `## Agent Suggestion

**Consider:** \`${match.agent}\` (${match.confidence}% match)

This agent specializes in: ${match.matchedKeywords.slice(0, 3).join(', ')}`;
}

/**
 * Build alternative agent note
 */
function buildAlternativeNote(match: AgentMatch): string {
  return `\n\n**Alternative:** \`${match.agent}\` (${match.confidence}% match)`;
}

/**
 * Build the complete orchestration message
 */
function buildOrchestrationMessage(
  result: ClassificationResult,
  config: ReturnType<typeof loadConfig>
): string {
  if (result.agents.length === 0) {
    return '';
  }

  const topMatch = result.agents[0];
  let message = '';

  // Check if already dispatched
  if (isAgentDispatched(topMatch.agent)) {
    logHook('agent-orchestrator', `Agent ${topMatch.agent} already dispatched, skipping`);
    return '';
  }

  // Auto-dispatch at high confidence
  if (
    config.enableAutoDispatch &&
    topMatch.confidence >= THRESHOLDS.AUTO_DISPATCH
  ) {
    const taskMeta: TaskMetadata = {
      source: 'orchestration',
      dispatchedAgent: topMatch.agent,
      dispatchConfidence: topMatch.confidence,
      relatedSkills: result.skills.slice(0, 3).map(s => s.skill),
      dispatchSignals: topMatch.signals.slice(0, 5),
    };

    // Track the dispatch
    trackDispatchedAgent(topMatch.agent, topMatch.confidence);

    message = buildAutoDispatchMessage(topMatch, taskMeta);

  } else if (topMatch.confidence >= THRESHOLDS.STRONG_RECOMMEND) {
    // Strong recommendation
    message = buildStrongRecommendMessage(topMatch);

  } else if (topMatch.confidence >= THRESHOLDS.SUGGEST) {
    // Suggestion
    message = buildSuggestionMessage(topMatch);
  }

  // Add alternative if significant
  if (
    result.agents.length > 1 &&
    result.agents[1].confidence >= THRESHOLDS.SUGGEST
  ) {
    message += buildAlternativeNote(result.agents[1]);
  }

  return message;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Agent orchestrator hook - main entry point
 *
 * Analyzes user prompts and either:
 * 1. Auto-dispatches agents at 85%+ confidence
 * 2. Strongly recommends agents at 70-84%
 * 3. Suggests agents at 50-69%
 *
 * Also integrates with CC 2.1.16 task management.
 */
export function agentOrchestrator(input: HookInput): HookResult {
  const prompt = input.prompt || '';

  // Quick filter
  if (!shouldClassify(prompt)) {
    return outputSilentSuccess();
  }

  logHook('agent-orchestrator', 'Classifying intent for orchestration...');

  // Load config and state
  const config = loadConfig();
  const history = getPromptHistory();

  // Run classification
  const result = classifyIntent(prompt, history);

  // Cache classification for later use
  cacheClassification(result);

  // Add to prompt history
  addToPromptHistory(prompt.slice(0, 500)); // Truncate for storage

  // Log classification
  logHook(
    'agent-orchestrator',
    `Classification: intent=${result.intent}, ` +
    `agents=[${result.agents.map(a => `${a.agent}:${a.confidence}`).join(', ')}], ` +
    `autoDispatch=${result.shouldAutoDispatch}`
  );

  // No matches
  if (result.agents.length === 0) {
    logHook('agent-orchestrator', 'No agent matches found');
    return outputSilentSuccess();
  }

  // Build orchestration message
  const message = buildOrchestrationMessage(result, config);

  if (message) {
    return outputPromptContext(message);
  }

  return outputSilentSuccess();
}

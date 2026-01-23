/**
 * Mem0 Decision Saver Hook
 * Extracts and suggests saving design decisions after skill completion
 * Enhanced with graph memory support and category detection
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getPluginRoot } from '../lib/common.js';

// Decision indicators in skill output
const DECISION_INDICATORS = [
  'decided',
  'chose',
  'selected',
  'will use',
  'implemented',
  'architecture:',
  'pattern:',
  'approach:',
  'recommendation:',
  'best practice:',
  'conclusion:',
];

const MIN_OUTPUT_LENGTH = 100;
const MAX_TEXT_LENGTH = 10240; // 10KB limit for ReDoS prevention

/**
 * Detect decision category from text
 */
function detectDecisionCategory(text: string): string {
  // Limit input length for safety
  const safeText = text.slice(0, MAX_TEXT_LENGTH).toLowerCase();

  if (/pagination|cursor|offset/.test(safeText)) return 'pagination';
  if (/security|vulnerability|exploit|injection|xss|csrf|owasp|safety|guardrail/.test(safeText)) return 'security';
  if (/database|sql|postgres|schema|migration/.test(safeText)) return 'database';
  if (/api|endpoint|rest|graphql/.test(safeText)) return 'api';
  if (/auth|login|jwt|oauth/.test(safeText)) return 'authentication';
  if (/test|testing|pytest|jest|vitest|coverage|mock|fixture|spec/.test(safeText)) return 'testing';
  if (/deploy|ci|cd|pipeline|docker|kubernetes|helm|terraform/.test(safeText)) return 'deployment';
  if (/observability|monitoring|logging|tracing|metrics|prometheus|grafana|langfuse/.test(safeText)) return 'observability';
  if (/react|component|frontend|ui|tailwind/.test(safeText)) return 'frontend';
  if (/performance|optimization|cache|index/.test(safeText)) return 'performance';
  if (/llm|rag|embedding|vector|semantic|ai|ml|langchain|langgraph|mem0|openai|anthropic/.test(safeText)) return 'ai-ml';
  if (/etl|data.*pipeline|streaming|batch.*processing|dataflow|spark/.test(safeText)) return 'data-pipeline';
  if (/architecture|design|structure|pattern/.test(safeText)) return 'architecture';

  return 'decision';
}

/**
 * Check if output contains decision-worthy content
 */
function hasDecisionContent(output: string): boolean {
  const outputLower = output.toLowerCase();
  return DECISION_INDICATORS.some((indicator) => outputLower.includes(indicator));
}

/**
 * Extract decisions from output
 */
function extractDecisions(output: string): string[] {
  const decisions: string[] = [];

  for (const indicator of DECISION_INDICATORS) {
    const regex = new RegExp(`[^\\n]*${indicator}[^\\n]*`, 'gi');
    const matches = output.match(regex);
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        const cleaned = match.trim().slice(0, 300);
        if (cleaned.length > 30) {
          decisions.push(cleaned);
        }
      }
    }
  }

  // Deduplicate and return top 5
  return [...new Set(decisions)].slice(0, 5);
}

/**
 * Extract entity hints for graph memory
 */
function extractEntityHints(text: string): string {
  const entities: string[] = [];
  const textLower = text.toLowerCase();

  // Simple entity detection
  if (/postgres|database|db/.test(textLower)) entities.push('PostgreSQL');
  if (/fastapi|api/.test(textLower)) entities.push('FastAPI');
  if (/react|frontend/.test(textLower)) entities.push('React');
  if (/langchain|langgraph/.test(textLower)) entities.push('LangGraph');

  return entities.join(', ') || 'none detected';
}

/**
 * Extract and save design decisions to memory
 */
export function mem0DecisionSaver(input: HookInput): HookResult {
  // Extract skill info from hook input
  const skillName = (input as any).skill_name || input.tool_input?.skill || '';
  const skillOutput = (input as any).tool_result || (input as any).output || '';

  // Skip if no output or too short
  if (!skillOutput || skillOutput.length < MIN_OUTPUT_LENGTH) {
    return outputSilentSuccess();
  }

  // Check if output contains decision-worthy content
  if (!hasDecisionContent(skillOutput)) {
    return outputSilentSuccess();
  }

  // Extract decisions
  const extractedDecisions = extractDecisions(skillOutput);
  if (extractedDecisions.length === 0) {
    return outputSilentSuccess();
  }

  // Build storage recommendation
  const decisionsUserId = 'orchestkit:all-agents';
  const firstDecision = extractedDecisions[0];
  const category = detectDecisionCategory(firstDecision);
  const entityHints = extractEntityHints(firstDecision);
  const decisionCount = extractedDecisions.length;

  const pluginRoot = getPluginRoot();
  const scriptPath = `${pluginRoot}/skills/mem0-memory/scripts/crud/add-memory.py`;

  // Get agent context from environment
  const agentName = process.env.CLAUDE_AGENT_ID || (input as any).subagent_type || (input as any).agent_type || '';

  // Build metadata JSON
  const metadata: Record<string, unknown> = {
    category,
    source: 'orchestkit-plugin',
    skill: skillName || 'unknown',
    shared: false,
  };
  if (agentName) {
    metadata.agent_name = agentName;
  }

  const msg = `[Decision Extraction] Found ${decisionCount} decisions from ${skillName || 'skill'} (category: ${category})

To persist these decisions, execute:
bash ${scriptPath} --text "<decision content>" --user-id "${decisionsUserId}" --metadata '${JSON.stringify(metadata)}' --enable-graph

Note: Graph memory enabled by default (v1.2.0) - entities extracted: ${entityHints}

Example decision: "${firstDecision.slice(0, 100)}..."`;

  return {
    continue: true,
    systemMessage: msg,
  };
}

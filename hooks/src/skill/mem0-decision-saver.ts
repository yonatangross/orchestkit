/**
 * Mem0 Decision Saver Hook
 * Extracts and suggests saving design decisions after skill completion
 * Enhanced with graph memory support, category detection, and CC version tracking
 * CC 2.1.16 Compliant - Enriched metadata for decision-history skill (#204)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getPluginRoot } from '../lib/common.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// Best practice indicators
const BEST_PRACTICE_PATTERNS: Record<string, RegExp> = {
  'cursor-pagination': /cursor[- ]?(based)?[- ]?pagination/i,
  'jwt-validation': /jwt|json web token/i,
  'dependency-injection': /dependency injection|di pattern|ioc/i,
  'async-io': /async|await|asyncio|aiofiles/i,
  'eager-loading': /eager[- ]?load|prefetch|join.*load/i,
  'rate-limiting': /rate[- ]?limit|throttl/i,
  'circuit-breaker': /circuit[- ]?breaker|resilience/i,
  'event-sourcing': /event[- ]?sourc/i,
  'cqrs': /cqrs|command.*query.*separation/i,
  'webhook': /webhook|callback.*url/i,
  'idempotency': /idempoten/i,
  'optimistic-locking': /optimistic[- ]?lock|version.*field/i,
  'attention-aware-positioning': /start.*position|end.*position|attention/i,
  'progressive-loading': /progressive[- ]?load|lazy[- ]?load|on[- ]?demand/i,
};

// Importance keywords
const HIGH_IMPORTANCE_KEYWORDS = [
  'critical', 'security', 'breaking', 'migration', 'architecture',
  'performance', 'scalability', 'production', 'deploy', 'release'
];

const MEDIUM_IMPORTANCE_KEYWORDS = [
  'refactor', 'optimize', 'improve', 'update', 'enhance', 'fix'
];

/**
 * Cache for plugin version to avoid repeated file reads
 */
let cachedPluginVersion: string | null = null;

/**
 * Get Claude Code version from CLI or environment
 */
function getCCVersion(): string {
  try {
    // Try environment variable first (fast path)
    if (process.env.CLAUDE_CODE_VERSION) {
      return process.env.CLAUDE_CODE_VERSION;
    }

    // Try CLI version command
    const output = execSync('claude --version 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 2000,
    });
    const match = output.match(/(\d+\.\d+\.\d+)/);
    if (match) {
      return match[1];
    }
  } catch {
    // Fallback: detect from available features
    // TaskCreate tool available means >= 2.1.16
  }
  return '2.1.16'; // Default to current minimum requirement
}

/**
 * Get OrchestKit plugin version from plugin.json
 */
function getPluginVersion(): string {
  if (cachedPluginVersion !== null) {
    return cachedPluginVersion;
  }

  let version = 'unknown';

  try {
    const pluginRoot = getPluginRoot();
    const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');

    if (existsSync(pluginJsonPath)) {
      const content = readFileSync(pluginJsonPath, 'utf-8');
      const plugin = JSON.parse(content);
      version = plugin.version || 'unknown';
    }
  } catch {
    // Ignore errors, use default
  }

  cachedPluginVersion = version;
  return version;
}

/**
 * Detect importance level from decision text
 */
function detectImportance(text: string): 'high' | 'medium' | 'low' {
  const textLower = text.toLowerCase();

  // Check for high importance keywords
  for (const keyword of HIGH_IMPORTANCE_KEYWORDS) {
    if (textLower.includes(keyword)) {
      return 'high';
    }
  }

  // Check for medium importance keywords
  for (const keyword of MEDIUM_IMPORTANCE_KEYWORDS) {
    if (textLower.includes(keyword)) {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Extract best practice name from decision text
 */
function extractBestPractice(text: string): string | null {
  for (const [practice, pattern] of Object.entries(BEST_PRACTICE_PATTERNS)) {
    if (pattern.test(text)) {
      return practice;
    }
  }
  return null;
}

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

  // Get version information for enriched metadata (#204)
  const ccVersion = getCCVersion();
  const pluginVersion = getPluginVersion();
  const importance = detectImportance(firstDecision);
  const bestPractice = extractBestPractice(firstDecision);

  // Build enriched metadata JSON
  const metadata: Record<string, unknown> = {
    category,
    source: 'orchestkit-plugin',
    skill: skillName || 'unknown',
    shared: false,
    // Enriched fields for decision-history (#204)
    cc_version: ccVersion,
    plugin_version: pluginVersion,
    importance,
    timestamp: new Date().toISOString(),
  };
  if (agentName) {
    metadata.agent_name = agentName;
  }
  if (bestPractice) {
    metadata.best_practice = bestPractice;
  }

  const msg = `[Decision Extraction] Found ${decisionCount} decisions from ${skillName || 'skill'} (category: ${category})

To persist these decisions, execute:
bash ${scriptPath} --text "<decision content>" --user-id "${decisionsUserId}" --metadata '${JSON.stringify(metadata)}' --enable-graph

Note: Graph memory enabled by default (v1.2.0) - entities extracted: ${entityHints}
Metadata: CC ${ccVersion}, Plugin ${pluginVersion}, Importance: ${importance}${bestPractice ? `, Best Practice: ${bestPractice}` : ''}

Example decision: "${firstDecision.slice(0, 100)}..."`;

  return {
    continue: true,
    systemMessage: msg,
  };
}

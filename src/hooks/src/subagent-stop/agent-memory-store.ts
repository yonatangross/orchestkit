/**
 * Agent Memory Store - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Extracts and stores successful patterns after agent completion.
 *
 * Strategy:
 * - Parse agent output for decision patterns
 * - Extract key architectural choices
 * - Log patterns for graph memory storage
 * - Track agent performance metrics
 * - Detect categories for proper organization
 *
 * Version: 2.1.0 (graph-first)
 */

import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { basename, dirname } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, lineContainsAll } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DECISION_PATTERNS = [
  'decided to',
  'chose',
  'implemented using',
  'selected',
  'opted for',
  'will use',
  'pattern:',
  'approach:',
  'architecture:',
  'recommends',
  'best practice',
  'anti-pattern',
  'learned that',
];

const SCOPE_DECISIONS = 'decisions';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getPatternsLog(): string {
  return `${getProjectDir()}/.claude/logs/agent-patterns.jsonl`;
}

function getAgentTrackingDir(): string {
  return `${getProjectDir()}/.claude/session`;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getProjectId(): string {
  const projectDir = getProjectDir();
  const projectName = basename(projectDir) || 'default-project';
  return projectName
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function scopedId(scope: string): string {
  return `${getProjectId()}-${scope}`;
}

/**
 * Detect pattern category from text content
 */
function detectPatternCategory(text: string): string {
  // Security: Limit input length to prevent performance issues
  const maxLength = 10240;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
  const textLower = truncatedText.toLowerCase();

  if (/pagination|cursor|offset/.test(textLower)) {
    return 'pagination';
  }
  if (/security|vulnerability|exploit|injection|xss|csrf|owasp|safety|guardrail/.test(textLower)) {
    return 'security';
  }
  if (/database|sql|postgres|schema/.test(textLower)) {
    return 'database';
  }
  if (/\bapi\b|endpoint|\brest\b|graphql/.test(textLower)) {
    return 'api';
  }
  if (/auth|login|jwt|oauth/.test(textLower)) {
    return 'authentication';
  }
  if (/\btest\b|testing|pytest|jest|vitest|coverage|\bmock\b|fixture|\bspec\b/.test(textLower)) {
    return 'testing';
  }
  if (/deploy|\bci\b|\bcd\b|pipeline|docker|kubernetes|helm|terraform/.test(textLower)) {
    return 'deployment';
  }
  if (/observability|monitoring|logging|tracing|metrics|prometheus|grafana|langfuse/.test(textLower)) {
    return 'observability';
  }
  if (/react|component|frontend|\bui\b/.test(textLower)) {
    return 'frontend';
  }
  if (/performance|optimization|cache|index/.test(textLower)) {
    return 'performance';
  }
  if (/llm|\brag\b|embedding|vector|semantic|\bai\b|\bml\b|langchain|langgraph|openai|anthropic/.test(textLower)) {
    return 'ai-ml';
  }
  if (/etl|streaming|dataflow|spark/.test(textLower) || lineContainsAll(textLower, 'data', 'pipeline') || lineContainsAll(textLower, 'batch', 'processing')) {
    return 'data-pipeline';
  }
  if (/architecture|design|structure/.test(textLower)) {
    return 'architecture';
  }
  if (/decided|chose|selected/.test(textLower)) {
    return 'decision';
  }
  return 'pattern';
}

/**
 * Extract patterns from agent output
 */
function extractPatterns(output: string): string[] {
  const patterns: string[] = [];

  if (output.length < 50) {
    return patterns;
  }

  for (const pattern of DECISION_PATTERNS) {
    // ReDoS-safe: use line-based includes instead of polynomial regex ^.*pattern.*$
    const patternLower = pattern.toLowerCase();
    const matches = output.split('\n').filter(line =>
      line.toLowerCase().includes(patternLower)
    );

    for (const match of matches) {
      const cleaned = match.trim().substring(0, 200);
      if (cleaned.length > 20) {
        patterns.push(cleaned);
      }
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(patterns)];
  return unique.slice(0, 5);
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function agentMemoryStore(input: HookInput): HookResult {
  logHook('agent-memory-store', 'Agent memory store hook starting');

  const toolInput = input.tool_input || {};
  const agentType = input.subagent_type || (toolInput.subagent_type as string) || (toolInput.type as string) || '';
  const rawResult = input.tool_result;
  const agentOutput = typeof rawResult === 'string'
    ? rawResult
    : (rawResult?.content || input.agent_output || input.output || '');
  let success = true;

  // Check for error in output
  if (input.error) {
    success = false;
  }

  // Check for is_error in tool_result object
  if (typeof rawResult === 'object' && rawResult?.is_error) {
    success = false;
  }

  // If no agent type, silent success
  if (!agentType) {
    logHook('agent-memory-store', 'No agent type in input, skipping');
    return outputSilentSuccess();
  }

  // Build agent_id from AGENT_TYPE
  const agentId = `ork:${agentType}`;

  // Clean up tracking file to prevent stale data
  const trackingFile = `${getAgentTrackingDir()}/current-agent-id`;
  try {
    if (existsSync(trackingFile)) {
      unlinkSync(trackingFile);
    }
  } catch {
    // Ignore
  }

  logHook('agent-memory-store', `Processing completion for agent: ${agentType} (agent_id: ${agentId}, success: ${success})`);

  // Extract patterns (only if successful)
  const extractedPatterns = success && agentOutput ? extractPatterns(agentOutput) : [];

  if (extractedPatterns.length === 0) {
    logHook('agent-memory-store', `No patterns extracted from ${agentType} output`);
    return outputSilentSuccess();
  }

  // Log patterns for storage
  const patternsLog = getPatternsLog();
  const logDir = dirname(patternsLog);
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const projectId = getProjectId();
  const timestamp = new Date().toISOString();
  const decisionsId = scopedId(SCOPE_DECISIONS);

  for (const pattern of extractedPatterns) {
    const category = detectPatternCategory(pattern);

    const entry = {
      agent: agentType,
      agent_id: agentId,
      pattern: pattern,
      project: projectId,
      timestamp: timestamp,
      scope_id: decisionsId,
      category: category,
      pending_graph_sync: true,
    };

    try {
      bufferWrite(patternsLog, `${JSON.stringify(entry)}\n`);
    } catch {
      // Ignore
    }

    logHook('agent-memory-store', `Extracted pattern (${category}): ${pattern.substring(0, 50)}...`);
  }

  logHook('agent-memory-store', `Extracted ${extractedPatterns.length} patterns from ${agentType} output`);

  // Build suggestion message for graph storage
  const systemMsg = `[Pattern Extraction] ${extractedPatterns.length} patterns extracted from ${agentType}. To persist, use mcp__memory__create_entities with entities: [{"name": "${agentType}-pattern", "entityType": "Pattern", "observations": ["<pattern>"]}]`;

  return {
    continue: true,
    systemMessage: systemMsg,
  };
}

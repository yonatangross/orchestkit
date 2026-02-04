/**
 * Handoff Preparer - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Prepares context for handoff to next agent in pipeline.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const VALID_AGENTS = new Set([
  'market-intelligence',
  'product-strategist',
  'prioritization-analyst',
  'business-case-builder',
  'requirements-translator',
  'metrics-architect',
  'backend-system-architect',
  'code-quality-reviewer',
  'data-pipeline-engineer',
  'database-engineer',
  'debug-investigator',
  'frontend-ui-developer',
  'llm-integrator',
  'rapid-ui-designer',
  'security-auditor',
  'security-layer-auditor',
  'system-design-reviewer',
  'test-generator',
  'ux-researcher',
  'workflow-architect',
]);

// Pipeline mappings
const NEXT_AGENT_MAP: Record<string, string> = {
  // Product thinking pipeline
  'market-intelligence': 'product-strategist',
  'product-strategist': 'prioritization-analyst',
  'prioritization-analyst': 'business-case-builder',
  'business-case-builder': 'requirements-translator',
  'requirements-translator': 'metrics-architect',
  'metrics-architect': 'backend-system-architect',
  // Full-stack pipeline
  'backend-system-architect': 'frontend-ui-developer',
  'frontend-ui-developer': 'test-generator',
  'test-generator': 'code-quality-reviewer',
  'code-quality-reviewer': 'security-auditor',
  // AI integration pipeline
  'workflow-architect': 'llm-integrator',
  'llm-integrator': 'data-pipeline-engineer',
  'data-pipeline-engineer': 'code-quality-reviewer',
  // Database pipeline
  'database-engineer': 'backend-system-architect',
  // UI pipeline
  'rapid-ui-designer': 'frontend-ui-developer',
  'ux-researcher': 'rapid-ui-designer',
  // Terminal agents
  'security-auditor': 'none',
  'security-layer-auditor': 'none',
  'debug-investigator': 'none',
  'system-design-reviewer': 'none',
};

// Handoff suggestions
const SUGGESTIONS_MAP: Record<string, string> = {
  'market-intelligence': 'Next: product-strategist should define product vision based on market analysis',
  'product-strategist': 'Next: prioritization-analyst should rank features from strategy',
  'prioritization-analyst': 'Next: business-case-builder should create ROI justification',
  'business-case-builder': 'Next: requirements-translator should convert to technical specs',
  'requirements-translator': 'Next: metrics-architect should define success criteria',
  'metrics-architect': 'Next: backend-system-architect should design API endpoints',
  'backend-system-architect': 'Next: frontend-ui-developer should build UI components',
  'frontend-ui-developer': 'Next: test-generator should create test coverage',
  'test-generator': 'Next: code-quality-reviewer should validate implementation',
  'code-quality-reviewer': 'Next: security-auditor should perform security scan',
  'workflow-architect': 'Next: llm-integrator should configure LLM providers',
  'llm-integrator': 'Next: data-pipeline-engineer should set up embeddings',
  'data-pipeline-engineer': 'Next: code-quality-reviewer should validate data pipeline',
  'database-engineer': 'Next: backend-system-architect should integrate schema',
  'rapid-ui-designer': 'Next: frontend-ui-developer should implement designs',
  'ux-researcher': 'Next: rapid-ui-designer should create mockups',
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getNextAgent(agentName: string): string {
  return NEXT_AGENT_MAP[agentName] || 'none';
}

function getSuggestions(agentName: string): string {
  return SUGGESTIONS_MAP[agentName] || 'Pipeline complete';
}

interface HandoffContext {
  from_agent: string;
  to_agent: string;
  timestamp: string;
  summary: string;
  suggestions: string;
  status: string;
}

function writeHandoffFile(
  agentName: string,
  nextAgent: string,
  timestamp: string,
  summary: string,
  suggestions: string
): string {
  const handoffDir = `${getProjectDir()}/.claude/context/handoffs`;
  try {
    mkdirSync(handoffDir, { recursive: true });
  } catch {
    // Ignore
  }

  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
  const handoffFile = `${handoffDir}/${agentName}_to_${nextAgent}_${dateStr}.json`;

  const handoff: HandoffContext = {
    from_agent: agentName,
    to_agent: nextAgent,
    timestamp,
    summary,
    suggestions,
    status: 'ready_for_handoff',
  };

  try {
    writeFileSync(handoffFile, JSON.stringify(handoff, null, 2));
  } catch {
    // Ignore
  }

  return handoffFile;
}

function writeLogFile(
  agentName: string,
  nextAgent: string,
  timestamp: string,
  summary: string,
  suggestions: string,
  handoffFile: string
): void {
  const logDir = `${getProjectDir()}/.claude/logs/agent-handoffs`;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
  const logFile = `${logDir}/${agentName}_${dateStr}.log`;

  const logContent = `=== HANDOFF PREPARATION ===
From: ${agentName}
To: ${nextAgent}
Timestamp: ${timestamp}
Handoff file: ${handoffFile}

Summary: ${summary}

Next Steps: ${suggestions}
`;

  try {
    writeFileSync(logFile, logContent);
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function handoffPreparer(input: HookInput): HookResult {
  const timestamp = new Date().toISOString();

  const toolInput = input.tool_input || {};
  const agentName =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    'unknown';

  // Skip if not a valid pipeline agent
  if (!VALID_AGENTS.has(agentName)) {
    // Silent exit for non-pipeline agents (general-purpose, Explore, etc.)
    return outputSilentSuccess();
  }

  const nextAgent = getNextAgent(agentName);

  // Extract agent output
  const agentOutput = input.agent_output || input.output || '';

  // Generate handoff summary
  const outputLength = agentOutput.length;
  let summary: string;
  if (outputLength > 0) {
    summary = agentOutput.substring(0, 300);
    if (outputLength > 300) {
      summary += '...';
    }
  } else {
    summary = `Agent ${agentName} completed`;
  }

  // Get suggestions
  const suggestions = getSuggestions(agentName);

  // Create handoff context file
  const handoffFile = writeHandoffFile(agentName, nextAgent, timestamp, summary, suggestions);

  // Log to file
  writeLogFile(agentName, nextAgent, timestamp, summary, suggestions, handoffFile);

  return outputSilentSuccess();
}

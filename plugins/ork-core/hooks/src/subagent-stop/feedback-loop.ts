/**
 * Feedback Loop - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 * CC 2.1.16 Compliant: Integrates with Task Management System
 *
 * Purpose:
 * - Captures agent completion context
 * - Routes findings to relevant downstream agents
 * - Logs to decision-log.json
 * - Updates CC 2.1.16 Task status (Issue #197)
 *
 * Version: 2.0.0 (Task Integration)
 */

import { existsSync, writeFileSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId } from '../lib/common.js';
import { getTaskByAgent, updateTaskStatus, getActivePipeline } from '../lib/task-integration.js';
import { PIPELINES } from '../lib/multi-agent-coordinator.js';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getDecisionLog(): string {
  return `${getProjectDir()}/.claude/coordination/decision-log.json`;
}

function getFeedbackLog(): string {
  const logDir = `${getProjectDir()}/.claude/hooks/logs`;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }
  return `${logDir}/agent-feedback.log`;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function logFeedback(message: string): void {
  const logFile = getFeedbackLog();
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(logFile, `[${timestamp}] [feedback-loop] ${message}\n`);
  } catch {
    // Ignore
  }
}

/**
 * Get downstream agents from PIPELINES definitions or fallback mapping
 */
function getDownstreamAgents(agent: string): string {
  // First, check if agent is part of an active pipeline
  const activePipeline = getActivePipeline();
  if (activePipeline) {
    const pipelineDef = PIPELINES.find(p => p.type === activePipeline.type);
    if (pipelineDef) {
      // Find current step
      const currentStepIdx = pipelineDef.steps.findIndex(s => s.agent === agent);
      if (currentStepIdx >= 0) {
        // Get next steps that depend on this one
        const nextAgents = pipelineDef.steps
          .filter((s, idx) => s.dependsOn.includes(currentStepIdx) && idx > currentStepIdx)
          .map(s => s.agent);
        if (nextAgents.length > 0) {
          return nextAgents.join(' ');
        }
      }
    }
  }

  // Fallback: static mapping for non-pipeline scenarios
  const mapping: Record<string, string> = {
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
    'test-generator': 'security-auditor',
    // AI integration pipeline
    'workflow-architect': 'llm-integrator',
    'llm-integrator': 'data-pipeline-engineer',
    'data-pipeline-engineer': 'test-generator',
    // UI pipeline
    'rapid-ui-designer': 'frontend-ui-developer',
    'ux-researcher': 'rapid-ui-designer',
  };

  return mapping[agent] || '';
}

/**
 * Categorize feedback based on agent type
 */
function getFeedbackCategory(agent: string): string {
  const categories: Record<string, string> = {
    'market-intelligence': 'product-thinking',
    'product-strategist': 'product-thinking',
    'prioritization-analyst': 'product-thinking',
    'business-case-builder': 'product-thinking',
    'requirements-translator': 'specification',
    'metrics-architect': 'specification',
    'backend-system-architect': 'architecture',
    'database-engineer': 'architecture',
    'data-pipeline-engineer': 'architecture',
    'frontend-ui-developer': 'frontend',
    'rapid-ui-designer': 'frontend',
    'ux-researcher': 'frontend',
    'test-generator': 'quality',
    'code-quality-reviewer': 'quality',
    'security-auditor': 'security',
    'security-layer-auditor': 'security',
    'workflow-architect': 'ai-integration',
    'llm-integrator': 'ai-integration',
    'debug-investigator': 'debugging',
  };

  return categories[agent] || 'general';
}

/**
 * Get instance ID consistently
 */
function getInstanceId(): string {
  return process.env.CLAUDE_INSTANCE_ID || `${require('os').hostname()}-${process.pid}`;
}

function extractFindingsSummary(output: string): string {
  let summary = output.substring(0, 500);
  if (output.length > 500) {
    summary += '...';
  }
  return summary;
}

interface DecisionEntry {
  decision_id: string;
  timestamp: string;
  made_by: {
    instance_id: string;
    agent_type: string;
  };
  category: string;
  title: string;
  description: string;
  impact: {
    scope: string;
    downstream_agents: string[];
  };
  status: string;
  task_id?: string;  // CC 2.1.16 integration
}

interface DecisionLog {
  schema_version: string;
  log_created_at: string;
  decisions: DecisionEntry[];
}

function writeDecision(
  decisionId: string,
  agentType: string,
  category: string,
  summary: string,
  downstreamAgents: string,
  status: string,
  timestamp: string,
  taskId?: string
): void {
  const decisionLog = getDecisionLog();
  const logDir = decisionLog.substring(0, decisionLog.lastIndexOf('/'));

  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  let log: DecisionLog;
  if (existsSync(decisionLog)) {
    try {
      log = JSON.parse(readFileSync(decisionLog, 'utf8'));
    } catch {
      log = {
        schema_version: '2.0.0',
        log_created_at: timestamp,
        decisions: [],
      };
    }
  } else {
    log = {
      schema_version: '2.0.0',
      log_created_at: timestamp,
      decisions: [],
    };
  }

  const decisionEntry: DecisionEntry = {
    decision_id: decisionId,
    timestamp,
    made_by: {
      instance_id: getInstanceId(),
      agent_type: agentType,
    },
    category,
    title: `Agent ${agentType} completed`,
    description: summary,
    impact: {
      scope: 'agent-pipeline',
      downstream_agents: downstreamAgents.split(' ').filter(Boolean),
    },
    status,
    task_id: taskId,
  };

  log.decisions.push(decisionEntry);

  try {
    writeFileSync(decisionLog, JSON.stringify(log, null, 2));
    logFeedback(`Decision ${decisionId} logged for agent ${agentType}`);
  } catch {
    logFeedback('ERROR: Failed to write decision to log');
  }
}

interface HandoffContext {
  from_agent: string;
  to_agent: string;
  timestamp: string;
  decision_id: string;
  summary: string;
  session_id: string;
  status: string;
  feedback_loop: boolean;
  task_id?: string;  // CC 2.1.16 integration
}

function createHandoffContext(
  agentType: string,
  downstreamAgents: string,
  summary: string,
  decisionId: string,
  sessionId: string,
  timestamp: string,
  taskId?: string
): void {
  if (!downstreamAgents) {
    return;
  }

  const handoffDir = `${getProjectDir()}/.claude/context/handoffs`;
  try {
    mkdirSync(handoffDir, { recursive: true });
  } catch {
    // Ignore
  }

  const agents = downstreamAgents.split(' ').filter(Boolean);
  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);

  for (const downstream of agents) {
    const handoffFile = `${handoffDir}/${agentType}_to_${downstream}_${dateStr}.json`;

    const handoff: HandoffContext = {
      from_agent: agentType,
      to_agent: downstream,
      timestamp,
      decision_id: decisionId,
      summary,
      session_id: sessionId,
      status: 'pending',
      feedback_loop: true,
      task_id: taskId,
    };

    try {
      writeFileSync(handoffFile, JSON.stringify(handoff, null, 2));
      logFeedback(`Created handoff context: ${agentType} -> ${downstream}`);
    } catch {
      // Ignore
    }
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function feedbackLoop(input: HookInput): HookResult {
  const timestamp = new Date().toISOString();

  const toolInput = input.tool_input || {};
  const agentType =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    'unknown';
  const sessionId = input.session_id || getSessionId();
  const agentOutput = input.agent_output || input.output || '';
  const error = input.error || '';

  logFeedback(`Processing feedback for agent: ${agentType} (session: ${sessionId})`);

  // Skip if unknown agent type
  if (agentType === 'unknown' || !agentType) {
    logFeedback('Skipping unknown agent type');
    return outputSilentSuccess();
  }

  // Generate decision ID
  const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 8);
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  const decisionId = `DEC-${dateStr}-${randomNum}`;

  // CC 2.1.16: Look up associated task
  const task = getTaskByAgent(agentType);
  const taskId = task?.taskId;

  // Determine downstream agents (use pipeline-aware routing)
  const downstreamAgents = getDownstreamAgents(agentType);

  // Get feedback category
  const category = getFeedbackCategory(agentType);

  // Extract findings summary
  let summary: string;
  let status: string;
  if (error && error !== 'null') {
    summary = `Agent failed: ${error}`;
    status = 'failed';
  } else {
    summary = extractFindingsSummary(agentOutput);
    status = 'completed';
  }

  // CC 2.1.16: Update task status in registry
  if (taskId) {
    updateTaskStatus(taskId, status === 'completed' ? 'completed' : 'failed');
    logFeedback(`Updated task ${taskId} status to ${status}`);
  }

  // Write to decision log (now includes task_id)
  writeDecision(decisionId, agentType, category, summary, downstreamAgents, status, timestamp, taskId);

  // Create handoff context for downstream agents (now includes task_id)
  if (downstreamAgents) {
    createHandoffContext(agentType, downstreamAgents, summary, decisionId, sessionId, timestamp, taskId);
    logFeedback(`Routed findings to downstream agents: ${downstreamAgents}`);
  } else {
    logFeedback(`No downstream agents for ${agentType} (terminal agent)`);
  }

  // Log completion
  logFeedback(`=== AGENT FEEDBACK LOOP ===
Agent: ${agentType}
Category: ${category}
Decision ID: ${decisionId}
Task ID: ${taskId || 'none'}
Timestamp: ${timestamp}
Status: ${status}
Downstream: ${downstreamAgents || 'none'}

Summary: ${summary}`);

  // Output
  if (downstreamAgents) {
    return {
      continue: true,
      systemMessage: `Feedback loop: routed to ${downstreamAgents}${taskId ? ` (task: ${taskId})` : ''}`,
    };
  }

  return outputSilentSuccess();
}

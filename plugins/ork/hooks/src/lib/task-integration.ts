/**
 * Task Integration - Bridge to CC 2.1.16 Task Management System
 * Issue #197: Agent Orchestration Layer
 *
 * Provides utilities for:
 * - Generating task creation instructions
 * - Tracking task-to-agent relationships
 * - Managing task state for orchestration
 *
 * Note: This module generates INSTRUCTIONS for Claude to execute
 * task operations, as hooks cannot directly call CC tools.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getProjectDir, getSessionId, logHook } from './common.js';
import type {
  TaskCreateInstruction,
  TaskUpdateInstruction,
  TaskMetadata,
  PipelineExecution,
} from './orchestration-types.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Task tracking entry stored locally */
interface TaskEntry {
  taskId: string;
  agent: string;
  confidence: number;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  pipelineId?: string;
  pipelineStep?: number;
  blockedBy?: string[];
  blocks?: string[];
}

/** Task registry for session */
interface TaskRegistry {
  schemaVersion: string;
  sessionId: string;
  tasks: TaskEntry[];
  pipelines: PipelineExecution[];
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Registry File Management
// -----------------------------------------------------------------------------

function getRegistryFile(): string {
  const sessionId = getSessionId();
  return `${getProjectDir()}/.claude/orchestration/task-registry-${sessionId}.json`;
}

function ensureDir(): void {
  const dir = `${getProjectDir()}/.claude/orchestration`;
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

function loadRegistry(): TaskRegistry {
  const file = getRegistryFile();

  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      // Return default on error
    }
  }

  return {
    schemaVersion: '1.0.0',
    sessionId: getSessionId(),
    tasks: [],
    pipelines: [],
    updatedAt: new Date().toISOString(),
  };
}

function saveRegistry(registry: TaskRegistry): void {
  ensureDir();
  const file = getRegistryFile();
  registry.updatedAt = new Date().toISOString();

  try {
    writeFileSync(file, JSON.stringify(registry, null, 2));
  } catch (err) {
    logHook('task-integration', `Failed to save registry: ${err}`);
  }
}

// -----------------------------------------------------------------------------
// Task Instructions Generators
// -----------------------------------------------------------------------------

/**
 * Get action-specific activeForm based on agent type
 */
function getActiveFormForAgent(agent: string, description: string): string {
  const actionMap: Record<string, string> = {
    'backend-system-architect': 'Designing',
    'frontend-ui-developer': 'Building',
    'test-generator': 'Writing tests for',
    'security-auditor': 'Auditing',
    'workflow-architect': 'Architecting',
    'database-engineer': 'Implementing database for',
    'llm-integrator': 'Integrating LLM for',
    'code-quality-reviewer': 'Reviewing',
    'ux-researcher': 'Researching UX for',
    'product-strategist': 'Strategizing',
    'debug-investigator': 'Investigating',
    'performance-engineer': 'Optimizing',
    'accessibility-specialist': 'Auditing accessibility for',
    'infrastructure-architect': 'Designing infrastructure for',
    'data-pipeline-engineer': 'Building pipeline for',
  };

  const action = actionMap[agent] || 'Working on';
  const shortDesc = description.slice(0, 40).toLowerCase();
  return `${action} ${shortDesc}`;
}

/**
 * Generate TaskCreate instruction for an agent dispatch
 */
export function generateTaskCreateInstruction(
  agent: string,
  description: string,
  confidence: number,
  metadata?: Partial<TaskMetadata>
): TaskCreateInstruction {
  const agentTitle = agent
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fullMetadata: TaskMetadata = {
    source: 'orchestration',
    dispatchedAgent: agent,
    dispatchConfidence: confidence,
    ...metadata,
  };

  return {
    subject: `${agentTitle}: ${description.slice(0, 50)}`,
    description: `Agent dispatched automatically at ${confidence}% confidence.\n\n${description}`,
    activeForm: getActiveFormForAgent(agent, description),
    metadata: fullMetadata,
  };
}

/**
 * Generate TaskUpdate instruction for status change
 */
export function generateTaskUpdateInstruction(
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'deleted',
  blockedBy?: string[],
  blocks?: string[]
): TaskUpdateInstruction {
  const instruction: TaskUpdateInstruction = {
    taskId,
    status,
  };

  if (blockedBy && blockedBy.length > 0) {
    instruction.addBlockedBy = blockedBy;
  }

  if (blocks && blocks.length > 0) {
    instruction.addBlocks = blocks;
  }

  return instruction;
}

/**
 * Format TaskCreate instruction as markdown for Claude
 */
export function formatTaskCreateForClaude(instruction: TaskCreateInstruction): string {
  return `### Create Task for Tracking

\`\`\`
TaskCreate:
  subject: "${instruction.subject}"
  description: "${instruction.description}"
  activeForm: "${instruction.activeForm}"
  metadata:
    source: "${instruction.metadata.source}"
    dispatchedAgent: "${instruction.metadata.dispatchedAgent || ''}"
    dispatchConfidence: ${instruction.metadata.dispatchConfidence || 0}
\`\`\``;
}

/**
 * Generate TaskUpdate instruction for task deletion (CC 2.1.20)
 */
export function generateTaskDeleteInstruction(
  taskId: string,
  _reason: string
): TaskUpdateInstruction {
  return {
    taskId,
    status: 'deleted',
  };
}

/**
 * Format TaskDelete instruction as markdown for Claude (CC 2.1.20)
 */
export function formatTaskDeleteForClaude(taskId: string, reason: string): string {
  return `### Delete Orphaned Task

\`\`\`
TaskUpdate:
  taskId: "${taskId}"
  status: "deleted"
\`\`\`

**Reason**: ${reason}`;
}

/**
 * Format TaskUpdate instruction as markdown for Claude
 */
export function formatTaskUpdateForClaude(instruction: TaskUpdateInstruction): string {
  let md = `### Update Task

\`\`\`
TaskUpdate:
  taskId: "${instruction.taskId}"`;

  if (instruction.status) {
    md += `\n  status: "${instruction.status}"`;
  }

  if (instruction.addBlockedBy && instruction.addBlockedBy.length > 0) {
    md += `\n  addBlockedBy: ${JSON.stringify(instruction.addBlockedBy)}`;
  }

  if (instruction.addBlocks && instruction.addBlocks.length > 0) {
    md += `\n  addBlocks: ${JSON.stringify(instruction.addBlocks)}`;
  }

  md += '\n```';
  return md;
}

// -----------------------------------------------------------------------------
// Task Tracking Operations
// -----------------------------------------------------------------------------

/**
 * Register a new task for an agent
 */
export function registerTask(
  taskId: string,
  agent: string,
  confidence: number,
  pipelineId?: string,
  pipelineStep?: number,
  blockedBy?: string[],
  blocks?: string[]
): void {
  const registry = loadRegistry();

  // Check for duplicate
  const existing = registry.tasks.find(t => t.taskId === taskId);
  if (existing) {
    logHook('task-integration', `Task ${taskId} already registered`);
    return;
  }

  registry.tasks.push({
    taskId,
    agent,
    confidence,
    createdAt: new Date().toISOString(),
    status: 'pending',
    pipelineId,
    pipelineStep,
    blockedBy,
    blocks,
  });

  saveRegistry(registry);
  logHook('task-integration', `Registered task ${taskId} for agent ${agent}`);
}

/**
 * Update task status in registry
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskEntry['status']
): void {
  const registry = loadRegistry();

  const task = registry.tasks.find(t => t.taskId === taskId);
  if (task) {
    task.status = status;
    saveRegistry(registry);
    logHook('task-integration', `Updated task ${taskId} status to ${status}`);
  }
}

/**
 * Get task by agent name
 */
export function getTaskByAgent(agent: string): TaskEntry | undefined {
  const registry = loadRegistry();
  return registry.tasks.find(
    t => t.agent === agent && (t.status === 'pending' || t.status === 'in_progress')
  );
}

/**
 * Get task by ID
 */
export function getTaskById(taskId: string): TaskEntry | undefined {
  const registry = loadRegistry();
  return registry.tasks.find(t => t.taskId === taskId);
}

/**
 * Get pending tasks blocked by a specific failed task (CC 2.1.20)
 */
export function getTasksBlockedBy(failedTaskId: string): TaskEntry[] {
  const registry = loadRegistry();
  return registry.tasks.filter(
    t =>
      t.status === 'pending' &&
      t.blockedBy &&
      t.blockedBy.includes(failedTaskId)
  );
}

/**
 * Get orphaned tasks - pending tasks where all blockers have failed (CC 2.1.20)
 */
export function getOrphanedTasks(): TaskEntry[] {
  const registry = loadRegistry();
  const failedIds = new Set(
    registry.tasks.filter(t => t.status === 'failed').map(t => t.taskId)
  );

  if (failedIds.size === 0) return [];

  return registry.tasks.filter(t => {
    if (t.status !== 'pending' || !t.blockedBy || t.blockedBy.length === 0) {
      return false;
    }
    // Orphaned if ALL blockers are failed
    return t.blockedBy.every(id => failedIds.has(id));
  });
}

/**
 * Get all tasks for a pipeline
 */
export function getPipelineTasks(pipelineId: string): TaskEntry[] {
  const registry = loadRegistry();
  return registry.tasks
    .filter(t => t.pipelineId === pipelineId)
    .sort((a, b) => (a.pipelineStep || 0) - (b.pipelineStep || 0));
}

// -----------------------------------------------------------------------------
// Pipeline Operations
// -----------------------------------------------------------------------------

/**
 * Register a pipeline execution
 */
export function registerPipeline(pipeline: PipelineExecution): void {
  const registry = loadRegistry();

  // Check for duplicate
  const existing = registry.pipelines.find(p => p.pipelineId === pipeline.pipelineId);
  if (existing) {
    logHook('task-integration', `Pipeline ${pipeline.pipelineId} already registered`);
    return;
  }

  registry.pipelines.push(pipeline);
  saveRegistry(registry);
  logHook('task-integration', `Registered pipeline ${pipeline.pipelineId} (${pipeline.type})`);
}

/**
 * Update pipeline state
 */
export function updatePipeline(
  pipelineId: string,
  updates: Partial<PipelineExecution>
): void {
  const registry = loadRegistry();

  const pipeline = registry.pipelines.find(p => p.pipelineId === pipelineId);
  if (pipeline) {
    Object.assign(pipeline, updates);
    saveRegistry(registry);
    logHook('task-integration', `Updated pipeline ${pipelineId}`);
  }
}

/**
 * Get active pipeline (if any)
 */
export function getActivePipeline(): PipelineExecution | undefined {
  const registry = loadRegistry();
  return registry.pipelines.find(p => p.status === 'running');
}

/**
 * Mark pipeline step complete and check for next
 */
export function completePipelineStep(pipelineId: string, step: number): number | null {
  const registry = loadRegistry();

  const pipeline = registry.pipelines.find(p => p.pipelineId === pipelineId);
  if (!pipeline) return null;

  if (!pipeline.completedSteps.includes(step)) {
    pipeline.completedSteps.push(step);
    pipeline.completedSteps.sort((a, b) => a - b);
  }

  // Find next unblocked step
  const tasks = getPipelineTasks(pipelineId);
  for (const task of tasks) {
    const taskStep = task.pipelineStep;
    if (taskStep === undefined) continue;
    if (pipeline.completedSteps.includes(taskStep)) continue;
    if (task.status !== 'pending') continue;

    // Check if dependencies are met
    // For now, assume sequential - previous steps must be complete
    const prevStepsComplete = taskStep === 0 ||
      pipeline.completedSteps.includes(taskStep - 1);

    if (prevStepsComplete) {
      pipeline.currentStep = taskStep;
      saveRegistry(registry);
      return taskStep;
    }
  }

  // No more steps - pipeline complete
  pipeline.status = 'completed';
  saveRegistry(registry);
  return null;
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

/**
 * Clean up completed tasks older than threshold
 */
export function cleanupOldTasks(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const registry = loadRegistry();
  const cutoff = Date.now() - maxAgeMs;

  registry.tasks = registry.tasks.filter(t => {
    if (t.status === 'pending' || t.status === 'in_progress') return true;
    const taskTime = new Date(t.createdAt).getTime();
    return taskTime > cutoff;
  });

  registry.pipelines = registry.pipelines.filter(p => {
    if (p.status === 'running') return true;
    const pipelineTime = new Date(p.startedAt).getTime();
    return pipelineTime > cutoff;
  });

  saveRegistry(registry);
}

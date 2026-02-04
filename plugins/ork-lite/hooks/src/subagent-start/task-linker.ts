/**
 * Task Linker - SubagentStart Hook for CC 2.1.16 Task Integration
 * Issue #197: Agent Orchestration Layer
 *
 * Links spawned agents to their orchestration tasks:
 * 1. Looks up task by agent name in registry
 * 2. Updates task status to in_progress
 * 3. Updates agent tracking state
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import { getTaskByAgent, updateTaskStatus, formatTaskUpdateForClaude } from '../lib/task-integration.js';
import { updateAgentStatus } from '../lib/orchestration-state.js';

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Task linker hook - links spawned agents to orchestration tasks
 *
 * When an agent is spawned that was dispatched by the orchestration layer,
 * this hook:
 * 1. Finds the associated task in the registry
 * 2. Generates a TaskUpdate instruction to mark it in_progress
 * 3. Updates local tracking state
 */
export function taskLinker(input: HookInput): HookResult {
  // Get agent type from input
  const toolInput = input.tool_input || {};
  const agentType =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    '';

  if (!agentType) {
    logHook('task-linker', 'No agent type found, skipping');
    return outputSilentSuccess();
  }

  logHook('task-linker', `Processing SubagentStart for: ${agentType}`);

  // Look up task for this agent
  const task = getTaskByAgent(agentType);

  if (!task) {
    logHook('task-linker', `No orchestration task found for agent: ${agentType}`);
    return outputSilentSuccess();
  }

  logHook('task-linker', `Found task ${task.taskId} for agent ${agentType}`);

  // Update local registry
  updateTaskStatus(task.taskId, 'in_progress');

  // Update orchestration state
  updateAgentStatus(agentType, 'in_progress', task.taskId);

  // Generate TaskUpdate instruction for Claude
  const updateInstruction = formatTaskUpdateForClaude({
    taskId: task.taskId,
    status: 'in_progress',
  });

  const contextMessage = `## Orchestration: Task Linked

Agent \`${agentType}\` has been linked to task **${task.taskId}**.

${updateInstruction}

The task status should be updated to \`in_progress\`.`;

  logHook('task-linker', `Linked agent ${agentType} to task ${task.taskId}`);

  return outputWithContext(contextMessage);
}

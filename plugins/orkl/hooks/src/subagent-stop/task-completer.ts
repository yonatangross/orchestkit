/**
 * Task Completer - SubagentStop Hook for CC 2.1.16 Task Integration
 * Issue #197: Agent Orchestration Layer
 *
 * Handles agent completion for task management:
 * 1. Marks associated task as completed (or failed)
 * 2. Checks for newly unblocked tasks
 * 3. Handles pipeline progression
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import {
  getTaskByAgent,
  updateTaskStatus,
  getPipelineTasks,
  completePipelineStep,
  formatTaskUpdateForClaude,
  getTasksBlockedBy,
  formatTaskDeleteForClaude,
} from '../lib/task-integration.js';
import { updateAgentStatus, removeAgent } from '../lib/orchestration-state.js';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Determine if agent completed successfully
 */
function isSuccessfulCompletion(input: HookInput): boolean {
  const error = input.error || input.tool_error;
  const exitCode = input.exit_code;

  // Explicit error
  if (error && error !== 'null' && error !== '') {
    return false;
  }

  // Non-zero exit code
  if (exitCode !== undefined && exitCode !== 0) {
    return false;
  }

  // Check for error patterns in output
  const output = input.agent_output || input.output || '';
  const errorPatterns = [
    /\bfailed\b/i,
    /\berror:\s/i,
    /\bexception\b/i,
    /\bcould not\b/i,
    /\bunable to\b/i,
  ];

  // Only check first 500 chars to avoid false positives in long outputs
  const outputSample = output.slice(0, 500);
  for (const pattern of errorPatterns) {
    if (pattern.test(outputSample)) {
      // Weak signal - don't treat as failure unless explicit error
      logHook('task-completer', `Warning: possible error in output: ${pattern}`);
    }
  }

  return true;
}


// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Task completer hook - handles agent completion for task management
 *
 * When an agent completes, this hook:
 * 1. Finds the associated task
 * 2. Marks it completed or failed based on outcome
 * 3. For pipelines, checks for newly unblocked tasks
 * 4. Outputs instructions for next steps
 */
export function taskCompleter(input: HookInput): HookResult {
  // Get agent type from input
  const toolInput = input.tool_input || {};
  const agentType =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    '';

  if (!agentType) {
    logHook('task-completer', 'No agent type found, skipping');
    return outputSilentSuccess();
  }

  logHook('task-completer', `Processing SubagentStop for: ${agentType}`);

  // Look up task for this agent
  const task = getTaskByAgent(agentType);

  if (!task) {
    logHook('task-completer', `No orchestration task found for agent: ${agentType}`);
    // Still clean up agent state
    removeAgent(agentType);
    return outputSilentSuccess();
  }

  // Determine outcome
  const success = isSuccessfulCompletion(input);
  const newStatus = success ? 'completed' : 'failed';

  logHook('task-completer', `Agent ${agentType} completed with status: ${newStatus}`);

  // Update task status
  updateTaskStatus(task.taskId, newStatus);

  // Update orchestration state
  updateAgentStatus(agentType, newStatus);

  // Handle pipeline progression
  let contextMessage = `## Orchestration: Task ${success ? 'Completed' : 'Failed'}

Agent \`${agentType}\` has finished with status: **${newStatus}**

${formatTaskUpdateForClaude({
    taskId: task.taskId,
    status: success ? 'completed' : 'pending', // CC 2.1.16 tasks don't have 'failed' status
  })}
`;

  // Check for pipeline progression
  if (success && task.pipelineId && task.pipelineStep !== undefined) {
    const nextStep = completePipelineStep(task.pipelineId, task.pipelineStep);

    if (nextStep !== null) {
      const nextTasks = getPipelineTasks(task.pipelineId).filter(
        t => t.pipelineStep === nextStep && t.status === 'pending'
      );

      if (nextTasks.length > 0) {
        contextMessage += `
### Pipeline Progress

Pipeline \`${task.pipelineId}\` step ${task.pipelineStep} complete.
Next step (${nextStep}) is now unblocked.

**Next agent(s) to spawn:**
${nextTasks.map(t => `- \`${t.agent}\` (task: ${t.taskId})`).join('\n')}

Consider spawning the next agent to continue the pipeline.`;
      }
    } else {
      // Pipeline complete
      contextMessage += `
### Pipeline Complete

Pipeline \`${task.pipelineId}\` has completed all steps.`;
    }
  }

  // Handle failure
  if (!success) {
    const error = input.error || input.tool_error || 'Unknown error';
    contextMessage += `
### Error Details

The agent encountered an issue:
\`\`\`
${error.slice(0, 500)}
\`\`\`

Consider:
1. Retrying with more specific instructions
2. Using an alternative agent
3. Breaking down the task further`;

    // CC 2.1.20: Clean up orphaned tasks blocked by this failed task
    const orphanedTasks = getTasksBlockedBy(task.taskId);
    if (orphanedTasks.length > 0) {
      contextMessage += `\n\n### Orphaned Tasks (CC 2.1.20)\n\nThe following tasks were blocked by the failed task and should be deleted:\n`;
      for (const orphan of orphanedTasks) {
        contextMessage += `\n${formatTaskDeleteForClaude(orphan.taskId, `Blocked by failed task ${task.taskId} (agent: ${agentType})`)}`;
        updateTaskStatus(orphan.taskId, 'failed');
      }
    }
  }

  // Clean up agent tracking if complete
  if (newStatus === 'completed') {
    removeAgent(agentType);
  }

  logHook('task-completer', `Completed task ${task.taskId} with status ${newStatus}`);

  return outputWithContext(contextMessage);
}

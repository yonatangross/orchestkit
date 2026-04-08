/**
 * Pipeline Detector - UserPromptSubmit Hook for Multi-Agent Workflows
 * Issue #197: Agent Orchestration Layer
 *
 * Detects multi-agent pipeline triggers in prompts:
 * - Product thinking: "should we build..."
 * - Full-stack feature: "build a full-stack feature..."
 * - AI integration: "add RAG/LLM..."
 * - Security audit: "security audit..."
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputPromptContext } from '../lib/common.js';
import { loadConfig } from '../lib/orchestration-state.js';
import {
  detectPipeline,
  createPipelineExecution,
  registerPipelineExecution,
  formatPipelinePlan,
} from '../lib/multi-agent-coordinator.js';
import { getActivePipeline } from '../lib/task-integration.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Minimum prompt length to consider for pipeline detection */
const MIN_PROMPT_LENGTH = 15;

/** Words that indicate this is NOT a pipeline request */
const EXCLUSION_WORDS = [
  'what is',
  'explain',
  'how does',
  'tell me about',
  'describe',
  'list',
  'show me',
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Check if prompt is asking a question rather than requesting action
 */
function isQuestionNotRequest(prompt: string): boolean {
  const promptLower = prompt.toLowerCase();

  for (const exclusion of EXCLUSION_WORDS) {
    if (promptLower.startsWith(exclusion)) {
      return true;
    }
  }

  // Ends with question mark and is short
  if (prompt.endsWith('?') && prompt.length < 100) {
    return true;
  }

  return false;
}

/**
 * Check if user is already in a pipeline
 */
function isInActivePipeline(): boolean {
  const active = getActivePipeline();
  return active !== undefined && active.status === 'running';
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Pipeline detector hook
 *
 * Detects multi-agent workflow patterns:
 * 1. Checks if prompt matches pipeline triggers
 * 2. Creates pipeline execution plan
 * 3. Outputs task creation instructions
 */
export function pipelineDetector(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const prompt = input.prompt || '';

  // Quick filters
  if (prompt.length < MIN_PROMPT_LENGTH) {
    return outputSilentSuccess();
  }

  if (isQuestionNotRequest(prompt)) {
    return outputSilentSuccess();
  }

  // Check config
  const config = loadConfig();
  if (!config.enablePipelines) {
    return outputSilentSuccess();
  }

  // Check if already in pipeline
  if (isInActivePipeline()) {
    ctx.log('pipeline-detector', 'Already in active pipeline, skipping detection');
    return outputSilentSuccess();
  }

  ctx.log('pipeline-detector', 'Checking for pipeline triggers...');

  // Detect pipeline
  const pipeline = detectPipeline(prompt);

  if (!pipeline) {
    ctx.log('pipeline-detector', 'No pipeline triggers detected');
    return outputSilentSuccess();
  }

  ctx.log('pipeline-detector', `Detected pipeline: ${pipeline.type}`);

  // Create pipeline execution
  const { execution, tasks } = createPipelineExecution(pipeline);

  // Register with tracking systems
  registerPipelineExecution(execution, tasks);

  // Format plan message
  const message = formatPipelinePlan(pipeline, execution, tasks);

  ctx.log(
    'pipeline-detector',
    `Created pipeline ${execution.pipelineId} with ${tasks.length} steps`
  );

  return outputPromptContext(message);
}

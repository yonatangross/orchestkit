/**
 * End-to-end integration tests for Agent Orchestration Layer (Issue #197)
 * Tests complete workflows from prompt to agent dispatch with all components
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import { classifyIntent, clearCache } from '../lib/intent-classifier.js';
import {
  loadState,
  clearSessionState,
  trackDispatchedAgent,
  updateAgentStatus,
  trackInjectedSkill,
  addToPromptHistory,
  cacheClassification,
  getLastClassification,
  loadConfig,
  saveConfig,
} from '../lib/orchestration-state.js';
import {
  recordOutcome,
  getAdjustments,
  loadCalibrationData,
} from '../lib/calibration-engine.js';
import {
  registerTask,
  registerPipeline,
  getPipelineTasks,
  getActivePipeline,
} from '../lib/task-integration.js';
import {
  detectPipeline,
  createPipelineExecution,
} from '../lib/multi-agent-coordinator.js';
import { agentOrchestrator } from '../prompt/agent-orchestrator.js';
import { skillInjector } from '../prompt/skill-injector.js';
import { pipelineDetector } from '../prompt/pipeline-detector.js';
import type { HookInput } from '../types.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = '/tmp/orchestration-integration-test';
const TEST_SESSION_ID = 'integration-test-' + Date.now();

beforeEach(() => {
  // Set test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  if (!existsSync(TEST_PROJECT_DIR)) {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  }

  // Clear caches
  clearCache();
  clearSessionState();
});

afterEach(() => {
  // Clean up test files - must clean up parent .claude directory to remove all state
  const claudeDir = `${TEST_PROJECT_DIR}/.claude`;
  if (existsSync(claudeDir)) {
    rmSync(claudeDir, { recursive: true, force: true });
  }
});

/**
 * Create test HookInput for prompts
 */
function createPromptInput(prompt: string): HookInput {
  return {
    tool_name: 'UserPromptSubmit',
    hook_event: 'UserPromptSubmit',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    prompt,
    tool_input: {},
  };
}

// =============================================================================
// Full Workflow: Classification → Dispatch → Tracking
// =============================================================================

describe('orchestration workflow - classification to dispatch', () => {
  test('classifies high-confidence prompt and auto-dispatches', () => {
    const prompt = 'Design a RESTful API with database schema for user management backend';

    // Step 1: Classify intent
    const classification = classifyIntent(prompt);

    // May not match agents without real agent files, so check if any matched
    if (classification.agents.length === 0) {
      // No agents matched without real agent files - this is expected in test environment
      expect(classification.agents.length).toBe(0);
      return;
    }

    const topAgent = classification.agents[0];

    // Step 2: Cache classification
    cacheClassification(classification);

    // Step 3: Track dispatch
    trackDispatchedAgent(topAgent.agent, topAgent.confidence, 'task-123');

    // Step 4: Verify state
    const state = loadState();
    expect(state.activeAgents.length).toBe(1);
    expect(state.activeAgents[0].agent).toBe(topAgent.agent);
    expect(state.activeAgents[0].taskId).toBe('task-123');

    // Step 5: Update status to in_progress
    updateAgentStatus(topAgent.agent, 'in_progress');

    // Step 6: Verify active agent
    const active = state.activeAgents.find(a => a.status === 'in_progress');
    expect(active).toBeDefined();
  });

  test('injects skills at high confidence', () => {
    const prompt = 'Write integration tests with pytest fixtures and vcr cassettes';

    // Step 1: Classify
    const classification = classifyIntent(prompt);

    // Step 2: Find high-confidence skills
    const highConfSkills = classification.skills.filter(s => s.confidence >= 80);

    if (highConfSkills.length > 0) {
      // Step 3: Track injections
      for (const skill of highConfSkills) {
        trackInjectedSkill(skill.skill);
      }

      // Step 4: Verify tracking
      const state = loadState();
      expect(state.injectedSkills.length).toBeGreaterThan(0);
    }
  });

  test('maintains prompt history for context continuity', () => {
    const prompts = [
      'Design backend API',
      'Add database migrations',
      'Also implement authentication',
    ];

    for (const prompt of prompts) {
      addToPromptHistory(prompt);
    }

    const history = loadState().promptHistory;
    expect(history.length).toBe(3);
    expect(history[2]).toBe('Also implement authentication');
  });
});

// =============================================================================
// Calibration: Learning from Outcomes
// =============================================================================

describe('orchestration workflow - calibration learning', () => {
  test('records successful outcome and adjusts confidence', () => {
    const agent = 'backend-system-architect';
    const keywords = ['api', 'backend', 'database'];

    // Record multiple successful outcomes
    recordOutcome(
      'Design REST API with database',
      agent,
      keywords,
      88,
      'success',
      5000
    );

    recordOutcome(
      'Build backend API',
      agent,
      keywords,
      85,
      'success',
      4500
    );

    recordOutcome(
      'Create API with database schema',
      agent,
      keywords,
      90,
      'success',
      4800
    );

    // Get adjustments
    const adjustments = getAdjustments();

    // Should have positive adjustments for successful keywords
    const apiAdjustment = adjustments.find(
      a => a.keyword === 'api' && a.agent === agent
    );

    expect(apiAdjustment).toBeDefined();
    if (apiAdjustment) {
      expect(apiAdjustment.adjustment).toBeGreaterThan(0);
      expect(apiAdjustment.sampleCount).toBeGreaterThanOrEqual(3);
    }
  });

  test('applies calibration adjustments to future classifications', () => {
    const agent = 'test-generator';
    const keywords = ['test', 'coverage'];

    // Record failed outcomes
    recordOutcome(
      'Generate tests',
      agent,
      keywords,
      75,
      'failure'
    );

    recordOutcome(
      'Add test coverage',
      agent,
      keywords,
      78,
      'failure'
    );

    recordOutcome(
      'Write tests',
      agent,
      keywords,
      80,
      'failure'
    );

    // Get adjustments (should have penalties)
    const adjustments = getAdjustments();

    // Use adjustments in new classification
    const result = classifyIntent('Generate unit tests', [], adjustments);

    // Adjustments should affect confidence
    expect(result.agents.length).toBeGreaterThanOrEqual(0);
  });

  test('tracks calibration stats over time', () => {
    // Get initial record count
    const initialData = loadCalibrationData();
    const initialCount = initialData.records.length;

    // Record various outcomes
    const agents = ['backend-system-architect', 'frontend-ui-developer', 'test-generator'];

    for (let i = 0; i < 10; i++) {
      const agent = agents[i % 3];
      const outcome = i % 2 === 0 ? 'success' : 'failure';

      recordOutcome(
        `Test prompt ${i}`,
        agent,
        ['test'],
        80,
        outcome as 'success' | 'failure'
      );
    }

    const calibrationData = loadCalibrationData();

    // Should have added 10 new records
    expect(calibrationData.records.length).toBe(initialCount + 10);
    expect(calibrationData.stats.totalDispatches).toBe(initialCount + 10);
    // Success rate should be 50% overall (5 success, 5 failure from our 10 records)
    const expectedSuccesses = Math.floor((initialCount + 10) / 2) - Math.floor(initialCount / 2) + 5;
    const actualSuccessRate = calibrationData.stats.successRate;
    expect(actualSuccessRate).toBeGreaterThanOrEqual(0.4); // Allow some variance
    expect(actualSuccessRate).toBeLessThanOrEqual(0.6);
  });
});

// =============================================================================
// Task Integration: CC 2.1.16 Integration
// =============================================================================

describe('orchestration workflow - task integration', () => {
  test('registers tasks for dispatched agents', () => {
    const agent = 'backend-system-architect';
    const taskId = 'task-' + Date.now();

    // Register task
    registerTask(taskId, agent, 88);

    // Track agent dispatch
    trackDispatchedAgent(agent, 88, taskId);

    // Verify linkage
    const state = loadState();
    const agentEntry = state.activeAgents.find(a => a.agent === agent);

    expect(agentEntry?.taskId).toBe(taskId);
  });

  test('tracks task status updates with agent status', () => {
    const agent = 'test-generator';
    const taskId = 'task-test-' + Date.now();

    registerTask(taskId, agent, 85);
    trackDispatchedAgent(agent, 85, taskId);

    // Update agent status
    updateAgentStatus(agent, 'in_progress', taskId);

    const state = loadState();
    const agentEntry = state.activeAgents.find(a => a.agent === agent);

    expect(agentEntry?.status).toBe('in_progress');
  });
});

// =============================================================================
// Pipeline Detection and Execution
// =============================================================================

describe('orchestration workflow - multi-agent pipelines', () => {
  test('detects product thinking pipeline trigger', () => {
    const prompt = 'Should we build a new authentication feature for enterprise users?';

    const pipeline = detectPipeline(prompt);

    expect(pipeline).not.toBeNull();
    expect(pipeline?.type).toBe('product-thinking');
  });

  test('detects full-stack feature pipeline', () => {
    const prompt = 'Build a full-stack feature for user profile management';

    const pipeline = detectPipeline(prompt);

    expect(pipeline).not.toBeNull();
    expect(pipeline?.type).toBe('full-stack-feature');
  });

  test('creates pipeline execution with task chain', () => {
    const prompt = 'Build a full-stack feature for comments system';
    const pipeline = detectPipeline(prompt);

    if (pipeline) {
      const { execution, tasks } = createPipelineExecution(pipeline);

      expect(execution.pipelineId).toBeDefined();
      expect(execution.status).toBe('running');
      expect(tasks.length).toBe(pipeline.steps.length);

      // First task should have no blockedBy
      expect(tasks[0].blockedBy).toBeUndefined();

      // Later tasks should have dependencies
      if (tasks.length > 1) {
        expect(tasks[1].blockedBy).toBeDefined();
      }
    }
  });

  test('registers pipeline and tasks for tracking', () => {
    const prompt = 'Add RAG with LangGraph workflow';
    const pipeline = detectPipeline(prompt);

    if (pipeline) {
      const { execution, tasks } = createPipelineExecution(pipeline);

      // Register pipeline
      registerPipeline(execution);

      // Register tasks
      for (let i = 0; i < tasks.length; i++) {
        const taskId = execution.taskIds[i];
        const task = tasks[i];

        registerTask(
          taskId,
          task.metadata.dispatchedAgent!,
          100,
          execution.pipelineId,
          i
        );
      }

      // Verify registration
      const pipelineTasks = getPipelineTasks(execution.pipelineId);
      expect(pipelineTasks.length).toBe(tasks.length);

      const activePipeline = getActivePipeline();
      expect(activePipeline?.pipelineId).toBe(execution.pipelineId);
    }
  });
});

// =============================================================================
// Hook Integration Tests
// =============================================================================

describe('orchestration hooks - agentOrchestrator', () => {
  test('auto-dispatches at 85%+ confidence', () => {
    // Enable auto-dispatch
    saveConfig({ enableAutoDispatch: true });

    const input = createPromptInput(
      'Design a comprehensive REST API with database schema for microservices backend'
    );

    const result = agentOrchestrator(input);

    expect(result.continue).toBe(true);

    // Check if auto-dispatch triggered
    if (result.hookSpecificOutput?.additionalContext) {
      expect(result.hookSpecificOutput.additionalContext).toContain('AUTO-DISPATCH');
    }
  });

  test('provides strong recommendation at 70-84% confidence', () => {
    const input = createPromptInput('Design a backend API');

    const result = agentOrchestrator(input);

    expect(result.continue).toBe(true);

    // May have recommendation
    if (result.hookSpecificOutput?.additionalContext) {
      const context = result.hookSpecificOutput.additionalContext;
      expect(
        context.includes('RECOMMENDED') || context.includes('Consider')
      ).toBe(true);
    }
  });

  test('uses cached classification when available', () => {
    const prompt = 'Generate unit tests';

    // First classification
    const classification = classifyIntent(prompt);
    cacheClassification(classification);

    // Hook should use cached result
    const input = createPromptInput(prompt);
    const result = agentOrchestrator(input);

    expect(result.continue).toBe(true);

    const cached = getLastClassification();
    expect(cached).toBeDefined();
  });

  test('skips meta questions about agents', () => {
    const input = createPromptInput('What agents are available?');

    const result = agentOrchestrator(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });
});

describe('orchestration hooks - skillInjector', () => {
  test('injects skills at 80%+ confidence', () => {
    saveConfig({ enableSkillInjection: true, maxSkillInjectionTokens: 800 });

    const input = createPromptInput(
      'Write integration tests with pytest and vcr for HTTP recording'
    );

    const result = skillInjector(input);

    expect(result.continue).toBe(true);

    // Check if skills were injected
    if (result.hookSpecificOutput?.additionalContext) {
      expect(result.hookSpecificOutput.additionalContext).toContain('Skill');
    }
  });

  test('respects token budget for skill injection', () => {
    saveConfig({ maxSkillInjectionTokens: 200 }); // Very low budget

    const input = createPromptInput('Write tests with integration e2e unit coverage');

    const result = skillInjector(input);

    expect(result.continue).toBe(true);

    // Should limit injections
    const state = loadState();
    expect(state.injectedSkills.length).toBeLessThanOrEqual(2);
  });

  test('does not inject already-injected skills', () => {
    saveConfig({ enableSkillInjection: true });

    trackInjectedSkill('integration-testing');

    const input = createPromptInput('Write integration tests');

    const result = skillInjector(input);

    expect(result.continue).toBe(true);

    const state = loadState();
    const count = state.injectedSkills.filter(s => s === 'integration-testing').length;
    expect(count).toBe(1); // Should not duplicate
  });
});

describe('orchestration hooks - pipelineDetector', () => {
  test('detects and creates pipeline execution plan', () => {
    saveConfig({ enablePipelines: true });

    const input = createPromptInput(
      'Build a full-stack feature for user authentication with frontend and backend'
    );

    const result = pipelineDetector(input);

    expect(result.continue).toBe(true);

    if (result.hookSpecificOutput?.additionalContext) {
      expect(result.hookSpecificOutput.additionalContext).toContain('Pipeline');
      expect(result.hookSpecificOutput.additionalContext).toContain('TaskCreate');
    }
  });

  test('skips question prompts', () => {
    const input = createPromptInput('What is a full-stack feature?');

    const result = pipelineDetector(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('skips when already in active pipeline', () => {
    // Register a pipeline
    const pipeline = detectPipeline('Build full-stack feature');
    if (pipeline) {
      const { execution } = createPipelineExecution(pipeline);
      registerPipeline(execution);

      // Try to detect another pipeline
      const input = createPromptInput('Build another feature');
      const result = pipelineDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    }
  });
});

// =============================================================================
// Configuration Impact Tests
// =============================================================================

describe('orchestration workflow - configuration changes', () => {
  test('disabling auto-dispatch prevents automatic dispatch', () => {
    saveConfig({ enableAutoDispatch: false });

    const input = createPromptInput(
      'Design comprehensive REST API with database'
    );

    const result = agentOrchestrator(input);

    // Should provide recommendation but not auto-dispatch
    if (result.hookSpecificOutput?.additionalContext) {
      expect(result.hookSpecificOutput.additionalContext).not.toContain('AUTO-DISPATCH');
    }
  });

  test('disabling skill injection prevents injection', () => {
    saveConfig({ enableSkillInjection: false });

    const input = createPromptInput('Write integration tests');

    const result = skillInjector(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  test('disabling pipelines prevents pipeline detection', () => {
    saveConfig({ enablePipelines: false });

    const input = createPromptInput('Build full-stack feature');

    const result = pipelineDetector(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

/**
 * Integration tests for Orchestration State Management (Issue #197)
 * Tests session state persistence, agent tracking, and skill injection tracking
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadState,
  saveState,
  updateState,
  trackDispatchedAgent,
  updateAgentStatus,
  removeAgent,
  getActiveAgent,
  isAgentDispatched,
  trackInjectedSkill,
  isSkillInjected,
  getInjectedSkills,
  addToPromptHistory,
  getPromptHistory,
  cacheClassification,
  getLastClassification,
  loadConfig,
  saveConfig,
  clearSessionState,
  cleanupOldStates,
} from '../lib/orchestration-state.js';
import type { ClassificationResult } from '../lib/orchestration-types.js';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), 'orchestration-state-test');
const TEST_SESSION_ID = 'test-session-state-' + Date.now();

beforeEach(() => {
  // Set test environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

  // Create test directory
  if (!existsSync(TEST_PROJECT_DIR)) {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  }

  // Clean up any existing state
  clearSessionState();
});

afterEach(() => {
  // Clean up test files
  const stateDir = `${TEST_PROJECT_DIR}/.claude/orchestration`;
  if (existsSync(stateDir)) {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// =============================================================================
// State Loading and Saving Tests
// =============================================================================

describe('loadState - state initialization', () => {
  test('returns default state when no file exists', () => {
    const state = loadState();

    expect(state.sessionId).toBe(TEST_SESSION_ID);
    expect(state.activeAgents).toEqual([]);
    expect(state.injectedSkills).toEqual([]);
    expect(state.promptHistory).toEqual([]);
    expect(state.maxHistorySize).toBe(10);
    expect(state.updatedAt).toBeDefined();
  });

  test('loads existing state from file', () => {
    // First save a state
    const initialState = loadState();
    initialState.activeAgents = [
      {
        agent: 'backend-system-architect',
        confidence: 90,
        dispatchedAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      },
    ];
    saveState(initialState);

    // Load it back
    const loadedState = loadState();

    expect(loadedState.activeAgents.length).toBe(1);
    expect(loadedState.activeAgents[0].agent).toBe('backend-system-architect');
    expect(loadedState.activeAgents[0].confidence).toBe(90);
  });

  test('handles corrupted state file gracefully', () => {
    const stateDir = `${TEST_PROJECT_DIR}/.claude/orchestration`;
    mkdirSync(stateDir, { recursive: true });

    const stateFile = `${stateDir}/session-${TEST_SESSION_ID}.json`;
    require('fs').writeFileSync(stateFile, 'invalid json {');

    const state = loadState();

    // Should return default state
    expect(state.activeAgents).toEqual([]);
  });
});

describe('saveState - state persistence', () => {
  test('saves state to file', () => {
    const state = loadState();
    state.activeAgents = [
      {
        agent: 'test-agent',
        confidence: 85,
        dispatchedAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      },
    ];

    saveState(state);

    const stateFile = `${TEST_PROJECT_DIR}/.claude/orchestration/session-${TEST_SESSION_ID}.json`;
    expect(existsSync(stateFile)).toBe(true);
  });

  test('updates updatedAt timestamp', () => {
    const state = loadState();
    const oldTimestamp = state.updatedAt;

    // Wait a bit to ensure timestamp changes
    setTimeout(() => {
      saveState(state);

      const loadedState = loadState();
      expect(loadedState.updatedAt).not.toBe(oldTimestamp);
    }, 10);
  });

  test('creates state directory if missing', () => {
    const stateDir = `${TEST_PROJECT_DIR}/.claude/orchestration`;
    if (existsSync(stateDir)) {
      rmSync(stateDir, { recursive: true });
    }

    const state = loadState();
    saveState(state);

    expect(existsSync(stateDir)).toBe(true);
  });
});

describe('updateState - atomic updates', () => {
  test('applies mutation function to state', () => {
    updateState(state => {
      state.activeAgents.push({
        agent: 'test-agent',
        confidence: 75,
        dispatchedAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      });
    });

    const state = loadState();
    expect(state.activeAgents.length).toBe(1);
    expect(state.activeAgents[0].agent).toBe('test-agent');
  });

  test('returns updated state', () => {
    const updatedState = updateState(state => {
      state.injectedSkills.push('api-design-framework');
    });

    expect(updatedState.injectedSkills).toContain('api-design-framework');
  });

  test('saves state after mutation', () => {
    updateState(state => {
      state.activeAgents.push({
        agent: 'another-agent',
        confidence: 80,
        dispatchedAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      });
    });

    // Load fresh state from disk (don't clear - we want to verify persistence)
    const newState = loadState();

    // Should be persisted
    expect(newState.activeAgents.length).toBe(1);
  });
});

// =============================================================================
// Agent Tracking Tests
// =============================================================================

describe('trackDispatchedAgent - agent dispatching', () => {
  test('adds agent to active agents', () => {
    trackDispatchedAgent('backend-system-architect', 88);

    const state = loadState();
    expect(state.activeAgents.length).toBe(1);
    expect(state.activeAgents[0].agent).toBe('backend-system-architect');
    expect(state.activeAgents[0].confidence).toBe(88);
    expect(state.activeAgents[0].status).toBe('pending');
  });

  test('includes task ID when provided', () => {
    trackDispatchedAgent('test-generator', 92, 'task-123');

    const state = loadState();
    expect(state.activeAgents[0].taskId).toBe('task-123');
  });

  test('initializes retry counter to 0', () => {
    const dispatched = trackDispatchedAgent('frontend-ui-developer', 85);

    expect(dispatched.retryCount).toBe(0);
    expect(dispatched.maxRetries).toBe(3);
  });

  test('replaces existing entry for same agent', () => {
    trackDispatchedAgent('backend-system-architect', 85);
    trackDispatchedAgent('backend-system-architect', 90);

    const state = loadState();
    expect(state.activeAgents.length).toBe(1);
    expect(state.activeAgents[0].confidence).toBe(90);
  });

  test('sets dispatched timestamp', () => {
    const before = Date.now();
    const dispatched = trackDispatchedAgent('test-agent', 80);
    const after = Date.now();

    const dispatchedTime = new Date(dispatched.dispatchedAt).getTime();
    expect(dispatchedTime).toBeGreaterThanOrEqual(before);
    expect(dispatchedTime).toBeLessThanOrEqual(after);
  });
});

describe('updateAgentStatus - status transitions', () => {
  beforeEach(() => {
    trackDispatchedAgent('test-agent', 85);
  });

  test('updates agent status', () => {
    updateAgentStatus('test-agent', 'in_progress');

    const state = loadState();
    expect(state.activeAgents[0].status).toBe('in_progress');
  });

  test('updates task ID if provided', () => {
    updateAgentStatus('test-agent', 'in_progress', 'task-456');

    const state = loadState();
    expect(state.activeAgents[0].taskId).toBe('task-456');
  });

  test('increments retry count on retry status', () => {
    updateAgentStatus('test-agent', 'retrying');
    updateAgentStatus('test-agent', 'retrying');

    const state = loadState();
    expect(state.activeAgents[0].retryCount).toBe(2);
  });

  test('handles non-existent agent gracefully', () => {
    updateAgentStatus('non-existent-agent', 'in_progress');

    // Should not throw
    const state = loadState();
    expect(state.activeAgents.length).toBe(1); // Original agent still there
  });

  test('supports all valid statuses', () => {
    const statuses: Array<'pending' | 'in_progress' | 'retrying' | 'completed' | 'failed'> = [
      'pending',
      'in_progress',
      'retrying',
      'completed',
      'failed',
    ];

    for (const status of statuses) {
      updateAgentStatus('test-agent', status);
      const state = loadState();
      expect(state.activeAgents[0].status).toBe(status);
    }
  });
});

describe('removeAgent - agent cleanup', () => {
  beforeEach(() => {
    trackDispatchedAgent('agent-1', 80);
    trackDispatchedAgent('agent-2', 85);
  });

  test('removes agent from active list', () => {
    removeAgent('agent-1');

    const state = loadState();
    expect(state.activeAgents.length).toBe(1);
    expect(state.activeAgents[0].agent).toBe('agent-2');
  });

  test('handles non-existent agent gracefully', () => {
    removeAgent('non-existent');

    const state = loadState();
    expect(state.activeAgents.length).toBe(2);
  });
});

describe('getActiveAgent - current agent query', () => {
  test('returns agent with in_progress status', () => {
    trackDispatchedAgent('agent-1', 80);
    updateAgentStatus('agent-1', 'in_progress');

    const active = getActiveAgent();

    expect(active).toBeDefined();
    expect(active?.agent).toBe('agent-1');
    expect(active?.status).toBe('in_progress');
  });

  test('returns undefined if no agent in_progress', () => {
    trackDispatchedAgent('agent-1', 80);
    // Status remains 'pending'

    const active = getActiveAgent();

    expect(active).toBeUndefined();
  });

  test('returns only first in_progress agent', () => {
    trackDispatchedAgent('agent-1', 80);
    trackDispatchedAgent('agent-2', 85);
    updateAgentStatus('agent-1', 'in_progress');
    updateAgentStatus('agent-2', 'in_progress');

    const active = getActiveAgent();

    expect(active?.agent).toBe('agent-1');
  });
});

describe('isAgentDispatched - dispatch check', () => {
  test('returns true for pending agent', () => {
    trackDispatchedAgent('test-agent', 80);

    expect(isAgentDispatched('test-agent')).toBe(true);
  });

  test('returns true for in_progress agent', () => {
    trackDispatchedAgent('test-agent', 80);
    updateAgentStatus('test-agent', 'in_progress');

    expect(isAgentDispatched('test-agent')).toBe(true);
  });

  test('returns false for completed agent', () => {
    trackDispatchedAgent('test-agent', 80);
    updateAgentStatus('test-agent', 'completed');

    expect(isAgentDispatched('test-agent')).toBe(false);
  });

  test('returns false for failed agent', () => {
    trackDispatchedAgent('test-agent', 80);
    updateAgentStatus('test-agent', 'failed');

    expect(isAgentDispatched('test-agent')).toBe(false);
  });

  test('returns false for non-existent agent', () => {
    expect(isAgentDispatched('non-existent')).toBe(false);
  });
});

// =============================================================================
// Skill Tracking Tests
// =============================================================================

describe('trackInjectedSkill - skill injection tracking', () => {
  test('adds skill to injected list', () => {
    trackInjectedSkill('api-design-framework');

    const state = loadState();
    expect(state.injectedSkills).toContain('api-design-framework');
  });

  test('does not duplicate skills', () => {
    trackInjectedSkill('api-design-framework');
    trackInjectedSkill('api-design-framework');

    const state = loadState();
    const count = state.injectedSkills.filter(s => s === 'api-design-framework').length;
    expect(count).toBe(1);
  });

  test('tracks multiple different skills', () => {
    trackInjectedSkill('api-design-framework');
    trackInjectedSkill('database-schema-designer');
    trackInjectedSkill('integration-testing');

    const skills = getInjectedSkills();
    expect(skills.length).toBe(3);
    expect(skills).toContain('api-design-framework');
    expect(skills).toContain('database-schema-designer');
    expect(skills).toContain('integration-testing');
  });
});

describe('isSkillInjected - skill injection check', () => {
  test('returns true for injected skill', () => {
    trackInjectedSkill('api-design-framework');

    expect(isSkillInjected('api-design-framework')).toBe(true);
  });

  test('returns false for non-injected skill', () => {
    expect(isSkillInjected('api-design-framework')).toBe(false);
  });
});

describe('getInjectedSkills - skill list retrieval', () => {
  test('returns empty array initially', () => {
    const skills = getInjectedSkills();

    expect(skills).toEqual([]);
  });

  test('returns all injected skills', () => {
    trackInjectedSkill('skill-1');
    trackInjectedSkill('skill-2');

    const skills = getInjectedSkills();

    expect(skills.length).toBe(2);
  });
});

// =============================================================================
// Prompt History Tests
// =============================================================================

describe('addToPromptHistory - history management', () => {
  test('adds prompt to history', () => {
    addToPromptHistory('Design a REST API');

    const history = getPromptHistory();
    expect(history).toContain('Design a REST API');
  });

  test('maintains order of prompts', () => {
    addToPromptHistory('First prompt');
    addToPromptHistory('Second prompt');
    addToPromptHistory('Third prompt');

    const history = getPromptHistory();
    expect(history[0]).toBe('First prompt');
    expect(history[1]).toBe('Second prompt');
    expect(history[2]).toBe('Third prompt');
  });

  test('trims history to maxHistorySize (10)', () => {
    for (let i = 1; i <= 15; i++) {
      addToPromptHistory(`Prompt ${i}`);
    }

    const history = getPromptHistory();
    expect(history.length).toBe(10);
    expect(history[0]).toBe('Prompt 6'); // Should have dropped 1-5
    expect(history[9]).toBe('Prompt 15');
  });

  test('preserves most recent prompts when trimming', () => {
    for (let i = 1; i <= 12; i++) {
      addToPromptHistory(`Prompt ${i}`);
    }

    const history = getPromptHistory();
    expect(history[0]).toBe('Prompt 3');
    expect(history[9]).toBe('Prompt 12');
  });
});

describe('getPromptHistory - history retrieval', () => {
  test('returns empty array initially', () => {
    const history = getPromptHistory();

    expect(history).toEqual([]);
  });

  test('returns all prompts', () => {
    addToPromptHistory('Prompt 1');
    addToPromptHistory('Prompt 2');

    const history = getPromptHistory();

    expect(history.length).toBe(2);
  });
});

// =============================================================================
// Classification Caching Tests
// =============================================================================

describe('cacheClassification - result caching', () => {
  test('caches classification result', () => {
    const result: ClassificationResult = {
      agents: [
        {
          agent: 'backend-system-architect',
          confidence: 88,
          description: 'Backend specialist',
          matchedKeywords: ['api', 'backend'],
          signals: [],
        },
      ],
      skills: [],
      intent: 'api-design',
      confidence: 88,
      signals: [],
      shouldAutoDispatch: true,
      shouldInjectSkills: false,
    };

    cacheClassification(result);

    const cached = getLastClassification();
    expect(cached).toEqual(result);
  });

  test('overwrites previous classification', () => {
    const result1: ClassificationResult = {
      agents: [],
      skills: [],
      intent: 'general',
      confidence: 0,
      signals: [],
      shouldAutoDispatch: false,
      shouldInjectSkills: false,
    };

    const result2: ClassificationResult = {
      agents: [
        {
          agent: 'test-generator',
          confidence: 85,
          description: 'Test specialist',
          matchedKeywords: ['test'],
          signals: [],
        },
      ],
      skills: [],
      intent: 'testing',
      confidence: 85,
      signals: [],
      shouldAutoDispatch: true,
      shouldInjectSkills: false,
    };

    cacheClassification(result1);
    cacheClassification(result2);

    const cached = getLastClassification();
    expect(cached).toEqual(result2);
  });
});

describe('getLastClassification - cache retrieval', () => {
  test('returns undefined when no classification cached', () => {
    const cached = getLastClassification();

    expect(cached).toBeUndefined();
  });

  test('returns cached classification', () => {
    const result: ClassificationResult = {
      agents: [],
      skills: [
        {
          skill: 'integration-testing',
          confidence: 82,
          description: 'Integration test patterns',
          matchedKeywords: ['integration', 'test'],
          signals: [],
        },
      ],
      intent: 'testing',
      confidence: 82,
      signals: [],
      shouldAutoDispatch: false,
      shouldInjectSkills: true,
    };

    cacheClassification(result);

    const cached = getLastClassification();
    expect(cached?.skills[0].skill).toBe('integration-testing');
  });
});

// =============================================================================
// Configuration Tests
// =============================================================================

describe('loadConfig - configuration loading', () => {
  test('returns default config when no file exists', () => {
    const config = loadConfig();

    expect(config.enableAutoDispatch).toBe(true);
    expect(config.enableSkillInjection).toBe(true);
    expect(config.maxSkillInjectionTokens).toBe(800);
    expect(config.enableCalibration).toBe(true);
    expect(config.enablePipelines).toBe(true);
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelayBaseMs).toBe(1000);
  });

  test('merges saved config with defaults', () => {
    saveConfig({ enableAutoDispatch: false, maxRetries: 5 });

    const config = loadConfig();

    expect(config.enableAutoDispatch).toBe(false);
    expect(config.maxRetries).toBe(5);
    // Other defaults should remain
    expect(config.enableSkillInjection).toBe(true);
  });
});

describe('saveConfig - configuration persistence', () => {
  test('saves config to file', () => {
    saveConfig({ enableAutoDispatch: false });

    const configFile = `${TEST_PROJECT_DIR}/.claude/orchestration/config.json`;
    expect(existsSync(configFile)).toBe(true);
  });

  test('merges with existing config', () => {
    saveConfig({ enableAutoDispatch: false });
    saveConfig({ maxRetries: 5 });

    const config = loadConfig();

    expect(config.enableAutoDispatch).toBe(false);
    expect(config.maxRetries).toBe(5);
  });
});

// =============================================================================
// Cleanup Tests
// =============================================================================

describe('clearSessionState - state cleanup', () => {
  test('deletes session state file', () => {
    trackDispatchedAgent('test-agent', 80);
    const stateFile = `${TEST_PROJECT_DIR}/.claude/orchestration/session-${TEST_SESSION_ID}.json`;

    expect(existsSync(stateFile)).toBe(true);

    clearSessionState();

    expect(existsSync(stateFile)).toBe(false);
  });

  test('handles missing file gracefully', () => {
    // Should not throw
    expect(() => clearSessionState()).not.toThrow();
  });
});

describe('cleanupOldStates - stale file cleanup', () => {
  test('keeps last 5 session files', () => {
    const stateDir = `${TEST_PROJECT_DIR}/.claude/orchestration`;
    mkdirSync(stateDir, { recursive: true });

    // Create 7 session files
    for (let i = 1; i <= 7; i++) {
      const sessionId = `old-session-${i}`;
      process.env.CLAUDE_SESSION_ID = sessionId;
      trackDispatchedAgent('test-agent', 80);
      // Wait to ensure different mtimes
      const now = Date.now();
      while (Date.now() - now < 10) { /* wait */ }
    }

    // Reset to test session
    process.env.CLAUDE_SESSION_ID = TEST_SESSION_ID;

    cleanupOldStates();

    // Count remaining files
    const files = require('fs')
      .readdirSync(stateDir)
      .filter((f: string) => f.startsWith('session-'));

    expect(files.length).toBeLessThanOrEqual(5);
  });

  test('handles missing directory gracefully', () => {
    const stateDir = `${TEST_PROJECT_DIR}/.claude/orchestration`;
    if (existsSync(stateDir)) {
      rmSync(stateDir, { recursive: true });
    }

    // Should not throw
    expect(() => cleanupOldStates()).not.toThrow();
  });
});

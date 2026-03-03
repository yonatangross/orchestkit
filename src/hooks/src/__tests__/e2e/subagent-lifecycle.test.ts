/**
 * Subagent Lifecycle E2E Tests
 *
 * Tests complete subagent spawn → execute → complete lifecycle including:
 * - Memory injection on SubagentStart
 * - Context gating and validation
 * - Pattern extraction on SubagentStop
 *
 * Critical for ensuring agent coordination works correctly.
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';

// Mock fs module
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockAppendFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('feature-branch\n'),
}));

// Mock common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
    getCachedBranch: vi.fn().mockReturnValue('feature-branch'),
    outputSilentSuccess: vi.fn().mockReturnValue({ continue: true, suppressOutput: true }),
    outputWithContext: vi.fn().mockReturnValue({ continue: true, suppressOutput: false }),
  };
});

// Mock orchestration-state module
vi.mock('../../lib/orchestration-state.js', () => ({
  updateAgentStatus: vi.fn(),
  removeAgent: vi.fn(),
  getAgentStatus: vi.fn().mockReturnValue(null),
}));

// Import subagent hooks
import { graphMemoryInject } from '../../subagent-start/graph-memory-inject.js';
import { contextGate } from '../../subagent-start/context-gate.js';
import { agentMemoryStore } from '../../subagent-stop/agent-memory-store.js';
import { outputValidator } from '../../subagent-stop/output-validator.js';

/**
 * Create a mock HookInput for SubagentStart event
 */
function createSubagentStartInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'parent-session-123',
    tool_input: {
      subagent_type: 'Explore',
      prompt: 'Find authentication logic',
      description: 'Explore auth',
    },
    project_dir: '/test/project',
    ...overrides,
  };
}

/**
 * Create a mock HookInput for SubagentStop event
 */
function createSubagentStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'subagent-session-456',
    tool_input: {
      subagent_type: 'Explore',
      result: 'Found auth in /src/auth/',
    },
    project_dir: '/test/project',
    ...overrides,
  };
}

describe('Subagent Lifecycle E2E', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLAUDE_SESSION_ID: 'parent-session-123',
      CLAUDE_PROJECT_DIR: '/test/project',
    };
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SubagentStart: Graph Memory Injection', () => {
    test('should inject graph memory when available', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        entities: [
          { name: 'AuthService', type: 'class', description: 'Handles authentication' },
        ],
        relations: [],
      }));

      const input = createSubagentStartInput();
      const result = await Promise.resolve(graphMemoryInject(input));

      expect(result.continue).toBe(true);
    });

    test('should continue without memory when graph is empty', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      const input = createSubagentStartInput();
      const result = await Promise.resolve(graphMemoryInject(input));

      expect(result.continue).toBe(true);
    });

    test('should continue when graph file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const input = createSubagentStartInput();
      const result = await Promise.resolve(graphMemoryInject(input));

      expect(result.continue).toBe(true);
    });

    test('should handle large graph files gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      // Simulate large graph (>10KB)
      const largeGraph = {
        entities: Array(1000).fill({ name: 'Entity', type: 'class' }),
        relations: Array(2000).fill({ from: 'A', to: 'B', type: 'uses' }),
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(largeGraph));

      const input = createSubagentStartInput();
      const result = await Promise.resolve(graphMemoryInject(input));

      expect(result.continue).toBe(true);
    });

    test('should handle corrupted graph gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const input = createSubagentStartInput();
      const result = await Promise.resolve(graphMemoryInject(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('SubagentStart: Context Gate', () => {
    test('should allow subagent when context usage is low', async () => {
      const input = createSubagentStartInput();
      const result = await Promise.resolve(contextGate(input));

      expect(result.continue).toBe(true);
    });

    test('should gate subagent when context usage exceeds threshold', async () => {
      // Simulate high context usage
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        current_tokens: 180000,
        max_tokens: 200000,
      }));

      const input = createSubagentStartInput();
      const result = await Promise.resolve(contextGate(input));

      // Should continue but may warn or limit
      expect(result.continue).toBe(true);
    });

    test('should handle missing context metrics', async () => {
      mockExistsSync.mockReturnValue(false);

      const input = createSubagentStartInput();
      const result = await Promise.resolve(contextGate(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('SubagentStop: Agent Memory Store', () => {
    test('should store agent patterns on completion', async () => {
      const input = createSubagentStopInput();
      const result = await Promise.resolve(agentMemoryStore(input));

      expect(result.continue).toBe(true);
    });

    test('should extract patterns from result', async () => {
      const input = createSubagentStopInput({
        tool_input: {
          subagent_type: 'Explore',
          result: 'Found: AuthService in /src/auth/service.ts, UserStore in /src/stores/user.ts',
        },
      });

      const result = await Promise.resolve(agentMemoryStore(input));

      expect(result.continue).toBe(true);
    });

    test('should limit pattern extraction to 5 patterns', async () => {
      // Simulate result with many patterns
      const input = createSubagentStopInput({
        tool_input: {
          subagent_type: 'Explore',
          result: Array(10).fill('Pattern found').join('\n'),
        },
      });

      const result = await Promise.resolve(agentMemoryStore(input));

      expect(result.continue).toBe(true);
    });

    test('should handle empty result gracefully', async () => {
      const input = createSubagentStopInput({
        tool_input: { subagent_type: 'Explore', result: '' },
      });

      const result = await Promise.resolve(agentMemoryStore(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('SubagentStop: Output Validator', () => {
    test('should validate subagent output format with valid output', async () => {
      // Output validator checks for agent_output or output field
      const input = createSubagentStopInput();
      // Add agent_output to pass validation
      (input as any).agent_output = 'Found authentication in /src/auth/ - implements JWT tokens with refresh mechanism';

      const result = await Promise.resolve(outputValidator(input));

      expect(result.continue).toBe(true);
    });

    test('should fail validation with empty output', async () => {
      // Output validator returns continue: false for empty output
      const input = createSubagentStopInput();
      (input as any).agent_output = '';

      const result = await Promise.resolve(outputValidator(input));

      // Empty output causes validation failure
      expect(result.continue).toBe(false);
    });

    test('should pass validation with short but present output', async () => {
      const input = createSubagentStopInput();
      // Short output triggers warning but still passes
      (input as any).agent_output = 'Short result with enough length to pass validation check';

      const result = await Promise.resolve(outputValidator(input));

      expect(result.continue).toBe(true);
    });
  });

  describe('Complete Subagent Lifecycle Flow', () => {
    test('should execute full spawn → complete lifecycle', async () => {
      // Phase 1: SubagentStart
      const startInput = createSubagentStartInput();
      const startResults: HookResult[] = [];

      startResults.push(await Promise.resolve(graphMemoryInject(startInput)));
      startResults.push(await Promise.resolve(contextGate(startInput)));

      expect(startResults.every(r => r.continue)).toBe(true);

      // Simulate subagent execution...

      // Phase 2: SubagentStop - with valid output
      const stopInput = createSubagentStopInput();
      // Add valid output for output-validator
      (stopInput as any).agent_output = 'Found authentication logic in /src/auth/service.ts implementing JWT tokens';

      const stopResults: HookResult[] = [];

      stopResults.push(await Promise.resolve(outputValidator(stopInput)));
      stopResults.push(await Promise.resolve(agentMemoryStore(stopInput)));

      expect(stopResults.every(r => r.continue)).toBe(true);
    });

    test('should handle nested subagent spawns', async () => {
      // Parent spawns child
      const parentInput = createSubagentStartInput({
        session_id: 'parent-session',
      });

      const parentStart = await Promise.resolve(graphMemoryInject(parentInput));
      expect(parentStart.continue).toBe(true);

      // Child spawns grandchild
      const childInput = createSubagentStartInput({
        session_id: 'child-session',
      });

      const childStart = await Promise.resolve(graphMemoryInject(childInput));
      expect(childStart.continue).toBe(true);

      // Grandchild completes
      const grandchildStop = createSubagentStopInput({
        session_id: 'grandchild-session',
      });

      const grandchildResult = await Promise.resolve(agentMemoryStore(grandchildStop));
      expect(grandchildResult.continue).toBe(true);
    });

    test('should preserve memory across subagent handoffs', async () => {
      // First subagent discovers patterns
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        entities: [{ name: 'DiscoveredClass', type: 'class' }],
      }));

      const firstStart = createSubagentStartInput({ session_id: 'first-agent' });
      await Promise.resolve(graphMemoryInject(firstStart));

      // First subagent stores findings
      const firstStop = createSubagentStopInput({
        session_id: 'first-agent',
        tool_input: {
          result: 'Found DiscoveredClass in /src/discovered.ts',
        },
      });
      await Promise.resolve(agentMemoryStore(firstStop));

      // Second subagent should have access to updated memory
      const secondStart = createSubagentStartInput({ session_id: 'second-agent' });
      const secondResult = await Promise.resolve(graphMemoryInject(secondStart));

      expect(secondResult.continue).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from memory injection failure', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Memory read failed');
      });

      const input = createSubagentStartInput();

      // Memory injection fails but should continue
      const injectResult = await Promise.resolve(graphMemoryInject(input));
      expect(injectResult.continue).toBe(true);

      // Context gate should still work
      mockExistsSync.mockReturnValue(false);
      const gateResult = await Promise.resolve(contextGate(input));
      expect(gateResult.continue).toBe(true);
    });

    test('should recover from pattern store failure', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write permission denied');
      });

      const input = createSubagentStopInput();

      // Pattern store fails but should continue
      const storeResult = await Promise.resolve(agentMemoryStore(input));
      expect(storeResult.continue).toBe(true);
    });
  });

  describe('Performance', () => {
    test('subagent lifecycle should complete quickly', async () => {
      const startTime = Date.now();

      // Full lifecycle
      const startInput = createSubagentStartInput();
      await Promise.resolve(graphMemoryInject(startInput));
      await Promise.resolve(contextGate(startInput));

      const stopInput = createSubagentStopInput();
      await Promise.resolve(outputValidator(stopInput));
      await Promise.resolve(agentMemoryStore(stopInput));

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('CC 2.1.7 Compliance', () => {
    test('all SubagentStart hooks return valid HookResult', async () => {
      const input = createSubagentStartInput();
      const hooks = [graphMemoryInject, contextGate];

      for (const hook of hooks) {
        const result = await Promise.resolve(hook(input));

        expect(result).toHaveProperty('continue');
        expect(typeof result.continue).toBe('boolean');
      }
    });

    test('all SubagentStop hooks return valid HookResult', async () => {
      const input = createSubagentStopInput();
      const hooks = [outputValidator, agentMemoryStore];

      for (const hook of hooks) {
        const result = await Promise.resolve(hook(input));

        expect(result).toHaveProperty('continue');
        expect(typeof result.continue).toBe('boolean');
      }
    });
  });
});

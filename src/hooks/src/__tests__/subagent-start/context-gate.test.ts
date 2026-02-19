/**
 * Unit tests for context-gate SubagentStart hook
 *
 * Tests the context gate that prevents context overflow by:
 * - Limiting concurrent background agents (max 6)
 * - Limiting agents per response (max 8)
 * - Warning when approaching limits (>= 5 active)
 * - Warning for expensive agent types with >= 2 active
 *
 * Issue #260: subagent-start coverage 33% -> 100%
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 100 }),
  renameSync: vi.fn(),
  readSync: vi.fn().mockReturnValue(0),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
    on: vi.fn(),
    stderr: { on: vi.fn() },
    stdout: { on: vi.fn() },
    pid: 12345,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { contextGate } from '../../subagent-start/context-gate.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal HookInput for SubagentStart */
function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-gate-001',
    tool_input: {
      subagent_type: 'general-purpose',
      description: 'Test agent spawn',
      ...((overrides.tool_input as Record<string, unknown>) || {}),
    },
    ...overrides,
    // Ensure tool_input is not doubly nested
  };
}

/** Generate JSONL spawn log entries with timestamps relative to now */
function generateSpawnEntries(
  count: number,
  ageMs: number = 1000 // how old entries are
): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const ts = new Date(Date.now() - ageMs + i * 10).toISOString();
    lines.push(JSON.stringify({
      timestamp: ts,
      subagent_type: `agent-${i}`,
      description: `Task ${i}`,
      session_id: 'test-session-gate-001',
    }));
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contextGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no state file, no spawn log
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Normal spawn - no active agents
  // -----------------------------------------------------------------------

  describe('normal spawn with no active agents', () => {
    test('returns silentSuccess when no spawn log exists', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Simple task',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess for foreground spawn with zero active', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Run tests',
          run_in_background: false,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess for background spawn with zero active', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Run tests',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Response limit (>= 8 agents in 2s window)
  // -----------------------------------------------------------------------

  describe('response agent limit', () => {
    test('denies when 8+ agents spawned in last 2 seconds', () => {
      // Arrange - spawn log with 8 very recent entries (within 2 seconds)
      const recentEntries = generateSpawnEntries(8, 500);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(recentEntries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'code-quality-reviewer',
          description: 'Review code',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Too many agents spawned');
      expect(result.stopReason).toContain('single response');
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
    });

    test('allows when fewer than 8 agents in response window', () => {
      // Arrange - spawn log with 7 entries (just under limit)
      const entries = generateSpawnEntries(7, 500);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Some task',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('deny message includes attempted agent type and description', () => {
      // Arrange
      const recentEntries = generateSpawnEntries(9, 500);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(recentEntries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'security-auditor',
          description: 'Audit the authentication module',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('security-auditor');
      expect(result.stopReason).toContain('Audit the authentication module');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Background agent limit (>= 6 in 5 min window)
  // -----------------------------------------------------------------------

  describe('background agent limit', () => {
    test('denies background spawn when 6+ active in last 5 minutes', () => {
      // Arrange - spawn log with 6 entries within 5 minutes
      const entries = generateSpawnEntries(6, 60_000); // 1 minute old
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Background Agent Limit');
      expect(result.stopReason).toContain('concurrent');
    });

    test('allows foreground spawn even with 6+ active background agents', () => {
      // Arrange
      const entries = generateSpawnEntries(6, 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: false,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - foreground is not blocked by background limit (but may trigger warning)
      expect(result.continue).toBe(true);
    });

    test('background limit deny message suggests solutions', () => {
      // Arrange
      const entries = generateSpawnEntries(7, 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'llm-integrator',
          description: 'Integrate LLM',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('SOLUTION');
      expect(result.stopReason).toContain('Wait for existing agents');
    });

    test('accepts run_in_background as string "true"', () => {
      // Arrange
      const entries = generateSpawnEntries(6, 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: 'true',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - string "true" should be treated as background
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Background Agent Limit');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Warning threshold (>= 5 active agents)
  // -----------------------------------------------------------------------

  describe('warning threshold', () => {
    test('warns when 5 agents are active', () => {
      // Arrange - 5 entries within 5 minutes
      const entries = generateSpawnEntries(5, 120_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Another task',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - warning but still continues
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('Context Budget Warning');
    });

    test('warning includes current count and limit', () => {
      // Arrange
      const entries = generateSpawnEntries(5, 120_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Task description',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.systemMessage).toContain('5');
      expect(result.systemMessage).toContain('6'); // limit
    });
  });

  // -----------------------------------------------------------------------
  // 5. Expensive agent types warning
  // -----------------------------------------------------------------------

  describe('expensive agent types', () => {
    const expensiveTypes = [
      'test-generator',
      'backend-system-architect',
      'workflow-architect',
      'security-auditor',
      'llm-integrator',
    ];

    test.each(expensiveTypes)(
      'warns for expensive type "%s" with 2 active agents',
      (agentType) => {
        // Arrange - exactly 2 active (below WARNING_THRESHOLD of 3, but >= 2 for expensive check)
        const entries = generateSpawnEntries(2, 120_000);
        (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
          if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
          if (typeof path === 'string' && path.includes('agent-state.json')) return false;
          return false;
        });
        (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

        const input = createToolInput({
          tool_input: {
            subagent_type: agentType,
            description: 'Expensive operation',
          },
        });

        // Act
        const result = contextGate(input);

        // Assert
        expect(result.continue).toBe(true);
        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toContain(agentType);
        expect(result.systemMessage).toContain('expensive');
      }
    );

    test('does not warn for non-expensive type with 2 active agents', () => {
      // Arrange - 2 active agents but a non-expensive type
      const entries = generateSpawnEntries(2, 120_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Simple task',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - no warning for non-expensive type
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Non-background agents: not blocked by background limit
  // -----------------------------------------------------------------------

  describe('non-background agents bypass background limit', () => {
    test('foreground agent allowed even with many active agents', () => {
      // Arrange - 6 active agents (at background limit)
      // but no entries within 2s (below response limit)
      const entries = generateSpawnEntries(6, 120_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Foreground task',
          // run_in_background is not set (defaults to false)
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - continues (may warn due to WARNING_THRESHOLD but not blocked)
      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 7. State file initialization
  // -----------------------------------------------------------------------

  describe('state file initialization', () => {
    test('creates state file when it does not exist', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'First spawn',
        },
      });

      // Act
      contextGate(input);

      // Assert - writeFileSync called to initialize state
      const writeCalls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const stateWrite = writeCalls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('agent-state.json')
      );
      expect(stateWrite).toBeDefined();
    });

    test('creates directory with mkdirSync recursive', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'First spawn',
        },
      });

      // Act
      contextGate(input);

      // Assert - mkdirSync called with recursive option
      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    test('handles mkdirSync error gracefully', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (mkdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('EACCES');
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'First spawn',
        },
      });

      // Act & Assert - should not throw
      expect(() => contextGate(input)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 8. CC compliance
  // -----------------------------------------------------------------------

  describe('CC compliance', () => {
    test('deny result has proper hookSpecificOutput with deny decision', () => {
      // Arrange - trigger response limit
      const entries = generateSpawnEntries(9, 500);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(result.hookSpecificOutput?.permissionDecisionReason).toBe(result.stopReason);
    });

    test('deny messages explain the limit and suggest solutions', () => {
      // Arrange - trigger background limit
      const entries = generateSpawnEntries(7, 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.stopReason).toContain('Maximum allowed');
      expect(result.stopReason).toContain('SOLUTION');
    });

    test('warning result has continue: true and systemMessage', () => {
      // Arrange
      const entries = generateSpawnEntries(5, 120_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return false;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(entries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Task',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(typeof result.systemMessage).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // 9. Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty tool_input gracefully', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles spawn log with invalid JSON lines', () => {
      // Arrange
      const mixedContent = [
        'not-valid-json',
        JSON.stringify({ timestamp: new Date().toISOString(), subagent_type: 'a' }),
        '{"broken',
        JSON.stringify({ timestamp: new Date().toISOString(), subagent_type: 'b' }),
      ].join('\n');

      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(mixedContent);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Test',
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - skips invalid lines, only counts valid entries
      expect(result.continue).toBe(true);
    });

    test('handles readFileSync throwing for spawn log', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('EACCES');
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Test',
        },
      });

      // Act & Assert - should not throw, treats as 0 active
      expect(() => contextGate(input)).not.toThrow();
      const result = contextGate(input);
      expect(result.continue).toBe(true);
    });

    test('old entries (> 5 minutes) do not count toward background limit', () => {
      // Arrange - entries from 10 minutes ago
      const oldEntries = generateSpawnEntries(10, 10 * 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(oldEntries);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert - old entries should not block
      expect(result.continue).toBe(true);
    });

    test('incrementBlockedCount updates state file when deny occurs', () => {
      // Arrange - trigger background limit
      const entries = generateSpawnEntries(7, 60_000);
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('subagent-spawns.jsonl')) return true;
        if (typeof path === 'string' && path.includes('agent-state.json')) return true;
        return false;
      });

      const _callCount = 0;
      (readFileSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('agent-state.json')) {
          return JSON.stringify({
            active_background: [],
            session_total: 5,
            last_cleanup: null,
            blocked_count: 2,
          });
        }
        return entries;
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests',
          run_in_background: true,
        },
      });

      // Act
      const result = contextGate(input);

      // Assert
      expect(result.continue).toBe(false);
      // writeFileSync should be called to update blocked_count
      const writeCalls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const stateUpdate = writeCalls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('agent-state.json')
      );
      expect(stateUpdate).toBeDefined();
    });
  });
});

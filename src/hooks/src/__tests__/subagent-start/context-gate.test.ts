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

// Mock atomic-write so atomicWriteSync delegates to the mocked writeFileSync
vi.mock('../../lib/atomic-write.js', async () => {
  const fs = await import('node:fs');
  return {
    atomicWriteSync: (path: string, content: string) => fs.writeFileSync(path, content, 'utf8'),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(() => '').mockReturnValue('main\n'),
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

    // Pin cwd to a NON-worktree path (#3391). getEffectiveLimits() reads
    // process.cwd() and raises the limits to {background:10, perResponse:12}
    // for any path containing '/.worktrees/' or '.claude/worktrees/'. Left
    // unmocked, the real cwd leaked in and every expectation below inverted
    // depending on where the suite was run from: green in a plain checkout
    // (and in CI), 6 failures when run from a git worktree, because 8 response
    // spawns no longer exceed 12 and both over-limit checks fall through to
    // the generic budget warning. The repo mandates worktrees for concurrent
    // sessions, so the mandated workflow was the one that saw red.
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');
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
    test('advises when 8+ agents spawned in last 2 seconds', () => {
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Too many agents in one response');
      expect(result.systemMessage).toContain('Split into multiple responses');
      expect(result.hookSpecificOutput).toBeUndefined();
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

    test('advisory message includes attempted agent type and description', () => {
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('security-auditor');
      expect(result.systemMessage).toContain('Audit the authentication module');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Background agent limit (>= 6 in 5 min window)
  // -----------------------------------------------------------------------

  describe('background agent limit', () => {
    test('advises background spawn when 6+ active in last 5 minutes', () => {
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Too many background agents');
      expect(result.systemMessage).toContain('Prefer waiting for existing agents');
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

    test('background limit advisory message suggests solutions', () => {
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Too many background agents');
      expect(result.systemMessage).toContain('Prefer waiting for existing agents');
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Too many background agents');
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
    test('over-limit advisory is CC-consumable, no PreToolUse envelope', () => {
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
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.hookSpecificOutput).toBeUndefined();
      expect(result.systemMessage).toBeDefined();
    });

    test('advisory messages explain the limit and suggest solutions', () => {
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
      expect(result.systemMessage).toContain('Too many background agents');
      expect(result.systemMessage).toContain('Prefer waiting for existing agents');
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

    test('incrementBlockedCount updates state file when the over-limit advisory fires', () => {
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
      expect(result.continue).toBe(true);
      // writeFileSync should be called to update blocked_count
      const writeCalls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const stateUpdate = writeCalls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('agent-state.json')
      );
      expect(stateUpdate).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Worktree limit regime (#3391, #3310)
  // -----------------------------------------------------------------------
  //
  // getEffectiveLimits() raises the caps inside a worktree because parallel
  // agents are routine there. That branch had NO coverage, which is why the
  // cwd leak above went unnoticed for so long: the suite exercised only the
  // base regime and silently switched regimes based on where it was run.
  // Both layouts are asserted — CC's own `.claude/worktrees/<name>` and the
  // hand-rolled `<repo>/.worktrees/<task>` that global CLAUDE.md mandates.
  // #3310 fixed a detector that matched NEITHER, so a regression here is a
  // silent revert to base limits, not a visible error.

  describe('raised limits inside a worktree', () => {
    test.each([
      ['hand-rolled layout', '/Users/me/repo/.worktrees/mytask'],
      ['CC EnterWorktree layout', '/Users/me/repo/.claude/worktrees/mytask'],
    ])('%s: 8 response spawns stay under the raised cap of 12', (_label, cwd) => {
      vi.spyOn(process, 'cwd').mockReturnValue(cwd);
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(generateSpawnEntries(8, 1000));

      const result = contextGate(
        createToolInput({
          tool_input: { subagent_type: 'general-purpose', description: 'Parallel work' },
        })
      );

      // 8 < 12, so the per-response advisory must NOT fire here even though
      // the identical input DOES trip it in the base regime (asserted above).
      expect(result.continue).toBe(true);
      const text = JSON.stringify(result);
      expect(text).not.toContain('Too many agents in one response');
    });

    test('a path that merely mentions worktrees does not raise the caps', () => {
      // '.git/worktrees/' holds git metadata and is never a checkout a process
      // can cwd into — the exact string the pre-#3310 detector matched. Keep it
      // failing the check so that bug cannot come back.
      vi.spyOn(process, 'cwd').mockReturnValue('/Users/me/repo/.git/worktrees/mytask');
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(generateSpawnEntries(8, 1000));

      const result = contextGate(
        createToolInput({
          tool_input: { subagent_type: 'general-purpose', description: 'Parallel work' },
        })
      );

      // Base regime: 8 >= 8, so the advisory fires.
      expect(JSON.stringify(result)).toContain('Too many agents in one response');
    });
  });
});

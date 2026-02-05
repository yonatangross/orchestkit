/**
 * Unit tests for subagent-context-stager SubagentStart hook
 *
 * Tests the context stager that:
 * - Reads session state for pending tasks
 * - Stages context based on task description keywords
 * - Returns systemMessage with staged context or silentSuccess
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
  readdirSync: vi.fn().mockReturnValue([]),
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
import { subagentContextStager } from '../../subagent-start/subagent-context-stager.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal HookInput for SubagentStart */
function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-stager-001',
    tool_input: {
      subagent_type: 'general-purpose',
      description: 'Default task description',
      ...((overrides.tool_input as Record<string, unknown>) || {}),
    },
    ...overrides,
  };
}

/** Create a mock session state JSON */
function mockSessionState(tasks: string[] = []): string {
  return JSON.stringify({ tasks_pending: tasks });
}

/** Create a mock decisions JSON */
function mockDecisions(decisions: Array<{ category: string; title: string; status?: string }> = []): string {
  return JSON.stringify({ decisions });
}

/**
 * Configure existsSync and readFileSync to respond differently
 * based on file path patterns
 */
function setupFileMocks(config: {
  sessionState?: string | false;
  decisions?: string | false;
  issueDir?: string[] | false;
}): void {
  (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (typeof path === 'string' && path.includes('state.json')) {
      return config.sessionState !== false && config.sessionState !== undefined;
    }
    if (typeof path === 'string' && path.includes('active.json')) {
      return config.decisions !== false && config.decisions !== undefined;
    }
    if (typeof path === 'string' && path.includes('docs/issues')) {
      return config.issueDir !== false && config.issueDir !== undefined;
    }
    return false;
  });

  (readFileSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (typeof path === 'string' && path.includes('state.json') && config.sessionState) {
      return config.sessionState;
    }
    if (typeof path === 'string' && path.includes('active.json') && config.decisions) {
      return config.decisions;
    }
    return '{}';
  });

  if (config.issueDir && config.issueDir !== false) {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(config.issueDir);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subagentContextStager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. No context available
  // -----------------------------------------------------------------------

  describe('no context available', () => {
    test('returns silentSuccess when no files exist', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Simple task with no context match',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });

    test('returns silentSuccess when description is empty', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: '',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silentSuccess when no tool_input provided', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Backend task detection
  // -----------------------------------------------------------------------

  describe('backend task detection', () => {
    const backendKeywords = [
      'Implement the api endpoint for users',
      'Fix the backend service layer',
      'Create database migration for orders',
      'Add new REST endpoint for products',
    ];

    test.each(backendKeywords)(
      'stages backend decisions for description: "%s"',
      (description) => {
        // Arrange
        setupFileMocks({
          decisions: mockDecisions([
            { category: 'backend', title: 'Use FastAPI for REST', status: 'active' },
            { category: 'api', title: 'Version all endpoints', status: 'active' },
            { category: 'database', title: 'Use PostgreSQL', status: 'active' },
          ]),
        });

        const input = createToolInput({
          tool_input: {
            subagent_type: 'backend-system-architect',
            description,
          },
        });

        // Act
        const result = subagentContextStager(input);

        // Assert
        expect(result.continue).toBe(true);
        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toContain('RELEVANT DECISIONS');
        expect(result.systemMessage).toContain('Use FastAPI for REST');
      }
    );

    test('includes api and database category decisions for backend task', () => {
      // Arrange
      setupFileMocks({
        decisions: mockDecisions([
          { category: 'backend', title: 'Repository pattern', status: 'active' },
          { category: 'api', title: 'JSON:API format', status: 'decided' },
          { category: 'database', title: 'Use pgvector', status: 'active' },
          { category: 'frontend', title: 'Use React', status: 'active' },
        ]),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Build the API endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('Repository pattern');
      expect(result.systemMessage).toContain('JSON:API format');
      expect(result.systemMessage).toContain('Use pgvector');
      // Frontend decision should not appear in backend filter
      // (but it might if the backend filter includes api/database categories)
    });
  });

  // -----------------------------------------------------------------------
  // 3. Frontend task detection
  // -----------------------------------------------------------------------

  describe('frontend task detection', () => {
    const frontendKeywords = [
      'Build the react component for dashboard',
      'Fix the frontend form validation',
      'Update the UI layout for mobile',
      'Create new component for settings',
    ];

    test.each(frontendKeywords)(
      'stages frontend decisions for description: "%s"',
      (description) => {
        // Arrange
        setupFileMocks({
          decisions: mockDecisions([
            { category: 'frontend', title: 'Use Tailwind CSS', status: 'active' },
            { category: 'api', title: 'Use React Query', status: 'active' },
          ]),
        });

        const input = createToolInput({
          tool_input: {
            subagent_type: 'frontend-ui-developer',
            description,
          },
        });

        // Act
        const result = subagentContextStager(input);

        // Assert
        expect(result.continue).toBe(true);
        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toContain('RELEVANT DECISIONS');
      }
    );
  });

  // -----------------------------------------------------------------------
  // 4. Testing task detection
  // -----------------------------------------------------------------------

  describe('testing task detection', () => {
    const testKeywords = [
      'Write pytest tests for the auth service',
      'Run the test suite for payments',
      'Add jest testing for the component',
      'Fix testing coverage gaps',
    ];

    test.each(testKeywords)(
      'stages testing reminders for description: "%s"',
      (description) => {
        // Arrange
        setupFileMocks({});

        const input = createToolInput({
          tool_input: {
            subagent_type: 'test-generator',
            description,
          },
        });

        // Act
        const result = subagentContextStager(input);

        // Assert
        expect(result.continue).toBe(true);
        expect(result.systemMessage).toBeDefined();
        expect(result.systemMessage).toContain('TESTING REMINDERS');
        expect(result.systemMessage).toContain('tee');
        expect(result.systemMessage).toContain('coverage');
      }
    );
  });

  // -----------------------------------------------------------------------
  // 5. Issue reference detection
  // -----------------------------------------------------------------------

  describe('issue reference detection', () => {
    test('finds issue doc for #123 reference', () => {
      // Arrange
      setupFileMocks({
        issueDir: ['issue-123-auth-bug.md', 'issue-456-perf.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'debug-investigator',
          description: 'Fix issue #123 - authentication fails',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('ISSUE DOCS');
      expect(result.systemMessage).toContain('issue-123-auth-bug.md');
    });

    test('handles issue keyword without number', () => {
      // Arrange
      setupFileMocks({
        issueDir: ['issue-100.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'debug-investigator',
          description: 'Fix the login issue',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert - "issue" matches regex but no #\d+ so no issue doc lookup
      expect(result.continue).toBe(true);
      // May or may not have systemMessage depending on other context
    });

    test('returns no issue docs when number does not match any file', () => {
      // Arrange
      setupFileMocks({
        issueDir: ['issue-100.md', 'issue-200.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'debug-investigator',
          description: 'Fix bug #999',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      // systemMessage should not contain ISSUE DOCS since no match
      if (result.systemMessage) {
        expect(result.systemMessage).not.toContain('ISSUE DOCS');
      }
    });

    test('handles missing issue directory', () => {
      // Arrange
      setupFileMocks({ issueDir: false });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'debug-investigator',
          description: 'Fix issue #123',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Pending tasks from session state
  // -----------------------------------------------------------------------

  describe('pending tasks from session state', () => {
    test('includes pending tasks in context', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState([
          'Implement user authentication',
          'Add rate limiting middleware',
          'Write integration tests',
        ]),
      });

      // Need a keyword match to trigger context staging
      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Work on the backend API endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('ACTIVE TODOS');
      expect(result.systemMessage).toContain('Implement user authentication');
    });

    test('shows at most 3 pending tasks', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState([
          'Task 1',
          'Task 2',
          'Task 3',
          'Task 4',
          'Task 5',
        ]),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Work on backend api',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('Task 1');
      expect(result.systemMessage).toContain('Task 2');
      expect(result.systemMessage).toContain('Task 3');
      expect(result.systemMessage).not.toContain('Task 4');
      expect(result.systemMessage).not.toContain('Task 5');
    });

    test('skips pending tasks section when tasks_pending is empty', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState([]),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Some unrelated task',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      if (result.systemMessage) {
        expect(result.systemMessage).not.toContain('ACTIVE TODOS');
      }
    });

    test('handles invalid JSON in session state', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('state.json')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('not valid json');

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Some task',
        },
      });

      // Act & Assert - should not throw
      expect(() => subagentContextStager(input)).not.toThrow();
      const result = subagentContextStager(input);
      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Multiple contexts staged together
  // -----------------------------------------------------------------------

  describe('multiple contexts staged together', () => {
    test('stages both backend decisions and testing reminders', () => {
      // Arrange
      setupFileMocks({
        decisions: mockDecisions([
          { category: 'backend', title: 'Use SQLAlchemy ORM', status: 'active' },
        ]),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          // This description matches both backend and testing patterns
          description: 'Write pytest tests for the backend api endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('RELEVANT DECISIONS');
      expect(result.systemMessage).toContain('TESTING REMINDERS');
    });

    test('stages pending tasks, decisions, and testing together', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState(['Fix auth', 'Add tests']),
        decisions: mockDecisions([
          { category: 'backend', title: 'Repository pattern', status: 'active' },
        ]),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Write pytest for backend api endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('ACTIVE TODOS');
      expect(result.systemMessage).toContain('RELEVANT DECISIONS');
      expect(result.systemMessage).toContain('TESTING REMINDERS');
    });
  });

  // -----------------------------------------------------------------------
  // 8. System message format
  // -----------------------------------------------------------------------

  describe('system message format', () => {
    test('includes task description at end of message', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState(['Pending task 1']),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Build the user API endpoint',
          task_description: 'Build the user API endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('Task: Build the user API endpoint');
    });

    test('includes subagent type in message', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState(['Some task']),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'security-auditor',
          description: 'Review backend api security',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('Subagent: security-auditor');
    });

    test('uses task_description over description when both present', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState(['A task']),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          task_description: 'Write tests for the backend api',
          description: 'Generic description',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(result.systemMessage).toContain('Task: Write tests for the backend api');
    });
  });

  // -----------------------------------------------------------------------
  // 9. CC compliance
  // -----------------------------------------------------------------------

  describe('CC compliance', () => {
    test('all code paths return continue: true', () => {
      // Path 1: silentSuccess (no context)
      const result1 = subagentContextStager(createToolInput({
        tool_input: { subagent_type: 'general-purpose', description: 'unmatched' },
      }));
      expect(result1.continue).toBe(true);

      // Path 2: with systemMessage (has context)
      vi.clearAllMocks();
      setupFileMocks({
        sessionState: mockSessionState(['Task 1']),
      });
      const result2 = subagentContextStager(createToolInput({
        tool_input: { subagent_type: 'test-generator', description: 'Backend api test' },
      }));
      expect(result2.continue).toBe(true);
    });

    test('systemMessage is string type when present', () => {
      // Arrange
      setupFileMocks({
        sessionState: mockSessionState(['Task 1']),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Build the api endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert
      expect(typeof result.systemMessage).toBe('string');
      expect(result.systemMessage!.length).toBeGreaterThan(0);
    });

    test('decisions are limited to 5 per category', () => {
      // Arrange - 8 backend decisions
      const manyDecisions = Array.from({ length: 8 }, (_, i) => ({
        category: 'backend',
        title: `Decision ${i + 1}`,
        status: 'active',
      }));
      setupFileMocks({
        decisions: mockDecisions(manyDecisions),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Build the api endpoint',
        },
      });

      // Act
      const result = subagentContextStager(input);

      // Assert - should contain at most 5 decisions
      const decisionLines = result.systemMessage!
        .split('\n')
        .filter((line: string) => line.startsWith('- Decision'));
      expect(decisionLines.length).toBeLessThanOrEqual(5);
    });
  });
});

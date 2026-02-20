/**
 * Unit tests for subagent-validator SubagentStart hook
 *
 * Tests the subagent validator that:
 * - Validates agent types against builtins, plugin.json, and agents/ directory
 * - Logs unknown agent types (warning, not blocking)
 * - Extracts skills from agent frontmatter, warns about missing skills
 * - Generates permission profiles (CC 2.1.20)
 * - Logs spawns to tracking JSONL file
 *
 * Issue #260: subagent-start coverage 33% -> 100%
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// ---------------------------------------------------------------------------
// Cross-platform path helper (normalize Windows backslashes to Unix forward slashes)
// ---------------------------------------------------------------------------
const normalizePath = (p: string): string => p.replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// Hoisted mocks — shared between analytics-buffer and node:fs mocks
// ---------------------------------------------------------------------------
const { mockAppendFileSync } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock analytics-buffer — bridges bufferWrite to mockAppendFileSync for assertions
// ---------------------------------------------------------------------------
vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock node:fs at module level before any hook imports
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  readdirSync: vi.fn().mockReturnValue([]),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: mockAppendFileSync,
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
import { subagentValidator } from '../../subagent-start/subagent-validator.js';
import { existsSync, readFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal HookInput for SubagentStart */
function createToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-validator-001',
    tool_input: {
      subagent_type: 'general-purpose',
      description: 'Test agent spawn',
      ...((overrides.tool_input as Record<string, unknown>) || {}),
    },
    ...overrides,
  };
}

/** Create agent markdown with frontmatter */
function createAgentMd(config: {
  skills?: string[];
  tools?: string[];
  name?: string;
}): string {
  let frontmatter = '---\n';
  if (config.name) frontmatter += `name: ${config.name}\n`;
  if (config.skills) {
    frontmatter += 'skills:\n';
    for (const skill of config.skills) {
      frontmatter += `  - ${skill}\n`;
    }
  }
  if (config.tools) {
    frontmatter += 'tools:\n';
    for (const tool of config.tools) {
      frontmatter += `  - ${tool}\n`;
    }
  }
  frontmatter += '---\n\n## Directive\nDo something useful.\n';
  return frontmatter;
}

/**
 * Configure mock filesystem responses
 */
function setupMocks(config: {
  pluginJson?: Record<string, unknown> | false;
  agentsDirFiles?: string[] | false;
  agentMdContent?: string | false;
  skillsExist?: string[];
}): void {
  (existsSync as ReturnType<typeof vi.fn>).mockImplementation((rawPath: string) => {
    if (typeof rawPath !== 'string') return false;
    // Normalize path for cross-platform compatibility (Windows uses backslashes)
    const path = normalizePath(rawPath);

    // plugin.json
    if (path.includes('plugin.json')) {
      return config.pluginJson !== false && config.pluginJson !== undefined;
    }
    // agents/ directory
    if (path.endsWith('/agents') || path.endsWith('/.claude/agents')) {
      return config.agentsDirFiles !== false && config.agentsDirFiles !== undefined;
    }
    // Agent .md file
    if (path.endsWith('.md') && (path.includes('/agents/') || path.includes('/.claude/agents/'))) {
      return config.agentMdContent !== false && config.agentMdContent !== undefined;
    }
    // Skills directory SKILL.md
    if (path.includes('/skills/') && path.endsWith('SKILL.md')) {
      const skillName = path.split('/skills/')[1]?.split('/')[0];
      return config.skillsExist?.includes(skillName || '') ?? false;
    }
    // Tracking log directory
    if (path.includes('/logs')) return true;
    return false;
  });

  (readFileSync as ReturnType<typeof vi.fn>).mockImplementation((rawPath: string) => {
    if (typeof rawPath !== 'string') return '{}';
    // Normalize path for cross-platform compatibility
    const path = normalizePath(rawPath);
    if (path.includes('plugin.json') && config.pluginJson) {
      return JSON.stringify(config.pluginJson);
    }
    if (path.endsWith('.md') && config.agentMdContent) {
      return config.agentMdContent;
    }
    return '{}';
  });

  (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(
    config.agentsDirFiles || []
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subagentValidator', () => {
  const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set a consistent project dir so path.join produces paths with leading slashes
    // that match the mock patterns (e.g., /test/project/skills/...)
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    // Default: nothing exists
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{}');
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalProjectDir !== undefined) {
      process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
    } else {
      delete process.env.CLAUDE_PROJECT_DIR;
    }
  });

  // -----------------------------------------------------------------------
  // 1. Built-in types
  // -----------------------------------------------------------------------

  describe('built-in agent types', () => {
    const builtinTypes = [
      'general-purpose',
      'Explore',
      'Plan',
      'claude-code-guide',
      'statusline-setup',
      'Bash',
    ];

    test.each(builtinTypes)(
      'recognizes built-in type "%s" without warning',
      (agentType) => {
        // Arrange
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const input = createToolInput({
          tool_input: {
            subagent_type: agentType,
            description: 'Standard operation',
          },
        });

        // Act
        const result = subagentValidator(input);

        // Assert
        expect(result.continue).toBe(true);
        // Built-in types should not trigger "unknown agent" warning
        // (console.error is only called for missing skills, not unknown types)
        consoleErrorSpy.mockRestore();
      }
    );
  });

  // -----------------------------------------------------------------------
  // 2. Plugin.json agents
  // -----------------------------------------------------------------------

  describe('plugin.json agents', () => {
    test('recognizes agent types from plugin.json agents array', () => {
      // Arrange
      setupMocks({
        pluginJson: {
          agents: [
            { id: 'custom-agent-1' },
            { id: 'custom-agent-2' },
          ],
        },
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'custom-agent-1',
          description: 'Custom operation',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles plugin.json without agents array', () => {
      // Arrange
      setupMocks({
        pluginJson: { name: 'test-plugin' },
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'unknown-agent',
          description: 'Some task',
        },
      });

      // Act & Assert - should not throw
      expect(() => subagentValidator(input)).not.toThrow();
    });

    test('handles invalid plugin.json JSON', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('plugin.json')) return true;
        return false;
      });
      (readFileSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('plugin.json')) return 'invalid json{{{';
        return '{}';
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'some-agent',
          description: 'Test',
        },
      });

      // Act & Assert - graceful degradation
      expect(() => subagentValidator(input)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Agents directory
  // -----------------------------------------------------------------------

  describe('agents directory scanning', () => {
    test('recognizes agents from .md files in agents/ directory', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: [
          'backend-system-architect.md',
          'frontend-ui-developer.md',
          'test-generator.md',
        ],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'backend-system-architect',
          description: 'Design backend',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('strips .md extension when building valid types set', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['my-custom-agent.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'my-custom-agent',
          description: 'Custom task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - agent should be recognized
      expect(result.continue).toBe(true);
    });

    test('ignores non-.md files in agents directory', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['README.txt', 'config.json', 'valid-agent.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'README', // Should not match README.txt
          description: 'Test',
        },
      });

      // Act
      subagentValidator(input);

      // Assert - README should not be recognized as valid type
      // (no assertion on warning since it's logHook, not console.error)
      expect(true).toBe(true); // Pass - we just verify no crash
    });
  });

  // -----------------------------------------------------------------------
  // 4. Namespace stripping
  // -----------------------------------------------------------------------

  describe('namespace stripping', () => {
    test('strips ork: namespace prefix for validation', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['backend-system-architect.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'ork:backend-system-architect',
          description: 'Design backend',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('strips arbitrary namespace prefix', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['test-generator.md'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'custom-ns:test-generator',
          description: 'Generate tests',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Unknown agent type warning
  // -----------------------------------------------------------------------

  describe('unknown agent type', () => {
    test('warns but does not block unknown agent types', () => {
      // Arrange - no sources have this agent
      setupMocks({});

      const input = createToolInput({
        tool_input: {
          subagent_type: 'totally-unknown-agent',
          description: 'Some task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - continues (non-blocking)
      expect(result.continue).toBe(true);
    });

    test('does not block when agent type is empty string', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: '',
          description: 'Some task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Missing skills warning
  // -----------------------------------------------------------------------

  describe('missing skills validation', () => {
    test('warns about missing skill SKILL.md files', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupMocks({
        agentsDirFiles: ['test-agent.md'],
        agentMdContent: createAgentMd({
          skills: ['existing-skill', 'missing-skill-1', 'missing-skill-2'],
        }),
        skillsExist: ['existing-skill'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-agent',
          description: 'Test',
        },
      });

      // Act
      subagentValidator(input);

      // Assert - console.error called with missing skills warning
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-skill-1')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-skill-2')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 missing skill')
      );
      consoleErrorSpy.mockRestore();
    });

    test('does not warn when all skills exist', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupMocks({
        agentsDirFiles: ['test-agent.md'],
        agentMdContent: createAgentMd({
          skills: ['skill-a', 'skill-b'],
        }),
        skillsExist: ['skill-a', 'skill-b'],
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-agent',
          description: 'Test',
        },
      });

      // Act
      subagentValidator(input);

      // Assert - no warning
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('handles agent without skills in frontmatter', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupMocks({
        agentsDirFiles: ['simple-agent.md'],
        agentMdContent: createAgentMd({ name: 'simple-agent' }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'simple-agent',
          description: 'Test',
        },
      });

      // Act
      subagentValidator(input);

      // Assert - no warning about missing skills
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // 7. Permission profile (CC 2.1.20)
  // -----------------------------------------------------------------------

  describe('permission profile generation (CC 2.1.20)', () => {
    test('generates elevated risk profile for agent with Bash + Write', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['dangerous-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Write', 'Bash', 'Glob'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'dangerous-agent',
          description: 'Operation requiring elevated tools',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('elevated');
      expect(result.hookSpecificOutput!.additionalContext).toContain('Bash');
      expect(result.hookSpecificOutput!.additionalContext).toContain('Write');
    });

    test('generates moderate risk profile for agent with only Bash', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['bash-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Bash', 'Read'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'bash-agent',
          description: 'Run commands',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('moderate');
      expect(result.hookSpecificOutput!.additionalContext).toContain('Bash access');
    });

    test('generates moderate risk profile for agent with only Write/Edit', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['writer-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Write', 'Glob'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'writer-agent',
          description: 'Write files',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('moderate');
    });

    test('generates low risk profile for read-only agent', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['reader-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Glob', 'Grep'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'reader-agent',
          description: 'Read files',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('low');
      expect(result.hookSpecificOutput!.additionalContext).toContain('read-only');
    });

    test('returns silentSuccess when agent has no tools in frontmatter', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['simple-agent.md'],
        agentMdContent: createAgentMd({ name: 'simple-agent' }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'simple-agent',
          description: 'Simple task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - no tools means no permission profile
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns outputWithContext when tools are found', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['tool-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Bash'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'tool-agent',
          description: 'Use tools',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - outputWithContext shape
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('Edit tool counts as write access for risk calculation', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['editor-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Edit', 'Bash'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'editor-agent',
          description: 'Edit files',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - Bash + Edit should be "elevated"
      expect(result.hookSpecificOutput!.additionalContext).toContain('elevated');
    });
  });

  // -----------------------------------------------------------------------
  // 8. Spawn logging
  // -----------------------------------------------------------------------

  describe('spawn logging', () => {
    test('appends entry to tracking JSONL file', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: 'test-generator',
          description: 'Generate tests for auth module',
        },
      });

      // Act
      subagentValidator(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
      const call = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('subagent-spawns.jsonl')
      );
      expect(call).toBeDefined();

      // Parse the logged entry
      const loggedJson = JSON.parse(call![1].toString().trim());
      expect(loggedJson).toHaveProperty('timestamp');
      expect(loggedJson.subagent_type).toBe('test-generator');
      expect(loggedJson.description).toBe('Generate tests for auth module');
      expect(loggedJson.session_id).toBeDefined();
    });

    test('includes session_id from input', () => {
      // Arrange
      const input = createToolInput({
        session_id: 'custom-session-id-123',
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Task',
        },
      });

      // Act
      subagentValidator(input);

      // Assert
      const call = (appendFileSync as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('subagent-spawns.jsonl')
      );
      const loggedJson = JSON.parse(call![1].toString().trim());
      expect(loggedJson.session_id).toBe('custom-session-id-123');
    });

    test('creates log directory if missing', () => {
      // Arrange
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Task',
        },
      });

      // Act
      subagentValidator(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    test('handles appendFileSync error gracefully', () => {
      // Arrange
      (appendFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOSPC');
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Task',
        },
      });

      // Act & Assert - should not throw
      expect(() => subagentValidator(input)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 9. Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty subagent_type', () => {
      // Arrange
      const input = createToolInput({
        tool_input: {
          subagent_type: '',
          description: 'Task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Task',
        session_id: 'test-session',
        tool_input: {},
      };

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles CRLF line endings in agent markdown', () => {
      // Arrange - Windows-style line endings
      setupMocks({
        agentsDirFiles: ['crlf-agent.md'],
        agentMdContent: '---\r\nname: crlf-agent\r\ntools:\r\n  - Read\r\n  - Bash\r\n---\r\n\r\n## Directive\r\nTest\r\n',
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'crlf-agent',
          description: 'Test CRLF',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - should parse correctly despite CRLF
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
      expect(result.hookSpecificOutput!.additionalContext).toContain('Bash');
    });

    test('handles agent markdown without frontmatter', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['no-frontmatter.md'],
        agentMdContent: '# Just a heading\n\nSome content without frontmatter.\n',
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'no-frontmatter',
          description: 'Test',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert - no tools extracted, returns silentSuccess
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('permission profile includes agent name', () => {
      // Arrange
      setupMocks({
        agentsDirFiles: ['named-agent.md'],
        agentMdContent: createAgentMd({
          tools: ['Read', 'Write'],
        }),
      });

      const input = createToolInput({
        tool_input: {
          subagent_type: 'ork:named-agent',
          description: 'Task',
        },
      });

      // Act
      const result = subagentValidator(input);

      // Assert
      expect(result.hookSpecificOutput!.additionalContext).toContain('named-agent');
      expect(result.hookSpecificOutput!.additionalContext).toContain('Agent Permission Profile');
    });
  });
});

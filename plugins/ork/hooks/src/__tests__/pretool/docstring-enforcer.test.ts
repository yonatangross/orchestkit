/**
 * Unit tests for docstring-enforcer hook
 * Tests detection of missing docstrings in Python and JSDoc in TypeScript
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx },
  })),
  outputWarning: vi.fn((msg: string) => ({ continue: true, systemMessage: `\u26a0 ${msg}` })),
}));

vi.mock('../../lib/guards.js', () => ({
  guardCodeFiles: vi.fn(() => null),
  guardSkipInternal: vi.fn(() => null),
  runGuards: vi.fn(() => null),
  isDontAskMode: vi.fn(() => false),
}));

import { docstringEnforcer } from '../../pretool/Write/docstring-enforcer.js';
import type { HookInput } from '../../types.js';
import { isDontAskMode } from '../../lib/guards.js';

function createWriteInput(filePath: string, content: string): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content },
  };
}

describe('docstring-enforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDontAskMode).mockReturnValue(false);
  });

  it('returns silent success for empty file path or content', () => {
    const input = createWriteInput('', '');
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips test files without checking docstrings', () => {
    const content = `def test_something():\n    assert True`;
    const input = createWriteInput('tests/test_module.py', content);
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns about Python functions missing docstrings', () => {
    const content = `def get_users():\n    return []\n\ndef create_user(name):\n    pass`;
    const input = createWriteInput('src/services/users.py', content);
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('missing docstrings');
    expect(result.hookSpecificOutput?.additionalContext).toContain('get_users');
    expect(result.hookSpecificOutput?.additionalContext).toContain('create_user');
  });

  it('passes Python functions with docstrings', () => {
    const content = `def get_users():\n    """Fetch all users."""\n    return []\n\ndef create_user(name):\n    """Create a new user."""\n    pass`;
    const input = createWriteInput('src/services/users.py', content);
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns about exported TypeScript functions missing JSDoc', () => {
    const content = `export function getUsers() {\n  return [];\n}\n\nexport const createUser = () => {};`;
    const input = createWriteInput('src/services/users.ts', content);
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('missing JSDoc');
    expect(result.hookSpecificOutput?.additionalContext).toContain('getUsers');
  });

  it('returns warning instead of context in dontAsk mode', () => {
    vi.mocked(isDontAskMode).mockReturnValue(true);

    const content = `def process_data():\n    return None`;
    const input = createWriteInput('src/processor.py', content);
    const result = docstringEnforcer(input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Quality Gate');
  });
});

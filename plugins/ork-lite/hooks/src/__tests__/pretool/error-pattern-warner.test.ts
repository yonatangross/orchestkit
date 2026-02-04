/**
 * Unit tests for error-pattern-warner hook
 * Tests matching of commands against known error patterns from rules file
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
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{"rules":[]}'),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { errorPatternWarner } from '../../pretool/bash/error-pattern-warner.js';
import type { HookInput } from '../../types.js';
import { existsSync, readFileSync } from 'node:fs';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('error-pattern-warner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns silent success for empty command', () => {
    const input = createBashInput('');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no error rules file exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const input = createBashInput('npm run build');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('warns about database connection patterns matching known error rules', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        rules: [
          {
            tool: 'Bash',
            signature: 'role "postgres" does not exist',
            pattern: 'psql.*-U',
            occurrence_count: 3,
          },
        ],
      })
    );

    const input = createBashInput('psql -U postgres -d mydb');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('DB role error');
  });

  it('warns about high-occurrence patterns matching command', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        rules: [
          {
            tool: 'Bash',
            signature: 'connection refused',
            pattern: 'docker exec',
            occurrence_count: 8,
            suggested_fix: 'Ensure container is running first',
            sample_input: {
              command: 'docker exec -it my-container psql -U user -d database',
            },
          },
        ],
      })
    );

    const input = createBashInput('docker exec -it my-container psql -U user -d database');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Learned error patterns');
    expect(result.hookSpecificOutput?.additionalContext).toContain('connection refused');
  });

  it('returns silent success when command does not match any rules', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        rules: [
          {
            tool: 'Bash',
            signature: 'module not found',
            pattern: 'import',
            occurrence_count: 2,
          },
        ],
      })
    );

    const input = createBashInput('git status');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles malformed rules file gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('invalid json{');

    const input = createBashInput('npm run build');
    const result = errorPatternWarner(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

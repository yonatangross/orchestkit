import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before import — source uses execFileSync (not execSync)
const mockExecFileSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock('node:path', () => ({
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
}));

vi.mock('../../lib/sanitize-shell.js', () => ({
  assertSafeCommandName: vi.fn((cmd: string) => cmd),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
}));

import { autoLint } from '../../posttool/auto-lint.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
    ...overrides,
  };
}

describe('autoLint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    delete process.env.SKIP_AUTO_LINT;
    // Default: commands exist
    mockExecFileSync.mockReturnValue('');
  });

  it('returns silent success for non-Write/Edit tools', () => {
    // Act
    const result = autoLint(makeInput({ tool_name: 'Read' }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips internal paths like .claude/', () => {
    // Act
    const result = autoLint(makeInput({
      tool_input: { file_path: '/test/project/.claude/config.json', content: '{}' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips node_modules and dist directories', () => {
    // Act
    const r1 = autoLint(makeInput({
      tool_input: { file_path: '/test/project/node_modules/pkg/index.js', content: 'x' },
    }));

    // Assert
    expect(r1.suppressOutput).toBe(true);

    // Act
    const r2 = autoLint(makeInput({
      tool_input: { file_path: '/test/project/dist/bundle.js', content: 'x' },
    }));

    // Assert
    expect(r2.suppressOutput).toBe(true);
  });

  it('skips when SKIP_AUTO_LINT=1', () => {
    // Arrange
    process.env.SKIP_AUTO_LINT = '1';

    // Act
    const result = autoLint(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips unsupported file extensions', () => {
    // Act
    const result = autoLint(makeInput({
      tool_input: { file_path: '/test/project/README.md', content: '# Hello' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('reports lint issues with remaining count for TS files', () => {
    // Arrange — execFileSync receives (cmd, args, opts)
    mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
      if (cmd === 'which') return '/usr/local/bin/biome';
      if (cmd === 'biome' && args?.[0] === 'check') return 'Fixed 1 file\nerror: unused variable\nerror: missing semicolon';
      return '';
    });

    // Act
    const result = autoLint(makeInput({
      tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Auto-lint');
  });

  describe('prettier fallback when biome unavailable', () => {
    beforeEach(() => {
      mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'which' && args?.[0] === 'biome') throw new Error('not found');
        if (cmd === 'which' && args?.[0] === 'prettier') return '/usr/local/bin/prettier';
        if (cmd === 'which') return `/usr/local/bin/${args?.[0]}`;
        return '';
      });
    });

    it('falls back to prettier --write for TS files', () => {
      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
      }));

      // Assert
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier', ['--write', '/test/project/src/app.ts'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });

    it('falls back to prettier --write for JSON files', () => {
      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/config.json', content: '{}' },
      }));

      // Assert
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier', ['--write', '/test/project/config.json'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });

    it('falls back to prettier --write for CSS files', () => {
      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/styles.css', content: 'body{}' },
      }));

      // Assert
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier', ['--write', '/test/project/styles.css'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });
  });

  describe('Python ruff path', () => {
    it('runs ruff check + ruff format for .py files', () => {
      // Arrange
      mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'which') return `/usr/local/bin/${args?.[0]}`;
        return '';
      });

      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/app.py', content: 'x = 1' },
      }));

      // Assert — ruff check --output-format=concise
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'ruff', expect.arrayContaining(['check', '--output-format=concise']),
        expect.objectContaining({ encoding: 'utf8' }),
      );
      // Assert — ruff format
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'ruff', ['format', '/test/project/app.py'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });
  });
});

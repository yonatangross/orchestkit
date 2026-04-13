import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock child_process before import — source uses execFileSync (not execSync)
const mockExecFileSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => 'file-content'),
}));

const mockDigest = vi.fn(() => 'abc123');
const mockUpdate = vi.fn(() => ({ digest: mockDigest }));
vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({ update: mockUpdate })),
}));

vi.mock('node:path', () => {
  const named = { basename: vi.fn((p: string) => p.split('/').pop() || ''), join: vi.fn((...a: string[]) => a.join('/')), dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')), resolve: vi.fn((...a: string[]) => a.join('/')), sep: '/' };
  return { ...named, default: named };
});

vi.mock('../../lib/sanitize-shell.js', () => ({
  assertSafeCommandName: vi.fn((cmd: string) => cmd),
}));

vi.mock('../../lib/common.js', () => mockCommonBasic());

import { autoLint } from '../../posttool/auto-lint.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('autoLint', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    delete process.env.SKIP_AUTO_LINT;
    // Default: commands exist
    mockExecFileSync.mockReturnValue('');
  });

  it('returns silent success for non-Write/Edit tools', () => {
    // Act
    const result = autoLint(makeInput({ tool_name: 'Read' }), testCtx);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips internal paths like .claude/', () => {
    // Act
    const result = autoLint(makeInput({
      tool_input: { file_path: '/test/project/.claude/config.json', content: '{}' },
    }), testCtx);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips node_modules and dist directories', () => {
    // Act
    const r1 = autoLint(makeInput({
      tool_input: { file_path: '/test/project/node_modules/pkg/index.js', content: 'x' },
    }), testCtx);

    // Assert
    expect(r1.suppressOutput).toBe(true);

    // Act
    const r2 = autoLint(makeInput({
      tool_input: { file_path: '/test/project/dist/bundle.js', content: 'x' },
    }), testCtx);

    // Assert
    expect(r2.suppressOutput).toBe(true);
  });

  it('skips when SKIP_AUTO_LINT=1', () => {
    // Arrange
    process.env.SKIP_AUTO_LINT = '1';

    // Act
    const result = autoLint(makeInput(), testCtx);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips unsupported file extensions', () => {
    // Act
    const result = autoLint(makeInput({
      tool_input: { file_path: '/test/project/README.md', content: '# Hello' },
    }), testCtx);

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
    }), testCtx);

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
      }), testCtx);

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
      }), testCtx);

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
      }), testCtx);

      // Assert
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier', ['--write', '/test/project/styles.css'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });
  });

  describe('git add after formatting', () => {
    it('stages file with git add when formatter changes content', () => {
      // Arrange — simulate hash changing (different content before/after)
      let hashCallCount = 0;
      mockDigest.mockImplementation(() => {
        hashCallCount++;
        return hashCallCount <= 1 ? 'hash-before' : 'hash-after';
      });
      mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'which') return `/usr/local/bin/${args?.[0]}`;
        if (cmd === 'biome') return 'Fixed 1 file';
        return '';
      });

      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
      }), testCtx);

      // Assert — git add called with the file path
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git', ['add', '/test/project/src/app.ts'],
        expect.objectContaining({ stdio: 'ignore' }),
      );
    });

    it('skips git add when formatter does not change content', () => {
      // Arrange — same hash before and after (no change)
      mockDigest.mockReturnValue('same-hash');
      mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'which') return `/usr/local/bin/${args?.[0]}`;
        return '';
      });

      // Act
      autoLint(makeInput({
        tool_input: { file_path: '/test/project/src/app.ts', content: 'code' },
      }), testCtx);

      // Assert — git add should NOT be called
      expect(mockExecFileSync).not.toHaveBeenCalledWith(
        'git', expect.anything(),
        expect.anything(),
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
      }), testCtx);

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

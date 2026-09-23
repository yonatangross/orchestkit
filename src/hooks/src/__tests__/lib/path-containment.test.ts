/**
 * Unit tests for lib/path-containment.ts
 *
 * Tests EXCLUDED_DIRS, isInsideDir(), hasExcludedDir(), resolveRealPath()
 * These are security-critical: path traversal and symlink bypass prevention.
 */

import { describe, test, expect, vi, beforeEach, } from 'vitest';
import { sep, join } from 'node:path';

// Mock fs before importing the module
vi.mock('node:fs', () => ({
  realpathSync: vi.fn(),
  lstatSync: vi.fn(() => {
    throw new Error('ENOENT');
  }),
  readlinkSync: vi.fn(),
}));

import { realpathSync, lstatSync, readlinkSync } from 'node:fs';
import {
  EXCLUDED_DIRS,
  isInsideDir,
  hasExcludedDir,
  resolveRealPath,
} from '../../lib/path-containment.js';

const mockRealpathSync = vi.mocked(realpathSync);
const mockLstatSync = vi.mocked(lstatSync);
const mockReadlinkSync = vi.mocked(readlinkSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EXCLUDED_DIRS', () => {
  test('includes all expected directories', () => {
    expect(EXCLUDED_DIRS).toContain('node_modules');
    expect(EXCLUDED_DIRS).toContain('.git');
    expect(EXCLUDED_DIRS).toContain('.github');
    expect(EXCLUDED_DIRS).toContain('.claude');
    expect(EXCLUDED_DIRS).toContain('.husky');
    expect(EXCLUDED_DIRS).toContain('dist');
    expect(EXCLUDED_DIRS).toContain('build');
    expect(EXCLUDED_DIRS).toContain('__pycache__');
    expect(EXCLUDED_DIRS).toContain('.venv');
    expect(EXCLUDED_DIRS).toContain('venv');
  });

  test('has exactly 10 entries', () => {
    expect(EXCLUDED_DIRS).toHaveLength(10);
  });
});

describe('isInsideDir', () => {
  test('returns true for file inside directory', () => {
    expect(isInsideDir('/project/src/file.ts', '/project')).toBe(true);
  });

  test('returns true for file at root of directory', () => {
    expect(isInsideDir('/project/file.ts', '/project')).toBe(true);
  });

  test('returns true for deeply nested file', () => {
    expect(isInsideDir('/project/a/b/c/d/file.ts', '/project')).toBe(true);
  });

  test('returns false for file outside directory', () => {
    expect(isInsideDir('/other/file.ts', '/project')).toBe(false);
  });

  test('returns false for parent directory traversal', () => {
    expect(isInsideDir('/project/../etc/passwd', '/project')).toBe(false);
  });

  test('SEC: prevents prefix attack (/project-evil vs /project)', () => {
    expect(isInsideDir('/project-evil/file.ts', '/project')).toBe(false);
  });

  test('SEC: prevents prefix attack with similar names', () => {
    expect(isInsideDir('/home/user/projectX/file.ts', '/home/user/project')).toBe(false);
  });

  test('returns false for completely unrelated path', () => {
    expect(isInsideDir('/tmp/file.ts', '/home/user/project')).toBe(false);
  });
});

describe('hasExcludedDir', () => {
  test('detects node_modules in middle of path', () => {
    expect(hasExcludedDir(`/project${sep}node_modules${sep}pkg${sep}index.js`)).toBe(true);
  });

  test('detects .git in middle of path', () => {
    expect(hasExcludedDir(`/project${sep}.git${sep}config`)).toBe(true);
  });

  test('detects dist in middle of path', () => {
    expect(hasExcludedDir(`/project${sep}dist${sep}bundle.js`)).toBe(true);
  });

  test('detects excluded dir as terminal segment (no trailing slash)', () => {
    expect(hasExcludedDir(`/project${sep}.git`)).toBe(true);
  });

  test('detects node_modules as terminal segment', () => {
    expect(hasExcludedDir(`/project${sep}node_modules`)).toBe(true);
  });

  test('returns false for normal project paths', () => {
    expect(hasExcludedDir(`/project${sep}src${sep}index.ts`)).toBe(false);
  });

  test('returns false when excluded name is part of a larger name', () => {
    expect(hasExcludedDir(`/project${sep}dist-tools${sep}run.sh`)).toBe(false);
  });

  test('detects .claude and .husky mid-path (#4220 AF-13)', () => {
    expect(hasExcludedDir(`/project${sep}.claude${sep}settings.json`)).toBe(true);
    expect(hasExcludedDir(`/project${sep}.husky${sep}pre-commit`)).toBe(true);
  });

  test('detects .git* prefix segments (#4220 AF-13)', () => {
    expect(hasExcludedDir(`/project${sep}.github${sep}workflows${sep}ci.yml`)).toBe(true);
    expect(hasExcludedDir(`/project${sep}.gitignore${sep}x`)).toBe(true);
  });

  test.each(EXCLUDED_DIRS)('detects %s as mid-path segment', (dir) => {
    expect(hasExcludedDir(`/project${sep}${dir}${sep}file.ts`)).toBe(true);
  });

  test.each(EXCLUDED_DIRS)('detects %s as terminal segment', (dir) => {
    expect(hasExcludedDir(`/project${sep}${dir}`)).toBe(true);
  });
});

describe('resolveRealPath', () => {
  test('resolves absolute path through symlink when file exists', () => {
    mockRealpathSync.mockReturnValue('/real/path/file.ts');

    expect(resolveRealPath('/symlink/path/file.ts', '/project')).toBe('/real/path/file.ts');
    expect(mockRealpathSync).toHaveBeenCalledWith('/symlink/path/file.ts');
  });

  test('on ENOENT realpaths the parent and joins the basename (#4220 AF-15)', () => {
    mockRealpathSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s === '/project/vendor/new.ts') throw new Error('ENOENT');
      if (s === '/project/vendor') return '/outside/real';
      throw new Error(`unexpected realpath: ${s}`);
    });

    expect(resolveRealPath('/project/vendor/new.ts', '/project')).toBe(
      join('/outside/real', 'new.ts'),
    );
  });

  test('returns fail-closed sentinel when no ancestor resolves', () => {
    mockRealpathSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(resolveRealPath('/new/file.ts', '/project')).toBe(
      join('/new', '.claude', '.ork-unresolved-symlink'),
    );
  });

  test('resolves relative path against projectDir', () => {
    const expectedAbsolute = join('/project', 'src/file.ts');
    mockRealpathSync.mockReturnValue(expectedAbsolute);

    expect(resolveRealPath('src/file.ts', '/project')).toBe(expectedAbsolute);
    expect(mockRealpathSync).toHaveBeenCalledWith(expectedAbsolute);
  });

  test('SEC: follows symlink to detect escape from project', () => {
    mockRealpathSync.mockReturnValue('/etc/passwd');

    const resolved = resolveRealPath('/project/evil-link', '/project');
    expect(resolved).toBe('/etc/passwd');
    // Caller (isInsideDir) would then reject this as outside project
  });

  test('dangling leaf symlink returns target joined on real parent', () => {
    mockRealpathSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith('cfg.json') || s.endsWith('settings.local.json')) {
        throw new Error('ENOENT');
      }
      return s;
    });
    mockLstatSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith('cfg.json')) {
        return { isSymbolicLink: () => true } as unknown as import('node:fs').Stats;
      }
      throw new Error('ENOENT');
    });
    mockReadlinkSync.mockReturnValue('../.claude/settings.local.json');

    expect(resolveRealPath('/project/src/cfg.json', '/project')).toBe(
      '/project/.claude/settings.local.json',
    );
  });

  test('dangling symlink chain follows multiple readlink hops', () => {
    mockRealpathSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith('link1.json') || s.endsWith('settings.local.json')) {
        throw new Error('ENOENT');
      }
      return s;
    });
    mockLstatSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith('link1.json') || s.endsWith('link2.json')) {
        return { isSymbolicLink: () => true } as unknown as import('node:fs').Stats;
      }
      throw new Error('ENOENT');
    });
    mockReadlinkSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith('link1.json')) return 'link2.json';
      if (s.endsWith('link2.json')) return '../.claude/settings.local.json';
      throw new Error(`unexpected readlink: ${s}`);
    });

    expect(resolveRealPath('/project/src/link1.json', '/project')).toBe(
      '/project/.claude/settings.local.json',
    );
  });

  test('absent target under a linked parent resolves through the real parent', () => {
    mockRealpathSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s === '/project/notes.md') throw new Error('ENOENT');
      if (s === '/project') return '/project';
      if (s === '/project/sub/hooks') return '/project/.claude/hooks';
      throw new Error(`unexpected realpath: ${s}`);
    });
    mockLstatSync.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s === '/project/notes.md') {
        return { isSymbolicLink: () => true } as unknown as import('node:fs').Stats;
      }
      throw new Error('ENOENT');
    });
    mockReadlinkSync.mockReturnValue('sub/hooks/new.sh');

    expect(resolveRealPath('/project/notes.md', '/project')).toBe(
      '/project/.claude/hooks/new.sh',
    );
  });
});

/**
 * Unit tests for lib/path-containment.ts
 *
 * Tests EXCLUDED_DIRS, isInsideDir(), hasExcludedDir(), resolveRealPath()
 * These are security-critical: path traversal and symlink bypass prevention.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { sep, join } from 'node:path';

// Mock fs before importing the module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  realpathSync: vi.fn(),
}));

import { existsSync, realpathSync } from 'node:fs';
import {
  EXCLUDED_DIRS,
  isInsideDir,
  hasExcludedDir,
  resolveRealPath,
} from '../../lib/path-containment.js';

const mockExistsSync = vi.mocked(existsSync);
const mockRealpathSync = vi.mocked(realpathSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EXCLUDED_DIRS', () => {
  test('includes all expected directories', () => {
    expect(EXCLUDED_DIRS).toContain('node_modules');
    expect(EXCLUDED_DIRS).toContain('.git');
    expect(EXCLUDED_DIRS).toContain('dist');
    expect(EXCLUDED_DIRS).toContain('build');
    expect(EXCLUDED_DIRS).toContain('__pycache__');
    expect(EXCLUDED_DIRS).toContain('.venv');
    expect(EXCLUDED_DIRS).toContain('venv');
  });

  test('has exactly 7 entries', () => {
    expect(EXCLUDED_DIRS).toHaveLength(7);
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

  test('returns false for path with no excluded dirs', () => {
    expect(hasExcludedDir(`/home${sep}user${sep}project${sep}lib${sep}utils.ts`)).toBe(false);
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
    mockExistsSync.mockReturnValue(true);
    mockRealpathSync.mockReturnValue('/real/path/file.ts');

    expect(resolveRealPath('/symlink/path/file.ts', '/project')).toBe('/real/path/file.ts');
    expect(mockRealpathSync).toHaveBeenCalledWith('/symlink/path/file.ts');
  });

  test('returns original absolute path when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    expect(resolveRealPath('/new/file.ts', '/project')).toBe('/new/file.ts');
    expect(mockRealpathSync).not.toHaveBeenCalled();
  });

  test('resolves relative path against projectDir', () => {
    mockExistsSync.mockReturnValue(true);
    const expectedAbsolute = join('/project', 'src/file.ts');
    mockRealpathSync.mockReturnValue(expectedAbsolute);

    expect(resolveRealPath('src/file.ts', '/project')).toBe(expectedAbsolute);
    expect(mockExistsSync).toHaveBeenCalledWith(expectedAbsolute);
  });

  test('returns raw path on realpathSync error', () => {
    mockExistsSync.mockReturnValue(true);
    mockRealpathSync.mockImplementation(() => { throw new Error('ELOOP'); });

    expect(resolveRealPath('/loop/file.ts', '/project')).toBe('/loop/file.ts');
  });

  test('SEC: follows symlink to detect escape from project', () => {
    mockExistsSync.mockReturnValue(true);
    mockRealpathSync.mockReturnValue('/etc/passwd');

    const resolved = resolveRealPath('/project/evil-link', '/project');
    expect(resolved).toBe('/etc/passwd');
    // Caller (isInsideDir) would then reject this as outside project
  });
});

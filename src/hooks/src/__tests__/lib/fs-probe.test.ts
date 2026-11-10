/**
 * isSymlinkPath: true only for the link itself; a real directory, a regular
 * file and a missing path are all false (lstat, not stat).
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSymlinkPath } from '../../lib/fs-probe.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fs-probe-'));
  mkdirSync(join(root, 'real'));
  writeFileSync(join(root, 'file'), 'x');
  symlinkSync(join(root, 'real'), join(root, 'link-to-dir'));
  symlinkSync(join(root, 'nowhere'), join(root, 'dangling'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('isSymlinkPath', () => {
  it('is true for a symlink to a directory', () => {
    expect(isSymlinkPath(join(root, 'link-to-dir'))).toBe(true);
  });

  it('is true for a dangling symlink', () => {
    expect(isSymlinkPath(join(root, 'dangling'))).toBe(true);
  });

  it('is false for a real directory and a regular file', () => {
    expect(isSymlinkPath(join(root, 'real'))).toBe(false);
    expect(isSymlinkPath(join(root, 'file'))).toBe(false);
  });

  it('is false for a missing path', () => {
    expect(isSymlinkPath(join(root, 'missing'))).toBe(false);
  });
});

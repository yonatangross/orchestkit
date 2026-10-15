/**
 * Whether a dir is inside a git work tree: a .git (dir or file) at it or
 * above it. The review-post gate takes the cwd as the repo root, so a cwd with
 * none is no repo (#4678, HOLD 6095687461 should 4). Lives in lib/ because it
 * reads the file system (FH-ready rule).
 *
 * The walk stops below HOME, and a .git at /, at HOME or directly in a temp
 * dir does not count: a stray or planted one there would make every dir under
 * it a repo (HOLD 6096088108 should 2).
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';

export interface RepoWalkBounds {
  /** HOME: the walk stops before it. */
  home?: string;
  /** Temp dirs: a .git directly in one does not count. */
  temps?: string[];
}

const key = (d: string) => posix.normalize(d).replace(/\/+$/, '').toLowerCase();

/**
 * A git dir itself (a bare repo, or one made with --separate-git-dir) has no
 * .git entry, only HEAD and objects/; its hooks run all the same (HOLD
 * 6096491908 should 2).
 */
function isGitDir(dir: string): boolean {
  return existsSync(posix.join(dir, 'HEAD')) && existsSync(posix.join(dir, 'objects'));
}

export function inGitRepo(dir: string, bounds: RepoWalkBounds = {}): boolean {
  if (!dir.startsWith('/')) return false;
  const home = bounds.home ? key(bounds.home) : '';
  const skip = new Set((bounds.temps ?? []).map(key));
  let cur = posix.normalize(dir).replace(/\/+$/, '') || '/';
  for (;;) {
    const k = key(cur);
    if (cur === '/' || k === '' || k === home) return false;
    if (!skip.has(k) && (existsSync(posix.join(cur, '.git')) || isGitDir(cur))) return true;
    cur = posix.dirname(cur);
  }
}

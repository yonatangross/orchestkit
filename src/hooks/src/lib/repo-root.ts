/**
 * Whether a dir is inside a git work tree: a .git (dir or file) at it or
 * above it. The review-post gate takes the cwd as the repo root, so a cwd with
 * none is no repo (#4678, HOLD 6095687461 should 4). Lives in lib/ because it
 * reads the file system (FH-ready rule).
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';

export function inGitRepo(dir: string): boolean {
  if (!dir.startsWith('/')) return false;
  let cur = posix.normalize(dir);
  for (;;) {
    if (existsSync(posix.join(cur, '.git'))) return true;
    const up = posix.dirname(cur);
    if (up === cur) return false;
    cur = up;
  }
}

/**
 * Real path of a path for the review-post gate (#4678, HOLD 6085798647):
 * symlinks resolved on the longest existing prefix, and the macOS firmlink
 * prefix /System/Volumes/Data dropped, so a string compare against a
 * protected dir cannot be beaten by another spelling of the same file.
 * Lives in lib/ because it reads the file system (FH-ready rule).
 */
import { lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { posix } from 'node:path';

const FIRMLINK = /^\/system\/volumes\/data(?=\/)/i;

export function realPath(p: string, depth = 0): string {
  const abs = posix.normalize(p).replace(FIRMLINK, '');
  // Resolve the longest prefix that exists, then append the rest unchanged.
  const parts = abs.split('/');
  for (let i = parts.length; i > 1; i -= 1) {
    const head = parts.slice(0, i).join('/') || '/';
    try {
      const real = realpathSync.native(head).replace(FIRMLINK, '');
      const tail = parts.slice(i).join('/');
      return tail ? posix.join(real, tail) : real;
    } catch {
      // A dangling link has no real path, but a write through it lands where
      // it points (HOLD 6086210644 should 4): follow it, 40 links at most.
      try {
        if (depth < 40 && lstatSync(head).isSymbolicLink()) {
          const target = posix.resolve(posix.dirname(head), readlinkSync(head));
          const tail = parts.slice(i).join('/');
          return realPath(tail ? posix.join(target, tail) : target, depth + 1);
        }
      } catch {
        // Not there at all: try a shorter prefix.
      }
    }
  }
  return abs;
}

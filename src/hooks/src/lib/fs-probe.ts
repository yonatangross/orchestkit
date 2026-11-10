/**
 * Small filesystem probes for handlers that must not import node:fs
 * themselves (FH-ready policy, .claude/rules/hooks-development.md): the
 * handler takes these through an injected deps object.
 */
import { lstatSync } from 'node:fs';

/** True when `path` exists and is a symbolic link (the link itself, not its target). */
export function isSymlinkPath(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    // silent: a missing path is not a link; lstat throws ENOENT for it
    return false;
  }
}

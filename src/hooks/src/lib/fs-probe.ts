/**
 * Small filesystem probes for handlers that must not import node:fs
 * themselves (FH-ready policy, .claude/rules/hooks-development.md): the
 * handler takes these through an injected deps object.
 */
import { lstatSync } from 'node:fs';

/**
 * True when `path` is a symbolic link (the link itself, not its target).
 * A missing path (ENOENT, ENOTDIR) is not a link. Any other lstat error means
 * the path could not be inspected, and answers true so a guard built on this
 * fails closed rather than letting a destructive command through.
 */
export function isSymlinkPath(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return !(code === 'ENOENT' || code === 'ENOTDIR');
  }
}

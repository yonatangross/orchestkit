/**
 * Small filesystem probes for handlers that must not import node:fs
 * themselves (FH-ready policy, .claude/rules/hooks-development.md): the
 * handler takes these through an injected deps object.
 */
import { lstatSync, readdirSync, realpathSync } from 'node:fs';

/**
 * The names of the real subdirectories of `path` (symbolic links are not followed or listed), or []
 * when it cannot be listed. Used by guards that search a tree for a link; a symlinked directory
 * is not entered, so the search cannot loop.
 */
export function listSubdirs(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

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

/**
 * The physical path of `path` with every symlink in it dereferenced, or null
 * when it cannot be resolved (a missing component, a dangling link). Used by
 * guards that model `cd -P`, which fails when any component does not exist;
 * the null carries that failure so the caller fails closed.
 */
export function realpathPath(path: string): string | null {
  try {
    return realpathSync.native(path);
  } catch {
    return null;
  }
}

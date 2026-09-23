/**
 * Path Containment Utilities
 *
 * Shared path validation for project directory containment checks.
 * Used by auto-approve-project-writes.ts and project-write-retry.ts.
 *
 * SEC: resolveRealPath follows symlinks before containment checks (ME-001).
 * SEC: isInsideDir uses relative() not startsWith() to prevent prefix attacks.
 * SEC #4220 AF-13: EXCLUDED_DIRS includes .github / .claude / .husky; segments
 * matching .git* are also excluded.
 * SEC #4220 AF-15: on ENOENT, realpath the parent so symlink-dir + new file
 * cannot escape via an unresolved lexical path.
 *
 * @since v7.27.1
 */

import { resolve, isAbsolute, relative, normalize, sep, dirname, basename, join } from 'node:path';
import { realpathSync, lstatSync, readlinkSync } from 'node:fs';
import type { Stats } from 'node:fs';

/**
 * Directories that should not be auto-approved or retried for writes.
 * #4220 AF-13: .github, .claude, .husky added. Any path segment matching
 * `.git*` (prefix) is also excluded in hasExcludedDir (covers .git, .github,
 * .gitignore dirs, etc.).
 */
export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.github',
  '.claude',
  '.husky',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'venv',
];

/**
 * Check if a file path is inside a given root directory (safe containment check).
 * Guards against prefix attacks (e.g. /project-evil vs /project).
 */
export function isInsideDir(filePath: string, rootDir: string): boolean {
  const rel = relative(normalize(rootDir), normalize(filePath));
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Check if a file path contains an excluded directory segment.
 * Exact EXCLUDED_DIRS matches, plus any segment starting with `.git` (#4220 AF-13).
 * Segment compares are case-insensitive.
 */
export function hasExcludedDir(filePath: string): boolean {
  const parts = normalize(filePath).split(sep).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('.git')) return true;
    if (EXCLUDED_DIRS.includes(lower)) return true;
  }
  return false;
}

/**
 * Resolve file path, following symlinks before containment checks.
 * Pattern from file-guard.ts (ME-001 fix).
 *
 * #4220 AF-15: when the leaf does not exist (ENOENT), realpath the parent
 * directory and join the basename. A committed symlink directory plus a
 * new-file write must not escape via the unresolved lexical path.
 *
 * Dangling leaf symlink chain: realpathSync fails, but links still name
 * targets. Follow readlink hops (cap MAX_SYMLINK_HOPS) relative to each
 * link's real parent so a denylist sees `.claude/settings.local.json`
 * instead of an intermediate link path. If hops cannot be resolved or the
 * cap is hit, return a path under `.claude` so auto-approve passes through.
 */
const MAX_SYMLINK_HOPS = 40;

/**
 * Walk up to the nearest existing ancestor, realpath it, then join the
 * remaining unresolved segments. Fail closed if no ancestor resolves.
 */
function resolveViaNearestAncestor(absolutePath: string): string {
  const missing: string[] = [];
  let cursor = absolutePath;
  for (;;) {
    try {
      const real = realpathSync(cursor);
      return missing.length === 0 ? real : join(real, ...missing.reverse());
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) {
        return join(dirname(absolutePath), '.claude', '.ork-unresolved-symlink');
      }
      missing.push(basename(cursor));
      cursor = parent;
    }
  }
}

/** Join onto the real ancestor chain; fail closed if nothing resolves. */
function joinOnRealParent(targetPath: string): string {
  return resolveViaNearestAncestor(targetPath);
}

export function resolveRealPath(filePath: string, projectDir: string): string {
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : resolve(projectDir, filePath);

  try {
    // Call realpathSync directly; avoids TOCTOU race between existsSync and realpathSync
    return realpathSync(absolutePath);
  } catch {
    // Dangling or otherwise unresolvable leaf symlink chain: follow readlink hops.
    try {
      const st = lstatSync(absolutePath);
      if (st.isSymbolicLink()) {
        let current = absolutePath;
        for (let hop = 0; hop < MAX_SYMLINK_HOPS; hop++) {
          let curStat: Stats;
          try {
            curStat = lstatSync(current);
          } catch {
            // Target absent: realpath the nearest existing ancestor.
            return joinOnRealParent(current);
          }
          if (!curStat.isSymbolicLink()) {
            try {
              return realpathSync(current);
            } catch {
              return joinOnRealParent(current);
            }
          }
          try {
            const parentReal = realpathSync(dirname(current));
            const linkTarget = readlinkSync(current);
            current = isAbsolute(linkTarget)
              ? normalize(linkTarget)
              : resolve(parentReal, linkTarget);
          } catch {
            return join(dirname(current), '.claude', '.ork-unresolved-symlink');
          }
        }
        // Cap exceeded: do not treat the start link as safe.
        return join(dirname(absolutePath), '.claude', '.ork-unresolved-symlink');
      }
    } catch {
      // Not a symlink (or leaf missing): fall through to AF-15.
    }

    // AF-15 / missing parents: walk up to the nearest existing ancestor.
    return resolveViaNearestAncestor(absolutePath);
  }
}

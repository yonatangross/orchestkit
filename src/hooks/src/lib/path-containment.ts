/**
 * Path Containment Utilities
 *
 * Shared path validation for project directory containment checks.
 * Used by auto-approve-project-writes.ts and project-write-retry.ts.
 *
 * SEC: resolveRealPath follows symlinks to prevent bypass attacks (ME-001).
 * SEC: isInsideDir uses relative() not startsWith() to prevent prefix attacks.
 *
 * @since v7.27.1
 */

import { resolve, isAbsolute, relative, normalize, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

/**
 * Directories that should not be auto-approved or retried for writes.
 */
export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
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
 */
export function hasExcludedDir(filePath: string): boolean {
  for (const dir of EXCLUDED_DIRS) {
    if (filePath.includes(`${sep}${dir}${sep}`) || filePath.endsWith(`${sep}${dir}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve file path, following symlinks to prevent bypass attacks.
 * Pattern from file-guard.ts (ME-001 fix).
 */
export function resolveRealPath(filePath: string, projectDir: string): string {
  try {
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : resolve(projectDir, filePath);

    if (existsSync(absolutePath)) {
      return realpathSync(absolutePath);
    }

    return absolutePath;
  } catch {
    return filePath;
  }
}

/**
 * Auto-Approve Project Writes - Auto-approves writes within project directory
 * Hook: PermissionRequest (Write|Edit)
 * CC 2.1.6 Compliant: includes continue field in all outputs
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentAllow,
  outputSilentSuccess,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../lib/common.js';
import { resolve, isAbsolute, relative, normalize, sep } from 'node:path';

/**
 * Directories that should not be auto-approved for writes
 */
const EXCLUDED_DIRS = [
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
function isInsideDir(filePath: string, rootDir: string): boolean {
  const rel = relative(normalize(rootDir), normalize(filePath));
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Check if a file path contains an excluded directory segment.
 */
function hasExcludedDir(filePath: string): boolean {
  for (const dir of EXCLUDED_DIRS) {
    if (filePath.includes(`${sep}${dir}${sep}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Auto-approve writes within project directory or any /add-dir added directories
 * (excluding sensitive directories). CC 2.1.47: respects added_dirs from statusline.
 */
export function autoApproveProjectWrites(input: HookInput): HookResult {
  let filePath = input.tool_input.file_path || '';
  const projectDir = input.project_dir || getProjectDir();

  logHook('auto-approve-project-writes', `Evaluating write to: ${filePath}`);

  // Resolve to absolute path if relative
  if (!isAbsolute(filePath)) {
    filePath = resolve(projectDir, filePath);
  }

  // All directories to check: primary project dir + any /add-dir dirs (CC 2.1.47)
  const rootDirs = [projectDir, ...(input.added_dirs ?? [])];

  for (const rootDir of rootDirs) {
    if (!isInsideDir(filePath, rootDir)) continue;

    if (hasExcludedDir(filePath)) {
      logHook('auto-approve-project-writes', `Write to excluded directory in: ${rootDir}`);
      return outputSilentSuccess(); // Let user decide
    }

    const label = rootDir === projectDir ? 'project directory' : `added dir ${rootDir}`;
    logHook('auto-approve-project-writes', `Auto-approved: within ${label}`);
    logPermissionFeedback('allow', `In-project write: ${filePath}`, input);
    return outputSilentAllow();
  }

  // Outside all known directories - let user decide
  logHook('auto-approve-project-writes', 'Write outside project directory - manual approval required');
  return outputSilentSuccess();
}

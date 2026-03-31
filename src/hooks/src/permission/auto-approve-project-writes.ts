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
import { isInsideDir, hasExcludedDir } from '../lib/path-containment.js';
import { resolve, isAbsolute } from 'node:path';

/**
 * Auto-approve writes within project directory or any /add-dir added directories
 * (excluding sensitive directories). CC 2.1.47: respects added_dirs from statusline.
 */
export function autoApproveProjectWrites(input: HookInput): HookResult {
  let filePath = input.tool_input.file_path || '';
  const projectDir = input.project_dir || getProjectDir();

  logHook('auto-approve-project-writes', `Evaluating write to: ${filePath}`);

  // CC >= 2.1.88: file_path always absolute for Write/Edit/Read. Kept for CC < 2.1.88 compat.
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

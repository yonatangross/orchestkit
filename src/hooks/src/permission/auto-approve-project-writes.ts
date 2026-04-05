/**
 * Auto-Approve Project Writes - Auto-approves writes within project directory
 * Hook: PermissionRequest (Write|Edit)
 * CC 2.1.6 Compliant: includes continue field in all outputs
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import {
  outputSilentAllow,
  outputSilentSuccess,
} from '../lib/common.js';
import { isInsideDir, hasExcludedDir, resolveRealPath } from '../lib/path-containment.js';
import { resolve, isAbsolute } from 'node:path';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Auto-approve writes within project directory or any /add-dir added directories
 * (excluding sensitive directories). CC 2.1.47: respects added_dirs from statusline.
 */
export function autoApproveProjectWrites(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  let filePath = input.tool_input.file_path || '';
  const projectDir = input.project_dir || (ctx.projectDir);

  ctx.log('auto-approve-project-writes', `Evaluating write to: ${filePath}`);

  // Defense in depth: resolve relative paths even though CC >= 2.1.88 guarantees absolute
  if (!isAbsolute(filePath)) {
    filePath = resolve(projectDir, filePath);
  }

  // SEC: Resolve symlinks to prevent bypass attacks (ME-001 / SEC-3)
  filePath = resolveRealPath(filePath, projectDir);

  // All directories to check: primary project dir + any /add-dir dirs (CC 2.1.47)
  // SEC-003: Validate added_dirs — reject filesystem root or sensitive directories
  const safeAddedDirs = (input.added_dirs ?? []).filter(dir =>
    dir.length > 1 && !dir.includes('..') && !['/etc', '/usr', '/var'].some(s => dir.startsWith(s))
  );
  const rootDirs = [projectDir, ...safeAddedDirs];

  for (const rootDir of rootDirs) {
    if (!isInsideDir(filePath, rootDir)) continue;

    if (hasExcludedDir(filePath)) {
      ctx.log('auto-approve-project-writes', `Write to excluded directory in: ${rootDir}`);
      return outputSilentSuccess(); // Let user decide
    }

    const label = rootDir === projectDir ? 'project directory' : `added dir ${rootDir}`;
    ctx.log('auto-approve-project-writes', `Auto-approved: within ${label}`);
    ctx.logPermission('allow', `In-project write: ${filePath}`, input);
    return outputSilentAllow();
  }

  // Outside all known directories - let user decide
  ctx.log('auto-approve-project-writes', 'Write outside project directory - manual approval required');
  return outputSilentSuccess();
}

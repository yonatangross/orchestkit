/**
 * Auto-Approve Project Writes - Auto-approves writes within project directory
 * Hook: PermissionRequest (Write|Edit)
 *
 * OPT-IN (#4374 security hold): emits allow only when
 * ORK_PERMISSION_AUTO_APPROVE=1. Default OFF so CC shows its normal dialog.
 * Hard denylist (settings*.json, .mcp.json, plugin.json, .claude/**, .github/**,
 * .husky/**, .env*) is enforced even when enabled; see lib/permission-auto-approve.ts.
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import {
  outputPermissionRequestAllow,
  outputSilentSuccess,
} from '../lib/common.js';
import { isInsideDir, hasExcludedDir, resolveRealPath } from '../lib/path-containment.js';
import {
  isPermissionAutoApproveEnabled,
  isHardDeniedWritePath,
} from '../lib/permission-auto-approve.js';
import { resolve, isAbsolute } from 'node:path';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Auto-approve writes within project directory or any /add-dir added directories
 * (excluding sensitive directories). CC 2.1.47: respects added_dirs from statusline.
 */
export function autoApproveProjectWrites(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  if (!isPermissionAutoApproveEnabled()) {
    ctx.log('auto-approve-project-writes', 'ORK_PERMISSION_AUTO_APPROVE not set; pass-through');
    return outputSilentSuccess();
  }

  let filePath = input.tool_input.file_path || '';
  const projectDir = input.project_dir || (ctx.projectDir);

  ctx.log('auto-approve-project-writes', `Evaluating write to: ${filePath}`);

  // Defense in depth: resolve relative paths even though CC >= 2.1.88 guarantees absolute
  if (!isAbsolute(filePath)) {
    filePath = resolve(projectDir, filePath);
  }

  // SEC: Resolve symlinks to prevent bypass attacks (ME-001 / SEC-3)
  filePath = resolveRealPath(filePath, projectDir);

  // SEC (#4374): hard denylist on the resolved real path, before any allow
  if (isHardDeniedWritePath(filePath)) {
    ctx.log('auto-approve-project-writes', `Hard-denied write path: ${filePath}`);
    return outputSilentSuccess();
  }

  // All directories to check: primary project dir + any /add-dir dirs (CC 2.1.47)
  // SEC-003: Validate added_dirs; reject filesystem root or sensitive directories
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
    return outputPermissionRequestAllow();
  }

  // Outside all known directories - let user decide
  ctx.log('auto-approve-project-writes', 'Write outside project directory - manual approval required');
  return outputSilentSuccess();
}

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
import { resolve, isAbsolute } from 'node:path';

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
 * Auto-approve writes within project directory (excluding sensitive directories)
 */
export function autoApproveProjectWrites(input: HookInput): HookResult {
  let filePath = input.tool_input.file_path || '';
  const projectDir = getProjectDir();

  logHook('auto-approve-project-writes', `Evaluating write to: ${filePath}`);

  // Resolve to absolute path if relative
  if (!isAbsolute(filePath)) {
    filePath = resolve(projectDir, filePath);
  }

  // Check if file is within project directory
  if (filePath.startsWith(projectDir)) {
    // Check against excluded directories
    for (const dir of EXCLUDED_DIRS) {
      if (filePath.includes(`/${dir}/`)) {
        logHook('auto-approve-project-writes', `Write to excluded directory: ${dir}`);
        return outputSilentSuccess(); // Let user decide
      }
    }

    logHook('auto-approve-project-writes', 'Auto-approved: within project directory');
    logPermissionFeedback('allow', `In-project write: ${filePath}`, input);
    return outputSilentAllow();
  }

  // Outside project directory - let user decide
  logHook('auto-approve-project-writes', 'Write outside project directory - manual approval required');
  return outputSilentSuccess();
}

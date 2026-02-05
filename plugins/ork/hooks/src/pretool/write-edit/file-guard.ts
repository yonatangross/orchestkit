/**
 * File Guard Hook
 * Protects sensitive files from modification
 * CC 2.1.7 Compliant
 *
 * SECURITY: Resolves symlinks before checking patterns (ME-001 fix)
 * to prevent symlink-based bypasses of file protection.
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { realpathSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

/**
 * Protected file patterns - files that should NEVER be modified
 */
const PROTECTED_PATTERNS: RegExp[] = [
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  /credentials\.json$/,
  /secrets\.json$/,
  /private\.key$/,
  /\.pem$/,
  /id_rsa$/,
  /id_ed25519$/,
];

/**
 * Config patterns - files to warn about but allow
 */
const CONFIG_PATTERNS: RegExp[] = [
  /package\.json$/,
  /pyproject\.toml$/,
  /tsconfig\.json$/,
];

/**
 * Resolve file path, following symlinks
 */
function resolveRealPath(filePath: string, projectDir: string): string {
  try {
    // Make absolute if relative
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : resolve(projectDir, filePath);

    // Follow symlinks if file exists
    if (existsSync(absolutePath)) {
      return realpathSync(absolutePath);
    }

    return absolutePath;
  } catch {
    return filePath;
  }
}

/**
 * Check if file matches protected patterns
 */
function isProtected(realPath: string): RegExp | null {
  for (const pattern of PROTECTED_PATTERNS) {
    if (pattern.test(realPath)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Check if file is a config file
 */
function isConfigFile(realPath: string): boolean {
  return CONFIG_PATTERNS.some((pattern) => pattern.test(realPath));
}

/**
 * Guard against modifying sensitive files
 */
export function fileGuard(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const projectDir = getProjectDir();

  if (!filePath) {
    return outputSilentSuccess();
  }

  logHook('file-guard', `File write/edit: ${filePath}`);

  // Resolve symlinks to prevent bypass attacks (ME-001 fix)
  const realPath = resolveRealPath(filePath, projectDir);
  logHook('file-guard', `Resolved path: ${realPath}`);

  // Check if file matches protected patterns
  const matchedPattern = isProtected(realPath);

  if (matchedPattern) {
    logPermissionFeedback('deny', `Protected file blocked: ${filePath} (pattern: ${matchedPattern})`, input);
    logHook('file-guard', `BLOCKED: ${filePath} matches ${matchedPattern}`);

    return outputDeny(
      `Cannot modify protected file: ${filePath}

Resolved path: ${realPath}
Matched pattern: ${matchedPattern}

Protected files include:
- Environment files (.env, .env.local, .env.production)
- Credential files (credentials.json, secrets.json)
- Private keys (.pem, id_rsa, id_ed25519)

If you need to modify this file, do it manually outside Claude Code.`
    );
  }

  // Warn on config files (but allow)
  if (isConfigFile(realPath)) {
    logHook('file-guard', `WARNING: Config file modification: ${realPath}`);
    logPermissionFeedback('warn', `Config file modification: ${filePath}`, input);
  }

  // Allow the write
  logPermissionFeedback('allow', `File write allowed: ${filePath}`, input);
  return outputSilentSuccess();
}

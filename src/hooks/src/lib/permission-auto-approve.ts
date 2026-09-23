/**
 * PermissionRequest auto-approve gates (security hold on #4374 / F11).
 *
 * Default OFF: emitting decision.behavior allow without an opt-in would
 * silently approve Write/Edit to privilege and sink-config files. Operators
 * must set ORK_PERMISSION_AUTO_APPROVE=1 to enable the three PermissionRequest
 * auto-approve hooks (project-writes, safe-bash, learning-tracker).
 *
 * Hard denylist (always, even when enabled): resolved real paths that match
 * settings*.json, .mcp.json, plugin.json, .claude/**, .github/**, .husky/**,
 * .env / .env.*, and every file lib/sink-registry.ts reads
 * (plugin.json, .claude/settings.local.json).
 */

import { basename, normalize, sep } from 'node:path';

/** Env flag. Only the string "1" enables auto-approve. Default: off. */
export const PERMISSION_AUTO_APPROVE_ENV = 'ORK_PERMISSION_AUTO_APPROVE';

export function isPermissionAutoApproveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[PERMISSION_AUTO_APPROVE_ENV] === '1';
}

/**
 * True when a resolved absolute path must never be auto-approved for Write/Edit.
 * Callers must pass resolveRealPath() output so ../ and symlinks cannot slip past.
 */
export function isHardDeniedWritePath(resolvedPath: string): boolean {
  const normalized = normalize(resolvedPath);
  const base = basename(normalized);
  const parts = normalized.split(sep).filter(Boolean);

  // settings*.json at any depth (settings.json, settings.local.json, settings.foo.json)
  if (/^settings.*\.json$/i.test(base)) return true;

  if (base === '.mcp.json') return true;
  if (base === 'plugin.json') return true;

  // .env and .env.*
  if (base === '.env' || base.startsWith('.env.')) return true;

  // Directory trees: .claude, .github, .husky (segment match)
  for (const seg of parts) {
    if (seg === '.claude' || seg === '.github' || seg === '.husky') return true;
  }

  return false;
}

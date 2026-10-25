/**
 * PermissionRequest auto-approve gates (security hold on #4374 / F11).
 *
 * Default OFF: emitting decision.behavior allow without an opt-in would
 * silently approve Write/Edit to privilege and sink-config files. Operators
 * must set ORK_PERMISSION_AUTO_APPROVE=1 to enable the three PermissionRequest
 * auto-approve hooks (project-writes, safe-bash, learning-tracker).
 *
 * Hard denylist (always, even when enabled): paths that match
 * settings*.json, .mcp.json, plugin.json, .git*, .claude/**, .github/**, .husky/**,
 * .env / .env.*, and every file lib/sink-registry.ts reads
 * (plugin.json, .claude/settings.local.json).
 *
 * Also denied: files whose content later runs as code or configures a tool
 * that does (package.json, pyproject.toml, Makefile, conftest.py, .envrc,
 * .npmrc, shell rc files, .vscode/**, .idea/**), agent instruction files
 * (CLAUDE.md, AGENTS.md), and .ssh/**. An auto-approved write to one of
 * these plus an auto-approved test or script run is code execution.
 *
 * Callers check BOTH the requested path and its symlink-resolved target:
 * a protected name can point at an ordinary file, and the reverse.
 */

import { basename, normalize, sep } from 'node:path';

/** Env flag. Only the string "1" enables auto-approve. Default: off. */
export const PERMISSION_AUTO_APPROVE_ENV = 'ORK_PERMISSION_AUTO_APPROVE';

export function isPermissionAutoApproveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[PERMISSION_AUTO_APPROVE_ENV] === '1';
}

/** Basenames (lowercase) that are never auto-approved for Write/Edit. */
const DENIED_BASENAMES = new Set([
  '.mcp.json',
  'plugin.json',
  '.envrc',
  '.npmrc',
  'claude.md',
  'agents.md',
  'package.json',
  'pyproject.toml',
  'makefile',
  'gnumakefile',
  'conftest.py',
  // shell startup files
  '.bashrc',
  '.bash_profile',
  '.bash_login',
  '.bash_logout',
  '.profile',
  '.zshrc',
  '.zshenv',
  '.zprofile',
  '.zlogin',
  '.zlogout',
  '.kshrc',
  '.cshrc',
  '.tcshrc',
]);

/** Directory segments (lowercase) whose whole tree is never auto-approved. */
const DENIED_SEGMENTS = new Set(['.claude', '.github', '.husky', '.vscode', '.idea', '.ssh']);

/**
 * True when a path must never be auto-approved for Write/Edit.
 * Callers pass BOTH the normalized requested path and the resolveRealPath()
 * target, and deny when either matches.
 * Comparison is case-insensitive (macOS APFS default).
 */
export function isHardDeniedWritePath(resolvedPath: string): boolean {
  const normalized = normalize(resolvedPath);
  const base = basename(normalized).toLowerCase();
  const parts = normalized.split(sep).filter(Boolean).map((p) => p.toLowerCase());

  // settings*.json at any depth (settings.json, settings.local.json, settings.foo.json)
  if (/^settings.*\.json$/.test(base)) return true;

  if (DENIED_BASENAMES.has(base)) return true;

  // .env and .env.*
  if (base === '.env' || base.startsWith('.env.')) return true;

  // Directory trees / prefixes: .git*, plus DENIED_SEGMENTS (segment match)
  for (const seg of parts) {
    if (seg.startsWith('.git')) return true;
    if (DENIED_SEGMENTS.has(seg)) return true;
  }

  return false;
}

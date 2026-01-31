/**
 * Smart Session ID Generator
 * Generates human-readable session IDs when CLAUDE_SESSION_ID is not available.
 *
 * Format: {project}-{branch}-{MMDD}-{HHMM}-{hash4}
 * Example: "orchestkit-main-0130-1745-a3f2"
 *
 * Benefits:
 * - Human-readable at a glance
 * - Contains project context
 * - Contains branch info
 * - Chronologically sortable (date-time)
 * - Short unique suffix prevents collisions
 * - Valid file path characters only
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum length for project name component */
const MAX_PROJECT_LENGTH = 20;

/** Maximum length for branch name component */
const MAX_BRANCH_LENGTH = 15;

/** Characters allowed in session ID (safe for file paths) */
const SAFE_CHARS = /[^a-z0-9-]/g;

// =============================================================================
// SESSION ID GENERATION
// =============================================================================

/**
 * Get project name from directory path
 * Sanitizes to lowercase alphanumeric with dashes
 */
export function getProjectName(projectDir?: string): string {
  const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const name = basename(dir);
  return sanitizeName(name, MAX_PROJECT_LENGTH);
}

/**
 * Get git branch name (cached for performance)
 * Returns 'nobranch' if git is not available or not in a repo
 */
export function getGitBranchForSession(projectDir?: string): string {
  // Check cache first
  if (process.env.ORCHESTKIT_SESSION_BRANCH) {
    return process.env.ORCHESTKIT_SESSION_BRANCH;
  }

  const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  try {
    const branch = execSync('git branch --show-current', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const sanitized = sanitizeName(branch || 'detached', MAX_BRANCH_LENGTH);
    process.env.ORCHESTKIT_SESSION_BRANCH = sanitized;
    return sanitized;
  } catch {
    return 'nobranch';
  }
}

/**
 * Format current date as MMDD
 */
export function formatDateComponent(date?: Date): string {
  const d = date || new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}${day}`;
}

/**
 * Format current time as HHMM (24-hour)
 */
export function formatTimeComponent(date?: Date): string {
  const d = date || new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

/**
 * Generate short hash for uniqueness (4 hex chars)
 * Uses PID + timestamp + random for entropy
 */
export function generateShortHash(): string {
  const entropy = `${process.pid}-${Date.now()}-${Math.random()}`;
  return createHash('sha256')
    .update(entropy)
    .digest('hex')
    .slice(0, 4);
}

/**
 * Sanitize a name for use in session ID
 * - Lowercase
 * - Replace non-alphanumeric with dashes
 * - Collapse multiple dashes
 * - Trim dashes from ends
 * - Truncate to max length
 */
export function sanitizeName(name: string, maxLength: number): string {
  return name
    .toLowerCase()
    .replace(SAFE_CHARS, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}

/**
 * Generate a smart session ID
 *
 * Format: {project}-{branch}-{MMDD}-{HHMM}-{hash4}
 * Example: "orchestkit-main-0130-1745-a3f2"
 *
 * @param projectDir - Optional project directory (defaults to env or cwd)
 * @param date - Optional date for testing (defaults to now)
 */
export function generateSmartSessionId(projectDir?: string, date?: Date): string {
  const project = getProjectName(projectDir);
  const branch = getGitBranchForSession(projectDir);
  const dateStr = formatDateComponent(date);
  const timeStr = formatTimeComponent(date);
  const hash = generateShortHash();

  return `${project}-${branch}-${dateStr}-${timeStr}-${hash}`;
}

// =============================================================================
// SESSION ID CACHING
// =============================================================================

/**
 * Get cached session ID from .instance directory
 * Returns undefined if not cached
 */
export function getCachedSessionId(projectDir?: string): string | undefined {
  const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cachePath = join(dir, '.instance', 'session-id.json');

  if (!existsSync(cachePath)) {
    return undefined;
  }

  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf8'));
    // Validate the cached ID hasn't expired (24 hours)
    if (data.session_id && data.created_at) {
      const age = Date.now() - new Date(data.created_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (age < maxAge) {
        return data.session_id;
      }
    }
  } catch {
    // Ignore read/parse errors
  }

  return undefined;
}

/**
 * Cache session ID to .instance directory
 */
export function cacheSessionId(sessionId: string, projectDir?: string): void {
  const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const instanceDir = join(dir, '.instance');
  const cachePath = join(instanceDir, 'session-id.json');

  try {
    if (!existsSync(instanceDir)) {
      mkdirSync(instanceDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify({
      session_id: sessionId,
      created_at: new Date().toISOString(),
    }, null, 2));
  } catch {
    // Ignore write errors - caching is optional
  }
}

/**
 * Get or generate session ID with caching
 *
 * Priority:
 * 1. CLAUDE_SESSION_ID env var (from CC runtime)
 * 2. Cached session ID (from .instance/session-id.json)
 * 3. Generate new smart session ID (and cache it)
 */
export function getOrGenerateSessionId(projectDir?: string): string {
  // 1. Try CLAUDE_SESSION_ID first (preferred)
  if (process.env.CLAUDE_SESSION_ID) {
    return process.env.CLAUDE_SESSION_ID;
  }

  // 2. Try cached session ID
  const cached = getCachedSessionId(projectDir);
  if (cached) {
    return cached;
  }

  // 3. Generate new smart session ID
  const newId = generateSmartSessionId(projectDir);
  cacheSessionId(newId, projectDir);
  return newId;
}

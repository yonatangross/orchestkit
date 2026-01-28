/**
 * User Identity System
 * Resolves and manages user identity across sessions for multi-user decision capture.
 *
 * Identity Resolution Order:
 * 1. Explicit config (.claude/.user_identity.json)
 * 2. Git config (user.email, user.name)
 * 3. Environment variables (USER, USERNAME)
 * 4. Anonymous (machine-based hash)
 *
 * Privacy: User controls what gets shared via privacy settings.
 * Storage: User profiles stored locally in .claude/memory/users/
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getProjectDir, getSessionId, logHook } from './common.js';
import * as os from 'node:os';

// =============================================================================
// TYPES
// =============================================================================

/**
 * User identity source - where the identity was resolved from
 */
export type IdentitySource = 'config' | 'git' | 'env' | 'anonymous';

/**
 * Resolved user identity
 */
export interface UserIdentity {
  /** Unique user identifier (email, username, or anonymous hash) */
  user_id: string;
  /** Human-readable display name */
  display_name: string;
  /** Optional team/org identifier */
  team_id?: string;
  /** Machine identifier (hostname) */
  machine_id: string;
  /** How the identity was resolved */
  source: IdentitySource;
  /** Anonymous hash for global sharing (privacy-preserving) */
  anonymous_id: string;
  /** Email if available */
  email?: string;
}

/**
 * User privacy settings - controls what gets shared
 */
export interface PrivacySettings {
  /** Share patterns with team (same project) */
  share_with_team: boolean;
  /** Share patterns globally (anonymized) */
  share_globally: boolean;
  /** Share decisions */
  share_decisions: boolean;
  /** Share preferences */
  share_preferences: boolean;
  /** Share skill usage statistics */
  share_skill_usage: boolean;
  /** Share prompt content (usually false for privacy) */
  share_prompts: boolean;
  /** Anonymize user_id when sharing globally */
  anonymize_globally: boolean;
}

/**
 * User identity configuration file format
 */
export interface UserIdentityConfig {
  /** Explicit user ID */
  user_id?: string;
  /** Display name */
  display_name?: string;
  /** Team identifier */
  team_id?: string;
  /** Privacy settings */
  privacy?: Partial<PrivacySettings>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const IDENTITY_CONFIG_FILE = '.claude/.user_identity.json';
const SALT = 'orchestkit-user-identity-v1';

/** Default privacy settings (conservative) */
const DEFAULT_PRIVACY: PrivacySettings = {
  share_with_team: true,
  share_globally: false, // Opt-in
  share_decisions: true,
  share_preferences: true,
  share_skill_usage: false, // Might reveal workflow
  share_prompts: false, // Privacy sensitive
  anonymize_globally: true,
};

// =============================================================================
// CACHING
// =============================================================================

let cachedIdentity: UserIdentity | null = null;
let cachedPrivacy: PrivacySettings | null = null;

/**
 * Clear cached identity (for testing)
 */
export function clearIdentityCache(): void {
  cachedIdentity = null;
  cachedPrivacy = null;
}

// =============================================================================
// IDENTITY RESOLUTION
// =============================================================================

/**
 * Generate anonymous hash from input
 */
function generateAnonymousId(input: string): string {
  return createHash('sha256')
    .update(input + SALT)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Get machine identifier
 */
function getMachineId(): string {
  try {
    return os.hostname();
  } catch {
    return 'unknown-machine';
  }
}

/**
 * Try to read explicit user config
 */
function readUserConfig(projectDir: string): UserIdentityConfig | null {
  const configPath = `${projectDir}/${IDENTITY_CONFIG_FILE}`;

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logHook('user-identity', `Failed to read user config: ${error}`, 'warn');
    return null;
  }
}

/**
 * Try to get identity from git config
 */
function getGitIdentity(projectDir: string): { email?: string; name?: string } {
  const result: { email?: string; name?: string } = {};

  try {
    result.email = execSync('git config user.email', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Git email not configured
  }

  try {
    result.name = execSync('git config user.name', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Git name not configured
  }

  return result;
}

/**
 * Get identity from environment variables
 */
function getEnvIdentity(): { username?: string } {
  const username = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
  return { username };
}

/**
 * Resolve user identity using fallback chain
 *
 * Resolution order:
 * 1. Explicit config file
 * 2. Git config
 * 3. Environment username
 * 4. Anonymous (machine-based)
 */
export function resolveUserIdentity(projectDir?: string): UserIdentity {
  // Return cached if available
  if (cachedIdentity) {
    return cachedIdentity;
  }

  const dir = projectDir || getProjectDir();
  const machineId = getMachineId();

  // 1. Try explicit config
  const config = readUserConfig(dir);
  if (config?.user_id) {
    cachedIdentity = {
      user_id: config.user_id,
      display_name: config.display_name || config.user_id,
      team_id: config.team_id,
      machine_id: machineId,
      source: 'config',
      anonymous_id: generateAnonymousId(config.user_id),
      email: config.user_id.includes('@') ? config.user_id : undefined,
    };
    logHook('user-identity', `Resolved from config: ${cachedIdentity.user_id}`, 'debug');
    return cachedIdentity;
  }

  // 2. Try git config
  const git = getGitIdentity(dir);
  if (git.email) {
    cachedIdentity = {
      user_id: git.email,
      display_name: git.name || git.email.split('@')[0],
      team_id: config?.team_id,
      machine_id: machineId,
      source: 'git',
      anonymous_id: generateAnonymousId(git.email),
      email: git.email,
    };
    logHook('user-identity', `Resolved from git: ${cachedIdentity.user_id}`, 'debug');
    return cachedIdentity;
  }

  // 3. Try environment
  const env = getEnvIdentity();
  if (env.username) {
    const userId = `${env.username}@${machineId}`;
    cachedIdentity = {
      user_id: userId,
      display_name: env.username,
      team_id: config?.team_id,
      machine_id: machineId,
      source: 'env',
      anonymous_id: generateAnonymousId(userId),
    };
    logHook('user-identity', `Resolved from env: ${cachedIdentity.user_id}`, 'debug');
    return cachedIdentity;
  }

  // 4. Anonymous fallback
  const anonId = generateAnonymousId(machineId + process.pid);
  cachedIdentity = {
    user_id: `anon-${anonId.slice(0, 8)}`,
    display_name: 'Anonymous',
    team_id: config?.team_id,
    machine_id: machineId,
    source: 'anonymous',
    anonymous_id: anonId,
  };
  logHook('user-identity', `Resolved as anonymous: ${cachedIdentity.user_id}`, 'debug');
  return cachedIdentity;
}

// =============================================================================
// PRIVACY SETTINGS
// =============================================================================

/**
 * Get user's privacy settings
 */
export function getPrivacySettings(projectDir?: string): PrivacySettings {
  if (cachedPrivacy) {
    return cachedPrivacy;
  }

  const dir = projectDir || getProjectDir();
  const config = readUserConfig(dir);

  cachedPrivacy = {
    ...DEFAULT_PRIVACY,
    ...config?.privacy,
  };

  return cachedPrivacy;
}

/**
 * Check if user allows sharing a specific type of data
 */
export function canShare(
  dataType: 'decisions' | 'preferences' | 'skill_usage' | 'prompts',
  scope: 'team' | 'global'
): boolean {
  const privacy = getPrivacySettings();

  // Check scope permission first
  if (scope === 'team' && !privacy.share_with_team) return false;
  if (scope === 'global' && !privacy.share_globally) return false;

  // Check data type permission
  switch (dataType) {
    case 'decisions':
      return privacy.share_decisions;
    case 'preferences':
      return privacy.share_preferences;
    case 'skill_usage':
      return privacy.share_skill_usage;
    case 'prompts':
      return privacy.share_prompts;
    default:
      return false;
  }
}

/**
 * Get user ID for sharing (applies anonymization if needed)
 */
export function getUserIdForScope(scope: 'local' | 'team' | 'global'): string {
  const identity = resolveUserIdentity();
  const privacy = getPrivacySettings();

  if (scope === 'global' && privacy.anonymize_globally) {
    return identity.anonymous_id;
  }

  return identity.user_id;
}

// =============================================================================
// IDENTITY PERSISTENCE
// =============================================================================

/**
 * Save user identity config (creates or updates)
 */
export function saveUserIdentityConfig(
  config: UserIdentityConfig,
  projectDir?: string
): boolean {
  const dir = projectDir || getProjectDir();
  const configPath = `${dir}/${IDENTITY_CONFIG_FILE}`;
  const configDir = `${dir}/.claude`;

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Clear cache to pick up new config
    clearIdentityCache();

    logHook('user-identity', `Saved identity config to ${configPath}`, 'info');
    return true;
  } catch (error) {
    logHook('user-identity', `Failed to save identity config: ${error}`, 'error');
    return false;
  }
}

// =============================================================================
// CONTEXT HELPERS
// =============================================================================

/**
 * Get full identity context for session events
 */
export interface IdentityContext {
  session_id: string;
  user_id: string;
  anonymous_id: string;
  team_id?: string;
  machine_id: string;
  identity_source: IdentitySource;
  timestamp: string;
}

/**
 * Get identity context for tagging events
 */
export function getIdentityContext(): IdentityContext {
  const identity = resolveUserIdentity();

  return {
    session_id: getSessionId(),
    user_id: identity.user_id,
    anonymous_id: identity.anonymous_id,
    team_id: identity.team_id,
    machine_id: identity.machine_id,
    identity_source: identity.source,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get project-scoped user ID for mem0 storage
 * Format: {project}-{scope} (e.g., "my-app-decisions")
 */
export function getProjectUserId(scope: string): string {
  const projectDir = getProjectDir();
  const projectName = projectDir.split('/').pop() || 'unknown';
  const sanitized = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${sanitized}-${scope}`;
}

/**
 * Get user-scoped ID for mem0 storage
 * Format: {user_id}-{scope} (e.g., "alice@company.com-preferences")
 */
export function getUserScopedId(scope: string): string {
  const identity = resolveUserIdentity();
  const sanitizedUserId = identity.user_id.toLowerCase().replace(/[^a-z0-9@.-]/g, '-');
  return `${sanitizedUserId}-${scope}`;
}

/**
 * Get global scope ID (for cross-project best practices)
 */
export function getGlobalScopeId(scope: string): string {
  return `orchestkit-global-${scope}`;
}

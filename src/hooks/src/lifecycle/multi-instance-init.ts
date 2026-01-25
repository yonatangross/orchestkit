/**
 * Multi-Instance Coordination Initialization Hook
 * Runs on session start to register this Claude Code instance
 * CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
 * Version: 1.1.0
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface InstanceIdentity {
  instance_id: string;
  worktree_name: string;
  worktree_path: string;
  branch: string;
  capabilities: string[];
  agent_type: string | null;
  model: string;
  priority: number;
  created_at: string;
  status: string;
  heartbeat_interval_ms: number;
  last_heartbeat: string;
}

/**
 * Check if multi-instance mode is enabled
 */
function isMultiInstanceEnabled(): boolean {
  return process.env.CLAUDE_MULTI_INSTANCE === '1';
}

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
}

/**
 * Check if sqlite3 is available
 */
function isSqlite3Available(): boolean {
  try {
    execSync('which sqlite3', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate unique instance ID
 */
function generateInstanceId(projectDir: string): string {
  const worktreeName = projectDir.split('/').pop() || 'unknown';
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(16).substring(2, 10);
  return `${worktreeName}-${timestamp}-${random}`;
}

/**
 * Get current git branch
 */
function getCurrentBranch(projectDir: string): string {
  try {
    return execSync('git branch --show-current', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Detect capabilities based on directory structure
 */
function detectCapabilities(projectDir: string): string[] {
  const caps: string[] = [];

  // Check for backend files
  if (existsSync(`${projectDir}/backend`) || existsSync(`${projectDir}/src/backend`)) {
    caps.push('backend');
  }

  // Check for frontend files
  if (existsSync(`${projectDir}/frontend`) || existsSync(`${projectDir}/src/frontend`) || existsSync(`${projectDir}/package.json`)) {
    caps.push('frontend');
  }

  // Check for test files
  if (existsSync(`${projectDir}/tests`) || existsSync(`${projectDir}/__tests__`)) {
    caps.push('testing');
  }

  // Check for infrastructure files
  if (existsSync(`${projectDir}/infrastructure`) || existsSync(`${projectDir}/docker-compose.yml`) || existsSync(`${projectDir}/Dockerfile`)) {
    caps.push('devops');
  }

  return caps;
}

/**
 * Create instance identity file
 */
function createInstanceIdentity(projectDir: string, instanceId: string): InstanceIdentity {
  const branch = getCurrentBranch(projectDir);
  const capabilities = detectCapabilities(projectDir);
  const now = new Date().toISOString();

  const identity: InstanceIdentity = {
    instance_id: instanceId,
    worktree_name: projectDir.split('/').pop() || 'unknown',
    worktree_path: projectDir,
    branch,
    capabilities,
    agent_type: null,
    model: 'claude-opus-4-5-20251101',
    priority: 1,
    created_at: now,
    status: 'active',
    heartbeat_interval_ms: 5000,
    last_heartbeat: now,
  };

  const instanceDir = `${projectDir}/.instance`;
  mkdirSync(instanceDir, { recursive: true });
  writeFileSync(`${instanceDir}/id.json`, JSON.stringify(identity, null, 2));

  logHook('multi-instance-init', `Instance identity created: ${instanceId}`);

  return identity;
}

/**
 * Initialize coordination database
 */
function initDatabase(projectDir: string): boolean {
  const coordDir = `${projectDir}/.claude/coordination`;
  const dbPath = `${coordDir}/.claude.db`;
  const schemaPath = `${coordDir}/schema.sql`;

  if (existsSync(dbPath)) {
    return true;
  }

  if (!existsSync(schemaPath)) {
    logHook('multi-instance-init', `WARNING: Schema file not found at ${schemaPath}`);
    return false;
  }

  try {
    mkdirSync(coordDir, { recursive: true });
    execSync(`sqlite3 "${dbPath}" < "${schemaPath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    logHook('multi-instance-init', 'Database initialized from schema');
    return true;
  } catch (err) {
    logHook('multi-instance-init', `Failed to initialize database: ${err}`);
    return false;
  }
}

/**
 * Start heartbeat process (note: in TypeScript, we can't easily start background processes)
 * Instead, heartbeat is handled by the instance-heartbeat hook
 */
function startHeartbeat(projectDir: string, instanceId: string): void {
  // Write PID file to indicate heartbeat should be active
  const instanceDir = `${projectDir}/.instance`;
  writeFileSync(`${instanceDir}/heartbeat.pid`, String(process.pid));
  logHook('multi-instance-init', `Heartbeat marker created for ${instanceId}`);
}

/**
 * Multi-instance init hook
 */
export function multiInstanceInit(input: HookInput): HookResult {
  // Self-guard: Only run when multi-instance mode is enabled
  if (!isMultiInstanceEnabled()) {
    return outputSilentSuccess();
  }

  // Check for sqlite3
  if (!isSqlite3Available()) {
    logHook('multi-instance-init', 'sqlite3 not available, skipping');
    return outputSilentSuccess();
  }

  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('multi-instance-init', 'Skipping multi-instance init (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  logHook('multi-instance-init', 'Starting multi-instance coordination initialization...');

  const projectDir = input.project_dir || getProjectDir();
  const instanceDir = `${projectDir}/.instance`;
  const coordDir = `${projectDir}/.claude/coordination`;

  // Ensure directories exist
  mkdirSync(`${coordDir}/locks`, { recursive: true });
  mkdirSync(instanceDir, { recursive: true });

  // Initialize database
  if (!initDatabase(projectDir)) {
    logHook('multi-instance-init', 'ERROR: Failed to initialize database');
    return outputSilentSuccess();
  }

  // Check if we already have an instance running
  const idFile = `${instanceDir}/id.json`;
  const pidFile = `${instanceDir}/heartbeat.pid`;

  if (existsSync(idFile) && existsSync(pidFile)) {
    try {
      const existingId = JSON.parse(readFileSync(idFile, 'utf-8'));
      logHook('multi-instance-init', `Reusing existing instance: ${existingId.instance_id}`);
      return outputSilentSuccess();
    } catch {
      // Fall through to create new instance
    }
  }

  // Generate new instance ID
  const instanceId = generateInstanceId(projectDir);

  // Create identity and register
  createInstanceIdentity(projectDir, instanceId);

  // Start heartbeat marker
  startHeartbeat(projectDir, instanceId);

  logHook('multi-instance-init', 'Multi-instance coordination initialized successfully');

  return outputSilentSuccess();
}

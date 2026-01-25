/**
 * Multi-Instance File Lock Hook
 * Acquires file locks before Write/Edit operations to prevent conflicts
 * CC 2.1.7 Compliant: Self-contained hook with proper block format
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { guardWriteEdit } from '../../lib/guards.js';

interface FileLock {
  lock_id: string;
  file_path: string;
  lock_type: string;
  instance_id: string;
  acquired_at: string;
  expires_at: string;
  reason?: string;
}

interface LockDatabase {
  locks: FileLock[];
}

/**
 * Get locks file path
 */
function getLocksFilePath(projectDir: string): string {
  return join(projectDir, '.claude', 'coordination', 'locks.json');
}

/**
 * Generate unique lock ID
 */
function generateLockId(): string {
  return `lock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Get current instance ID
 * CC 2.1.9+ should guarantee CLAUDE_SESSION_ID availability,
 * but we add a defensive fallback to prevent crashes.
 */
function getInstanceId(): string {
  return process.env.CLAUDE_SESSION_ID || `fallback-${process.pid}`;
}

/**
 * Calculate lock expiry (60 seconds from now)
 */
function calculateExpiry(): string {
  const expiry = new Date(Date.now() + 60 * 1000);
  return expiry.toISOString();
}

/**
 * Load locks database
 */
function loadLocks(locksPath: string): LockDatabase {
  try {
    if (existsSync(locksPath)) {
      return JSON.parse(readFileSync(locksPath, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return { locks: [] };
}

/**
 * Save locks database
 */
function saveLocks(locksPath: string, data: LockDatabase): void {
  const dir = dirname(locksPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(locksPath, JSON.stringify(data, null, 2));
}

/**
 * Check for existing lock by another instance
 */
function checkExistingLock(
  locks: FileLock[],
  filePath: string,
  instanceId: string
): FileLock | null {
  const now = new Date().toISOString();

  return (
    locks.find(
      (l) =>
        l.file_path === filePath &&
        l.instance_id !== instanceId &&
        l.expires_at > now
    ) || null
  );
}

/**
 * Check for directory lock that covers this file
 */
function checkDirectoryLock(
  locks: FileLock[],
  filePath: string,
  instanceId: string
): FileLock | null {
  const now = new Date().toISOString();

  return (
    locks.find(
      (l) =>
        l.lock_type === 'directory' &&
        filePath.startsWith(l.file_path) &&
        l.instance_id !== instanceId &&
        l.expires_at > now
    ) || null
  );
}

/**
 * Acquire or refresh a file lock
 */
function acquireLock(
  data: LockDatabase,
  filePath: string,
  instanceId: string,
  reason: string
): void {
  // Remove any existing lock for this file by this instance
  data.locks = data.locks.filter(
    (l) => !(l.file_path === filePath && l.instance_id === instanceId)
  );

  // Clean expired locks
  const now = new Date().toISOString();
  data.locks = data.locks.filter((l) => l.expires_at > now);

  // Add new lock
  data.locks.push({
    lock_id: generateLockId(),
    file_path: filePath,
    lock_type: 'exclusive_write',
    instance_id: instanceId,
    acquired_at: now,
    expires_at: calculateExpiry(),
    reason,
  });
}

/**
 * Multi-instance file lock acquisition
 */
export function multiInstanceLock(input: HookInput): HookResult {
  // Only process Write and Edit tools
  const guardResult = guardWriteEdit(input);
  if (guardResult) return guardResult;

  const filePath = input.tool_input.file_path || '';
  const projectDir = getProjectDir();
  const toolName = input.tool_name;

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Get locks file path
  const locksPath = getLocksFilePath(projectDir);

  // Check if instance identity exists
  const instanceDir = join(projectDir, '.instance');
  if (!existsSync(join(instanceDir, 'id.json'))) {
    logHook('multi-instance-lock', 'No instance identity, passing through');
    return outputSilentSuccess();
  }

  // Normalize path
  const normalizedPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length + 1)
    : filePath;

  const instanceId = getInstanceId();

  // Load locks
  const data = loadLocks(locksPath);

  // Check for directory lock
  const dirLock = checkDirectoryLock(data.locks, normalizedPath, instanceId);
  if (dirLock) {
    logPermissionFeedback(
      'deny',
      `Directory ${dirLock.file_path} locked by ${dirLock.instance_id}`,
      input
    );
    logHook('multi-instance-lock', `BLOCKED: Directory lock by ${dirLock.instance_id}`);

    return outputDeny(
      `Directory ${dirLock.file_path} is locked by another Claude instance (${dirLock.instance_id}).
Wait for lock release.`
    );
  }

  // Check for file lock
  const fileLock = checkExistingLock(data.locks, normalizedPath, instanceId);
  if (fileLock) {
    logPermissionFeedback(
      'deny',
      `File ${normalizedPath} locked by ${fileLock.instance_id}`,
      input
    );
    logHook('multi-instance-lock', `BLOCKED: ${normalizedPath} locked by ${fileLock.instance_id}`);

    return outputDeny(
      `File ${normalizedPath} is locked by another Claude instance (${fileLock.instance_id}).
Wait for lock release.`
    );
  }

  // Acquire lock
  acquireLock(data, normalizedPath, instanceId, `Modifying via ${toolName}`);
  saveLocks(locksPath, data);

  logHook('multi-instance-lock', `Lock acquired: ${normalizedPath}`);
  logPermissionFeedback('allow', `Lock acquired for ${normalizedPath}`, input);

  return outputSilentSuccess();
}

/**
 * File Lock Release - Release locks after successful Write/Edit
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
 * Hook: PostToolUse (Write|Edit)
 *
 * FIX: Now releases from locks.json (matching multi-instance-lock.ts acquisition)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';
import { join } from 'node:path';

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
 * Check if coordination is enabled
 */
function isCoordinationEnabled(projectDir: string): boolean {
  return existsSync(join(projectDir, '.claude', 'coordination'));
}

/**
 * Get current instance ID
 * Priority: CLAUDE_SESSION_ID > .instance/id.json > fallback-{pid}
 * Using .instance/id.json ensures consistent ID across hook processes.
 */
function getInstanceId(): string {
  // 1. Try CLAUDE_SESSION_ID first
  if (process.env.CLAUDE_SESSION_ID) {
    return process.env.CLAUDE_SESSION_ID;
  }

  // 2. Try reading from .instance/id.json for consistent ID across processes
  try {
    const projectDir = getProjectDir();
    const instanceIdPath = join(projectDir, '.instance', 'id.json');
    if (existsSync(instanceIdPath)) {
      const data = JSON.parse(readFileSync(instanceIdPath, 'utf8'));
      if (data.instance_id) {
        return data.instance_id;
      }
    }
  } catch {
    // Ignore read errors
  }

  // 3. Fallback to PID (may cause issues with lock release)
  return `fallback-${process.pid}`;
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
    // Ignore parse errors
  }
  return { locks: [] };
}

/**
 * Save locks database
 */
function saveLocks(locksPath: string, data: LockDatabase): void {
  writeFileSync(locksPath, JSON.stringify(data, null, 2));
}

/**
 * Clean expired locks
 */
function cleanExpiredLocks(locks: FileLock[]): FileLock[] {
  const now = new Date().toISOString();
  return locks.filter(l => l.expires_at > now);
}

/**
 * Release file lock from locks.json
 */
function releaseFileLock(locksPath: string, filePath: string, instanceId: string): boolean {
  try {
    const data = loadLocks(locksPath);
    const originalCount = data.locks.length;

    // Clean expired locks AND remove matching lock
    data.locks = cleanExpiredLocks(data.locks).filter(
      l => !(l.file_path === filePath && l.instance_id === instanceId)
    );

    if (data.locks.length < originalCount) {
      saveLocks(locksPath, data);
      logHook('file-lock-release', `Released lock for ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    logHook('file-lock-release', `Failed to release lock for ${filePath}: ${error}`);
    return false;
  }
}

/**
 * Release file locks after Write/Edit operations
 */
export function fileLockRelease(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only run for Write/Edit
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();

  // Self-guard: Only run if coordination is enabled
  if (!isCoordinationEnabled(projectDir)) {
    return outputSilentSuccess();
  }

  // Get file path
  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Skip coordination directory files
  if (filePath.includes('/.claude/coordination/') || filePath.includes('.claude/coordination')) {
    return outputSilentSuccess();
  }

  // Normalize path (match multi-instance-lock.ts behavior)
  const normalizedPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length + 1)
    : filePath;

  // Release lock regardless of result (lock should be released even on error)
  const locksPath = getLocksFilePath(projectDir);
  const instanceId = getInstanceId();
  releaseFileLock(locksPath, normalizedPath, instanceId);

  return outputSilentSuccess();
}

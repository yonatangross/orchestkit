/**
 * File Lock Check Hook
 * Check/acquire locks before Write/Edit operations
 * CC 2.1.7 Compliant: ensures JSON output on all code paths
 */

import type { HookInput, HookResult } from "../../types.js";
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from "../../lib/common.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface FileLock {
  instance_id: string;
  file_path: string;
  acquired_at: string;
  expires_at: string;
}

interface LockDatabase {
  locks?: FileLock[];
}

/**
 * Get coordination database path
 */
function getCoordinationDbPath(projectDir: string): string {
  return join(projectDir, ".claude", "coordination", "locks.json");
}

/**
 * Check if coordination is enabled
 */
function isCoordinationEnabled(projectDir: string): boolean {
  return existsSync(join(projectDir, ".claude", "coordination"));
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
 * Clean expired locks from database and persist
 */
function cleanExpiredLocks(dbPath: string, data: LockDatabase): FileLock[] {
  const now = new Date().toISOString();
  const originalCount = data.locks?.length || 0;
  const activeLocks = (data.locks || []).filter((l) => l.expires_at > now);

  // Persist cleanup if any locks were removed
  if (activeLocks.length < originalCount) {
    try {
      writeFileSync(dbPath, JSON.stringify({ locks: activeLocks }, null, 2));
      logHook("file-lock-check", `Cleaned ${originalCount - activeLocks.length} expired locks`);
    } catch {
      // Ignore write errors during cleanup
    }
  }

  return activeLocks;
}

/**
 * Check if file is locked by another instance
 */
function isLockedByOther(projectDir: string, filePath: string): FileLock | null {
  const dbPath = getCoordinationDbPath(projectDir);
  const instanceId = getInstanceId();

  try {
    if (!existsSync(dbPath)) {
      return null;
    }

    const data: LockDatabase = JSON.parse(readFileSync(dbPath, "utf8"));

    // Clean expired locks first (this also persists the cleanup)
    const activeLocks = cleanExpiredLocks(dbPath, data);

    // Find active lock by another instance
    const lock = activeLocks.find(
      (l) =>
        l.file_path === filePath &&
        l.instance_id !== instanceId
    );

    return lock || null;
  } catch {
    return null;
  }
}

/**
 * Check file locks before Write/Edit
 */
export function fileLockCheck(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || "";
  const projectDir = getProjectDir();
  const toolName = input.tool_name;

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Check if coordination is enabled
  if (!isCoordinationEnabled(projectDir)) {
    return outputSilentSuccess();
  }

  // Skip coordination directory itself
  if (filePath.includes(".claude/coordination")) {
    return outputSilentSuccess();
  }

  // Normalize path
  const normalizedPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length + 1)
    : filePath;

  // Check for existing lock
  const existingLock = isLockedByOther(projectDir, normalizedPath);

  if (existingLock) {
    logPermissionFeedback(
      "deny",
      `File ${filePath} locked by ${existingLock.instance_id}`,
      input
    );
    logHook("file-lock-check", `BLOCKED: ${filePath} locked by ${existingLock.instance_id}`);

    return outputDeny(
      `File ${filePath} is locked by instance ${existingLock.instance_id}.

Lock acquired at: ${existingLock.acquired_at}
Expires at: ${existingLock.expires_at}

You may want to wait or check the work registry:
.claude/coordination/work-registry.json`
    );
  }

  // No conflicts
  logPermissionFeedback("allow", `Lock check passed for ${filePath}`, input);
  logHook("file-lock-check", `Lock check passed: ${filePath} (${toolName})`);
  return outputSilentSuccess();
}

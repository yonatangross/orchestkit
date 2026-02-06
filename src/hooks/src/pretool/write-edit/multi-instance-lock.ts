/**
 * Multi-Instance File Lock Hook
 * Acquires file locks before Write/Edit operations to prevent conflicts
 * CC 2.1.7 Compliant: Self-contained hook with proper block format
 *
 * Issue #361: Uses shared file-lock utilities from lib/file-lock.ts
 */

import type { HookInput, HookResult } from "../../types.js";
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from "../../lib/common.js";
import { getOrGenerateSessionId } from "../../lib/session-id-generator.js";
import { guardWriteEdit } from "../../lib/guards.js";
import type { FileLock } from "../../lib/file-lock.js";
import {
  getLocksFilePath,
  isCoordinationEnabled,
  loadLocks,
  saveLocks,
  cleanExpiredLocks,
} from "../../lib/file-lock.js";

/**
 * Generate unique lock ID
 */
function generateLockId(): string {
  return `lock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Get current instance ID using unified session ID resolution.
 *
 * Priority (via getOrGenerateSessionId):
 * 1. CLAUDE_SESSION_ID env var (from CC runtime)
 * 2. Cached session ID (from .instance/session-id.json)
 * 3. Smart session ID: {project}-{branch}-{MMDD}-{HHMM}-{hash4}
 *
 * Example: "orchestkit-main-0130-1745-a3f2"
 */
function getInstanceId(): string {
  return getOrGenerateSessionId();
}

/**
 * Calculate lock expiry (5 minutes from now)
 */
function calculateExpiry(): string {
  const expiry = new Date(Date.now() + 300 * 1000);
  return expiry.toISOString();
}

/**
 * Check for existing lock by another instance
 */
function checkExistingLock(
  locks: FileLock[],
  filePath: string,
  instanceId: string
): FileLock | null {
  return (
    locks.find(
      (l) =>
        l.file_path === filePath &&
        l.instance_id !== instanceId
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
  return (
    locks.find(
      (l) =>
        l.lock_type === "directory" &&
        filePath.startsWith(l.file_path) &&
        l.instance_id !== instanceId
    ) || null
  );
}

/**
 * Acquire or refresh a file lock
 */
function acquireLock(
  data: { locks: FileLock[] },
  filePath: string,
  instanceId: string,
  reason: string
): void {
  const now = new Date().toISOString();

  // Remove any existing lock for this file by this instance
  data.locks = data.locks.filter(
    (l) => !(l.file_path === filePath && l.instance_id === instanceId)
  );

  // Add new lock
  data.locks.push({
    lock_id: generateLockId(),
    file_path: filePath,
    lock_type: "exclusive_write",
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

  const filePath = input.tool_input.file_path || "";
  const projectDir = getProjectDir();
  const toolName = input.tool_name;

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Check if coordination is enabled
  if (!isCoordinationEnabled(projectDir)) {
    logHook("multi-instance-lock", "Coordination not enabled, passing through");
    return outputSilentSuccess();
  }

  // Skip lock check for coordination directory itself
  if (filePath.includes(".claude/coordination")) {
    return outputSilentSuccess();
  }

  // Get locks file path
  const locksPath = getLocksFilePath(projectDir);

  // Normalize path
  const normalizedPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length + 1)
    : filePath;

  const instanceId = getInstanceId();

  // Load locks and clean expired ones FIRST
  const data = loadLocks(locksPath);
  const originalCount = data.locks.length;
  data.locks = cleanExpiredLocks(data.locks);

  // Log if we cleaned any
  if (data.locks.length < originalCount) {
    logHook("multi-instance-lock", `Cleaned ${originalCount - data.locks.length} expired locks`);
  }

  // Check for directory lock
  const dirLock = checkDirectoryLock(data.locks, normalizedPath, instanceId);
  if (dirLock) {
    // Save cleaned locks even if we deny
    saveLocks(locksPath, data);

    logPermissionFeedback(
      "deny",
      `Directory ${dirLock.file_path} locked by ${dirLock.instance_id}`,
      input
    );
    logHook("multi-instance-lock", `BLOCKED: Directory lock by ${dirLock.instance_id}`);

    return outputDeny(
      `Directory ${dirLock.file_path} is locked by another Claude instance (${dirLock.instance_id}).

Lock acquired at: ${dirLock.acquired_at}
Expires at: ${dirLock.expires_at}

You may want to wait or check the work registry:
.claude/coordination/work-registry.json`
    );
  }

  // Check for file lock
  const fileLock = checkExistingLock(data.locks, normalizedPath, instanceId);
  if (fileLock) {
    // Save cleaned locks even if we deny
    saveLocks(locksPath, data);

    logPermissionFeedback(
      "deny",
      `File ${normalizedPath} locked by ${fileLock.instance_id}`,
      input
    );
    logHook("multi-instance-lock", `BLOCKED: ${normalizedPath} locked by ${fileLock.instance_id}`);

    return outputDeny(
      `File ${normalizedPath} is locked by instance ${fileLock.instance_id}.

Lock acquired at: ${fileLock.acquired_at}
Expires at: ${fileLock.expires_at}

You may want to wait or check the work registry:
.claude/coordination/work-registry.json`
    );
  }

  // Acquire lock
  acquireLock(data, normalizedPath, instanceId, `Modifying via ${toolName}`);
  saveLocks(locksPath, data);

  logHook("multi-instance-lock", `Lock acquired: ${normalizedPath}`);
  logPermissionFeedback("allow", `Lock acquired for ${normalizedPath}`, input);

  return outputSilentSuccess();
}

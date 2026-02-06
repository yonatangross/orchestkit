/**
 * Test helpers for bin script tests
 *
 * Centralizes function implementations used for testing when dynamic ESM imports
 * of the actual .mjs modules fail due to top-level execution side effects.
 *
 * These implementations mirror the actual code in bin/*.mjs but are safe to import
 * in test context without triggering process.exit() or other side effects.
 *
 * @see src/hooks/bin/run-hook-background.mjs
 * @see src/hooks/bin/run-hook-silent.mjs
 */

/**
 * Sanitize hook name for safe file system operations (SEC-001: path traversal prevention)
 * Mirrors: run-hook-background.mjs:sanitizeHookName
 */
export function sanitizeHookName(hookName: string): string {
  return hookName.replace(/[^a-zA-Z0-9-]/g, '-');
}

/**
 * Check if a process is still running
 * Mirrors: run-hook-background.mjs:isProcessRunning
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bundle name mapping for hook prefixes
 * Mirrors: run-hook-background.mjs:getBundleName
 */
export function getBundleName(hookName: string): string | null {
  const prefix = hookName.split('/')[0];
  const bundleMap: Record<string, string> = {
    permission: 'permission',
    pretool: 'pretool',
    posttool: 'posttool',
    prompt: 'prompt',
    lifecycle: 'lifecycle',
    stop: 'stop',
    'subagent-start': 'subagent',
    'subagent-stop': 'subagent',
    notification: 'notification',
    setup: 'setup',
    skill: 'skill',
    agent: 'agent',
  };
  return bundleMap[prefix] || null;
}

/**
 * Check if debug is enabled for a hook
 * Mirrors: run-hook-background.mjs:isDebugEnabled
 */
export function isDebugEnabled(
  hookName: string,
  debugConfig: { enabled: boolean; hookFilters: string[] }
): boolean {
  if (!debugConfig.enabled) return false;
  if (debugConfig.hookFilters.length === 0) return true;
  return debugConfig.hookFilters.some((filter) => hookName.includes(filter));
}

/**
 * Hook execution timeout constant
 * Mirrors: run-hook-background.mjs:HOOK_TIMEOUT_MS
 */
export const HOOK_TIMEOUT_MS = 60000;

/**
 * Try to import the actual module functions, falling back to helpers
 * This allows tests to use real implementations when possible.
 */
export async function loadModuleFunctions(): Promise<{
  sanitizeHookName: typeof sanitizeHookName;
  isProcessRunning: typeof isProcessRunning;
  getBundleName: typeof getBundleName;
  isDebugEnabled: typeof isDebugEnabled;
  HOOK_TIMEOUT_MS: number;
  isRealModule: boolean;
}> {
  try {
    const mod = await import('../../../bin/run-hook-background.mjs');
    return {
      sanitizeHookName: mod.sanitizeHookName,
      isProcessRunning: mod.isProcessRunning,
      getBundleName: mod.getBundleName,
      isDebugEnabled: mod.isDebugEnabled,
      HOOK_TIMEOUT_MS: mod.HOOK_TIMEOUT_MS,
      isRealModule: true,
    };
  } catch {
    // Module import failed (likely due to side effects), use helpers
    return {
      sanitizeHookName,
      isProcessRunning,
      getBundleName,
      isDebugEnabled,
      HOOK_TIMEOUT_MS,
      isRealModule: false,
    };
  }
}

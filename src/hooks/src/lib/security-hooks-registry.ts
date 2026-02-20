/**
 * Security-Critical Hooks Registry
 *
 * Hooks in this set MUST NOT be disabled, skipped, or toggled off.
 * They form the security baseline of OrchestKit.
 *
 * Issue #686: Centralized registry for security hook identification.
 *
 * The 6 security-critical hooks (validated by security-critical-hooks.test.ts):
 * 1. dangerous-command-blocker — Blocks destructive system commands
 * 2. file-guard — Protects sensitive files from writes
 * 3. auto-approve-safe-bash — Auto-approves known-safe commands (security: rejects dangerous)
 * 4. redact-secrets — Detects and warns on leaked secrets
 * 5. git-validator — Branch/commit protection
 * 6. security-command-audit — Audit logs Bash commands
 */

/** Immutable set of security-critical hook names that cannot be toggled off or disabled. */
export const SECURITY_HOOKS = new Set([
  'dangerous-command-blocker',
  'file-guard',
  'auto-approve-safe-bash',
  'redact-secrets',
  'git-validator',
  'security-command-audit',
] as const);

export type SecurityHookName = typeof SECURITY_HOOKS extends Set<infer T> ? T : never;

/**
 * Check if a hook is security-critical and cannot be disabled.
 */
export function isSecurityCritical(hookName: string): boolean {
  return SECURITY_HOOKS.has(hookName as SecurityHookName);
}

/**
 * Get all security-critical hook names.
 */
export function getSecurityHooks(): readonly string[] {
  return [...SECURITY_HOOKS];
}

/**
 * Check if a hook name is security-critical.
 * @deprecated Use isSecurityCritical() instead. Kept for backward compatibility.
 */
export function isSecurityHook(hookName: string): boolean {
  return SECURITY_HOOKS.has(hookName as SecurityHookName);
}

/**
 * Assert that a hook can be toggled. Throws if the hook is security-critical.
 * Use this in any hook toggle/disable logic.
 */
export function assertCanToggle(hookName: string): void {
  if (SECURITY_HOOKS.has(hookName as SecurityHookName)) {
    throw new Error(
      `Cannot disable security-critical hook '${hookName}'. ` +
        `Security hooks (${[...SECURITY_HOOKS].join(', ')}) are permanently enabled.`
    );
  }
}

/**
 * Security-Critical Hooks Registry
 *
 * Hooks in this set MUST NOT be disabled, skipped, or toggled off.
 * They form the security baseline of OrchestKit.
 *
 * Issue #686: Centralized registry for security hook identification.
 *
 * The 3 security-critical hooks (validated by security-critical-hooks.test.ts):
 * 1. auto-approve-safe-bash — Dual-role: rejects dangerous commands via REJECT_PATTERNS first,
 *    then auto-approves known-safe commands. Despite the name, this is a security gate.
 * 2. redact-secrets — Detects and warns on leaked secrets
 * 3. security-command-audit — Audit logs Bash commands
 *
 * SECURITY BASELINE CHANGE, 2026-08-31 (#3835, operator-ordered divergence purge):
 * dangerous-command-blocker, file-guard and git-validator were removed from this
 * set ahead of their deletion. Their opinions now live as permissions.deny rules
 * in the OPERATOR's settings scope (delivered by setup phase 3.6, audited by
 * doctor, gated in CI by tests/ci/restricted-smoke/probe-permission-deny.sh),
 * which CC enforces even under --dangerously-skip-permissions. A plugin
 * settings.json cannot carry them (CC reads only agent/subagentStatusLine), so
 * "un-disableable hook" was never the strongest guarantee available; a native
 * deny rule is. Register: shared/rules/cc-native-first.md, purge rows.
 */

/** Immutable set of security-critical hook names that cannot be toggled off or disabled. */
export const SECURITY_HOOKS = new Set([
  'auto-approve-safe-bash',
  'redact-secrets',
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

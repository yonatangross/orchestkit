/**
 * Bash Command Pattern Registry
 *
 * Unified reject patterns for dangerous commands, shared between
 * auto-approve-safe-bash.ts and safe-command-retry.ts.
 *
 * SEC: These patterns are the last line of defense before a dangerous
 * command is auto-approved or retried after denial.
 *
 * @since v7.27.1
 */

/**
 * Commands that must NEVER be auto-approved or retried.
 * Checked BEFORE safe patterns — reject takes priority.
 */
export const REJECT_PATTERNS: RegExp[] = [
  /^git\s+checkout\s+--\s+\./,
  /^git\s+checkout\s+(-f|--force)\b/,
  /^git\s+checkout\s+\.\s*$/,
  /^git\s+reset\s+--hard/,
  /^git\s+push\s+.*--force/,
  /^git\s+push\s+-f\b/,
  /^git\s+clean/,
  /^rm\s/,
  /^chmod\s/,
];

/**
 * Check if a command contains compound operators that could chain
 * a dangerous command after a safe one.
 *
 * Covers: &&, ||, |, ;, backticks, $()
 */
export function hasCompoundOperator(command: string): boolean {
  return /[;&|`]|\$\(/.test(command);
}

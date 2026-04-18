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
  // find(1) with destructive / file-writing actions. -exec uses `;` (caught
  // by isCompoundCommand), but -delete, -fprint*, -fls, and -ok are
  // single-token flags that bypass the compound check:
  //   -delete       — unlinks matches
  //   -fprint*      — writes matches to arbitrary file (fprint/fprint0/fprintf)
  //   -fls          — writes ls-style listing to arbitrary file
  //   -ok           — interactive confirm (no stdin in hook context → hangs)
  // Not blocked: -print, -print0, -printf (stdout-only; exfil via pipe is
  // caught by isCompoundCommand). CC 2.1.113 stopped auto-approving these
  // under Bash(find:*); we mirror it.
  /^find\b[^\n]*?\s-(delete|fprint[0-9a-z]*|fls|ok)\b/,
];

// Note: For compound command detection, use isCompoundCommand() from
// lib/normalize-command.ts — it handles newlines, line continuations,
// and normalizes the command before checking.

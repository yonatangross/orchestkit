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
  // find(1) with destructive / file-writing / command-running actions.
  // -exec ... \; has a `;` (caught by isCompoundCommand), but `-exec ... +`
  // and -execdir have none, and -delete, -fprint*, -fls, -ok are
  // single-token flags that bypass the compound check:
  //   -delete       — unlinks matches
  //   -fprint*      — writes matches to arbitrary file (fprint/fprint0/fprintf)
  //   -fls          — writes ls-style listing to arbitrary file
  //   -ok           — interactive confirm (no stdin in hook context → hangs)
  //   -exec/-execdir — runs an arbitrary command per match (#4216 HR-1:
  //                    `find . -exec rm {} +` auto-approved under /^find\s/)
  // Not blocked: -print, -print0, -printf (stdout-only; exfil via pipe is
  // caught by isCompoundCommand). CC 2.1.113 stopped auto-approving these
  // under Bash(find:*); we mirror it.
  /^find\b[^\n]*?\s-(delete|fprint[0-9a-z]*|fls|ok|exec|execdir)\b/,

  // Credential-path arguments (#4216 HR-1): secret material must never
  // auto-approve under a read-only prefix. Keying on the reader left the
  // door open: `fmt ~/.ssh/id_rsa`, `pr ~/.aws/credentials`, `comm` and
  // `tsort` were measured auto-approved alongside `cat`. Key on the PATH
  // instead, so any command whose arguments name a secret store drops to
  // a real prompt whatever the executable.
  // Covers the usual secret stores; envrc sits next to env (direnv dumps
  // exports), master.passwd is the macOS shadow, and gh/hosts.yml holds
  // the gh CLI OAuth tokens.
  /(?:\/etc\/(?:shadow|gshadow|sudoers|master\.passwd)|\.(?:ssh|aws|gnupg|kube|docker|netrc|git-credentials|npmrc|pypirc|env|envrc|credentials?)\b|id_(?:rsa|ed25519|ecdsa|dsa)\b|\.(?:pem|key|p12|pfx|keystore)\b|\.config\/gh\/hosts\.yml\b)/,
];

// Note: For compound command detection, use isCompoundCommand() from
// lib/normalize-command.ts — it handles newlines, line continuations,
// and normalizes the command before checking.

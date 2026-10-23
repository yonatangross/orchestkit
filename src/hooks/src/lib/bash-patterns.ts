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
 * git long options that run a configured or supplied program, write a file,
 * or point git at another repository (whose config can run programs).
 */
const GIT_PROGRAM_OPTIONS = [
  'upload-pack',
  'receive-pack',
  'exec',
  'output',
  'ext-diff',
  'config-env',
  'git-dir',
  'work-tree',
  'exec-path',
];

/**
 * Every prefix of GIT_PROGRAM_OPTIONS, longest first. git's parse-options
 * accepts any unambiguous prefix of a long option, so `git fetch
 * --upload-pa=CMD` runs CMD exactly like `--upload-pack=CMD`. A prefix that
 * git would read as some other option only drops that command to a prompt.
 */
const GIT_PROGRAM_OPTION_PREFIXES = [
  ...new Set(GIT_PROGRAM_OPTIONS.flatMap((name) => Array.from(name, (_, i) => name.slice(0, i + 1)))),
].sort((a, b) => b.length - a.length);

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

  // git options that run a configured or supplied program, write a file, or
  // point git at another repository (whose config can run programs), in full
  // or abbreviated. The read-only subcommand allowlist cannot see these, so
  // they drop to a prompt.
  new RegExp(String.raw`^git\b[^\n]*?\s(?:-c|-C|--(?:${GIT_PROGRAM_OPTION_PREFIXES.join('|')}))(?=[=\s]|$)`),

  // Credential-path arguments (#4216 HR-1): secret material must never
  // auto-approve under a read-only prefix. Keying on the reader left the
  // door open: `fmt ~/.ssh/id_rsa`, `pr ~/.aws/credentials`, `comm` and
  // `tsort` were measured auto-approved alongside `cat`. Key on the PATH
  // instead, so any command whose arguments name a secret store drops to
  // a real prompt whatever the executable.
  // Covers the usual secret stores; envrc sits next to env (direnv dumps
  // exports), master.passwd is the macOS shadow, and gh/hosts.yml holds
  // the gh CLI OAuth tokens.
  // Case-insensitive: macOS filesystems are, so .SSH names the same store.
  // Globs and expansion can still spell a store indirectly; the auto-approve
  // and retry hooks refuse those up front (hasUnquotedExpansion).
  /(?:\/etc\/(?:shadow|gshadow|sudoers|master\.passwd)|\.(?:ssh|aws|gnupg|kube|docker|netrc|git-credentials|npmrc|pypirc|env|envrc|credentials?)\b|id_(?:rsa|ed25519|ecdsa|dsa)\b|\.(?:pem|key|p12|pfx|keystore)\b|\.config\/gh\/hosts\.yml\b)/i,
];

// Note: For compound command detection, use isCompoundCommand() from
// lib/normalize-command.ts — it handles newlines, line continuations,
// and normalizes the command before checking.

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

import { normalizeSingle } from './normalize-command.js';

/**
 * Long git options that run a program, write a file or switch repository.
 * The reject row matches any prefix of these names, because git expands an
 * unambiguous abbreviation (a short prefix may also prompt for a harmless
 * option; prompting is the safe direction).
 */
export const GIT_RISKY_LONG_OPTIONS = [
  'upload-pack',
  'receive-pack',
  'exec',
  'exec-path',
  'output',
  'ext-diff',
  'extcmd',
  'open-files-in-pager',
  'config-env',
  'git-dir',
  'work-tree',
  'tool',
];

function gitRiskyOptionPattern(): RegExp {
  const prefixes = new Set<string>();
  for (const name of GIT_RISKY_LONG_OPTIONS) {
    for (let i = 1; i <= name.length; i++) prefixes.add(name.slice(0, i));
  }
  const alt = [...prefixes].sort((a, b) => b.length - a.length).join('|');
  return new RegExp(
    `^git\\b[^\\n]*?\\s(?:(?:-c|-C)(?=[=\\s]|$)|--(?:${alt})(?=[=\\s]|$)|-[A-Za-z]*[Ox])`,
  );
}

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

  // git options that run a program, write a file or point git at another
  // repository. git accepts any unambiguous prefix of a long option, so the
  // row matches every prefix of each risky name (see GIT_RISKY_LONG_OPTIONS).
  // Short -O and -x may carry their value attached or sit in a flag bundle.
  gitRiskyOptionPattern(),
  // difftool and mergetool run a configured external program by design.
  /^git\b[^\n]*?\s(?:difftool|mergetool)(?=\s|$)/,
  // Package managers accept abbreviated long options and several of them
  // run a program or another directory's package.json, so any option
  // drops to a prompt.
  /^(?:npm|pnpm|yarn)\b[^\n]*?\s-/,

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

/**
 * True for an npm/pnpm/yarn command that carries a quote, backslash or
 * backtick. The allowlists match the normalized command, and normalization
 * strips quoting, so a quoted argument can read as a different script name
 * than the one the package manager runs. Such commands never auto-approve.
 * The package-manager word is read from the normalized command, the form the
 * allowlists match, because the word itself may be quoted or escaped in the
 * raw text. The match ignores case: learned approvals compare lowercased.
 */
export function hasQuotedPackageManagerArgs(cmd: string): boolean {
  return /['"\\`]/.test(cmd) && /^(?:npm|pnpm|yarn)\b/i.test(normalizeSingle(cmd));
}

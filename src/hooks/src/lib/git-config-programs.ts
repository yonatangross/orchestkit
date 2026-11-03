/**
 * Which git config keys in the repo's own scopes name a program a git read
 * can run (#4701, #5013). Lives in lib/ so the review-post-gate handler takes
 * this I/O through an injected dep (fh-ready policy), never node:child_process
 * itself.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

// Keys that make a git read run a program: the fsmonitor hook on any index
// refresh, the external diff and textconv drivers, the clean/smudge/process
// filter drivers, and log.showSignature=true, which makes git log run the
// signing program (gpg.program runs on no allowed read once %G formats and
// --show-signature are refused, so it is not listed). core.hooksPath is not
// listed: the only hook an allowed read fires is post-index-change (a test
// arms every hook name), which gitConfigPrograms checks in the effective
// hooks dir; refusing the key would refuse every husky repo and orchestkit's
// own bin/git-hooks (#5013). Names are matched as git prints them (section
// and key lowercased, the subsection kept).
//
// gpg.program and gpg.<format>.program are listed too: signature checks
// can be reached through %G in a config-set format.pretty or pretty.<alias>,
// not only a typed --format, so a repo-scope signing program is refused and
// any check runs only the operator's own global or system signer (security
// review on #5013).
const GIT_PROGRAM_KEYS =
  /^(core\.fsmonitor|diff\.external|diff\..+\.(textconv|command)|filter\..+\.(clean|smudge|process)|log\.showsignature|gpg\.program|gpg\..+\.program)$/;
const GIT_FALSE = /^(false|no|off|0)$/i;
// The scopes a reviewed repo (or the call itself) controls. A value pulled in
// by an include is reported under the including file's scope. Global and
// system config are the operator's (the gate already refuses writing them)
// and stay a declared limit: refusing them would refuse every git read on a
// machine with git-lfs installed globally (#5013 ruling).
const GIT_REPO_SCOPES = new Set(['local', 'worktree', 'command']);
// Boolean keys that only matter when on.
const BOOLEAN_KEYS = new Set(['core.fsmonitor', 'log.showsignature']);

/**
 * The program-naming keys the repo's own git config sets: every effective
 * value read in one `git config --list --includes --show-scope` call (which
 * runs no program and covers config.worktree and includes), kept when its
 * scope is local, worktree or command. [] when the cwd does not exist; null
 * when the config cannot be read, so the caller fails closed. A boolean key
 * set to false counts as unset.
 */
export function gitConfigPrograms(cwd: string): string[] | null {
  let out = '';
  try {
    // -z: each entry is `<scope>\0<key>\n<value>\0`. A subsection may hold
    // `=` (`[filter "a=b"]` lists as filter.a=b.clean), so the key ends at
    // the newline, never at the first `=` (security review on #5013).
    out = execFileSync('git', ['-C', cwd || '.', 'config', '--list', '--includes', '--show-scope', '-z'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 3000,
    });
  } catch (err) {
    const e = err as { status?: number | null; stderr?: string | Buffer };
    // No directory at the cwd: there is no repo config to name a program.
    if (e.status === 128 && /cannot change to/i.test(String(e.stderr ?? ''))) return [];
    return null;
  }
  const keys: string[] = [];
  const parts = out.split('\0');
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const scope = parts[i];
    const entry = parts[i + 1];
    const nl = entry.indexOf('\n');
    const key = nl < 0 ? entry : entry.slice(0, nl);
    const value = nl < 0 ? '' : entry.slice(nl + 1).trim();
    if (!GIT_REPO_SCOPES.has(scope) || !GIT_PROGRAM_KEYS.test(key)) continue;
    if (BOOLEAN_KEYS.has(key) && GIT_FALSE.test(value)) continue;
    if (!keys.includes(key)) keys.push(key);
  }
  // A read that refreshes a stat-dirty index (git diff against the worktree)
  // writes it and fires post-index-change, measured on #5013. Resolve the
  // effective hooks dir (core.hooksPath, else $GIT_DIR/hooks) with rev-parse,
  // which runs no program, and report a post-index-change hook there.
  let hooks = '';
  try {
    hooks = execFileSync('git', ['-C', cwd || '.', 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();
  } catch (err) {
    const e = err as { status?: number | null; stderr?: string | Buffer };
    // No repo here: no index for a read to refresh, so no hook to fire.
    // Any other failure fails closed (security review on #5013).
    if (e.status === 128 && /not a git repository/i.test(String(e.stderr ?? ''))) return keys;
    return null;
  }
  if (!hooks || !isAbsolute(hooks)) return null;
  if (existsSync(join(hooks, 'post-index-change'))) keys.push('hooks/post-index-change');
  return keys;
}

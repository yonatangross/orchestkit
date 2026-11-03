/**
 * Which git config keys in the repo's own scopes name a program a git read
 * can run (#4701, #5013). Lives in lib/ so the review-post-gate handler takes
 * this I/O through an injected dep (fh-ready policy), never node:child_process
 * itself.
 */
import { execFileSync } from 'node:child_process';

// Keys that make a git read run a program: the fsmonitor hook on any index
// refresh, the external diff and textconv drivers, the clean/smudge/process
// filter drivers, and log.showSignature=true, which makes git log run the
// signing program (gpg.program alone runs on no allowed read, so it is not
// listed). core.hooksPath is not listed: no read the gate allows runs a hook
// (a test arms every hook name and checks), and refusing it would refuse every
// repo that sets it locally (husky, orchestkit's bin/git-hooks); it is a
// declared limit (#5013). Names are matched as git prints them (section and
// key lowercased, the subsection kept).
const GIT_PROGRAM_KEYS =
  /^(core\.fsmonitor|diff\.external|diff\..+\.(textconv|command)|filter\..+\.(clean|smudge|process)|log\.showsignature)$/;
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
  return keys;
}

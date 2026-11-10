/**
 * npm ci through a symlinked node_modules empties the tree the link points at
 * (in a worktree made by bin/worktree-reclaim.sh, the MAIN repository's tree),
 * while printing a normal success line. dangerous-command-blocker denied it
 * until #3841 deleted that hook; nothing replaced it, because a permission rule
 * cannot see whether node_modules is a link. This guard denies only that case.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HookInput } from '../../../types.js';
import { NOOP_CTX } from '../../../lib/context.js';
import { npmCiSymlinkGuard, npmCiTargetDir } from '../../../pretool/bash/npm-ci-symlink-guard.js';
import { syncBashDispatcher } from '../../../pretool/bash/sync-bash-dispatcher.js';

function bash(command: string, cwd = '/wt'): HookInput {
  return { hook_event: 'PreToolUse', tool_name: 'Bash', session_id: 's', cwd, tool_input: { command } } as HookInput;
}

/** deps whose isSymlink answers true only for the listed paths */
function linksAt(...paths: string[]) {
  const set = new Set(paths);
  return { isSymlink: (p: string) => set.has(p) };
}

function denied(result: { continue?: boolean; hookSpecificOutput?: { permissionDecision?: string } }): boolean {
  return result.continue === false && result.hookSpecificOutput?.permissionDecision === 'deny';
}

describe('npmCiTargetDir', () => {
  it.each([
    ['npm ci', '/wt'],
    ['npm ci --no-audit --no-fund', '/wt'],
    ['npm clean-install', '/wt'],
    ['npm ic', '/wt'],
    ['npm install-clean', '/wt'],
    ['npm cit', '/wt'],
    ['npm clean-install-test', '/wt'],
    ['npm ci --prefix src/hooks', '/wt/src/hooks'],
    ['npm ci --prefix=src/hooks', '/wt/src/hooks'],
    ['npm --prefix src/hooks ci', '/wt/src/hooks'],
    ['npm ci --prefix /abs/dir', '/abs/dir'],
    ['cd /other && npm ci', '/other'],
    ['cd sub && npm ci', '/wt/sub'],
    ['git pull && npm ci', '/wt'],
    ['FOO=1 npm ci', '/wt'],
    // Review of #5166 (b133): shapes the first version let through.
    ['npm --loglevel warn ci', '/wt'],
    ['npm --workspace api ci', '/wt'],
    ['npm -w api ci', '/wt'],
    ['npm -C src/hooks ci', '/wt/src/hooks'],
    ['(cd /other && npm ci)', '/other'],
    ['(npm ci)', '/wt'],
    ['cd ~/wt2 && npm ci', '/home/u/wt2'],
    ['cd ~ && npm ci', '/home/u'],
    ['npm ci --prefix ~/x', '/home/u/x'],
    ['env CI=1 npm ci', '/wt'],
    ['time npm ci', '/wt'],
    ['command npm ci', '/wt'],
    ['sleep 1 & npm ci', '/wt'],
    ['cd "/my wt" && npm ci', '/my wt'],
    ["cd '/my wt' && npm ci", '/my wt'],
    // Vercel Security Review on #5168: a cd inside a subshell must not leak
    // out of it; the install after the subshell runs in the original dir.
    ['(cd /other) && npm ci', '/wt'],
    ['(cd /other && true); npm ci', '/wt'],
    ['((cd /a) && cd /b) && npm ci', '/wt'],
    ['(cd /a && (cd /b) && npm ci)', '/a'],
    // Vercel Security Review on #5168 (second finding): the ')' that closes a
    // $(...) command substitution is not the end of a subshell.
    ['(cd /a && x=$(pwd) && npm ci)', '/a'],
    ['(cd /a && echo $(date) && npm ci)', '/a'],
    ['cd /a && echo "$(git rev-parse HEAD)" && npm ci', '/a'],
    ['(cd /a && echo $(echo $(pwd)) && npm ci)', '/a'],
  ])('%s targets %s', (command, dir) => {
    expect(npmCiTargetDir(command, '/wt', '/home/u')).toBe(dir);
  });

  it.each([
    'npm install',
    'npm i',
    'npm run ci',
    'npm test',
    'echo "npm ci"',
    "grep -rn 'npm ci' docs",
    'git commit -m "run npm ci later"',
    'npm cinnamon',
    'npm --loglevel warn install',
    'npm -w api run ci',
    'env CI=1 npm run ci',
    'time npm test',
  ])('%s is not npm ci', (command) => {
    expect(npmCiTargetDir(command, '/wt', '/home/u')).toBeNull();
  });
});

describe('npmCiSymlinkGuard', () => {
  it('denies npm ci when the target node_modules is a symlink', () => {
    const result = npmCiSymlinkGuard(bash('npm ci'), NOOP_CTX, linksAt('/wt/node_modules'));
    expect(denied(result)).toBe(true);
    const reason = result.hookSpecificOutput?.permissionDecisionReason ?? '';
    expect(reason).toContain('/wt/node_modules');
    expect(reason).toContain('npm install');
  });

  it('denies npm ci --prefix when that node_modules is a symlink', () => {
    const result = npmCiSymlinkGuard(bash('npm ci --prefix src/hooks'), NOOP_CTX, linksAt('/wt/src/hooks/node_modules'));
    expect(denied(result)).toBe(true);
  });

  it('denies npm ci after a subshell cd when only the original dir has a linked node_modules', () => {
    const result = npmCiSymlinkGuard(bash('(cd /other) && npm ci'), NOOP_CTX, linksAt('/wt/node_modules'));
    expect(denied(result)).toBe(true);
  });

  it('denies npm ci after a command substitution inside the subshell that changed dir', () => {
    const result = npmCiSymlinkGuard(bash('(cd /a && x=$(pwd) && npm ci)'), NOOP_CTX, linksAt('/a/node_modules'));
    expect(denied(result)).toBe(true);
  });

  // Security review of #5168: the parser can still misread a ')' (escaped,
  // in a case pattern, ...). The guard fails closed by checking every
  // directory the command may run npm ci in, not only the parsed one.
  it('denies when any directory the command passed through has a linked node_modules', () => {
    const result = npmCiSymlinkGuard(bash('(cd /a && echo \\) && npm ci)'), NOOP_CTX, linksAt('/a/node_modules'));
    expect(denied(result)).toBe(true);
  });

  it.each([
    ['x=$(npm ci)'],
    ['echo "$(npm ci)"'],
    ['echo `npm ci`'],
    ["echo '`'; npm ci; echo '`'"],
    ["echo '$('; npm ci; echo ')'"],
  ])('finds the clean install in %s (substitution bodies and quotes)', (command) => {
    expect(denied(npmCiSymlinkGuard(bash(command), NOOP_CTX, linksAt('/wt/node_modules')))).toBe(true);
  });

  it('still allows npm ci when no directory it passed through has a linked node_modules', () => {
    const result = npmCiSymlinkGuard(bash('(cd /a && echo \\) && npm ci)'), NOOP_CTX, linksAt('/elsewhere/node_modules'));
    expect(result.continue).toBe(true);
  });

  it('allows npm ci when node_modules is a real directory or missing', () => {
    const result = npmCiSymlinkGuard(bash('npm ci'), NOOP_CTX, linksAt());
    expect(result.continue).toBe(true);
  });

  it('does not look at node_modules for other commands', () => {
    const seen: string[] = [];
    const deps = { isSymlink: (p: string) => { seen.push(p); return true; } };
    const result = npmCiSymlinkGuard(bash('npm install'), NOOP_CTX, deps);
    expect(result.continue).toBe(true);
    expect(seen).toEqual([]);
  });

  it('falls back to the project dir when the input has no cwd', () => {
    const input = { hook_event: 'PreToolUse', tool_name: 'Bash', session_id: 's', tool_input: { command: 'npm ci' } } as HookInput;
    const ctx = { ...NOOP_CTX, projectDir: '/proj' };
    expect(denied(npmCiSymlinkGuard(input, ctx, linksAt('/proj/node_modules')))).toBe(true);
  });
});

describe('through sync-bash-dispatcher, real filesystem', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'npmci-guard-'));
    mkdirSync(join(root, 'shared', 'node_modules'), { recursive: true });
    mkdirSync(join(root, 'wt'));
    mkdirSync(join(root, 'real', 'node_modules'), { recursive: true });
    symlinkSync(join(root, 'shared', 'node_modules'), join(root, 'wt', 'node_modules'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('denies npm ci in a worktree whose node_modules is a symlink', () => {
    const result = syncBashDispatcher(bash('npm ci', join(root, 'wt')), NOOP_CTX);
    expect(denied(result)).toBe(true);
  });

  it('allows npm ci where node_modules is a real directory', () => {
    const result = syncBashDispatcher(bash('npm ci', join(root, 'real')), NOOP_CTX);
    expect(denied(result)).toBe(false);
  });

  // #5169: shapes that reach npm ci through shell grammar, quoting, wrappers or
  // a nested shell. Each one empties the shared tree exactly like plain npm ci.
  it.each([
    ['if true; then npm ci; fi'],
    ['for x in 1; do npm ci; done'],
    ['case a in a) npm ci;; esac'],
    ['{ npm ci; }'],
    ['! npm ci'],
    ['"npm" ci'],
    ['\\npm ci'],
    ['sudo npm ci'],
    ['nice -n 10 npm ci'],
    ['timeout 5 npm ci'],
    ['bash -c "npm ci"'],
    ["sh -c 'npm ci'"],
  ])('denies %s in a worktree whose node_modules is a symlink (#5169)', (command) => {
    expect(denied(syncBashDispatcher(bash(command, join(root, 'wt')), NOOP_CTX))).toBe(true);
  });

  it('denies a brace-group cd into the worktree, then npm ci (#5169)', () => {
    const command = `{ cd ${join(root, 'wt')}; } && npm ci`;
    expect(denied(syncBashDispatcher(bash(command, join(root, 'real')), NOOP_CTX))).toBe(true);
  });

  it('denies env -C into the worktree, then npm ci (#5169)', () => {
    const command = `env -C ${join(root, 'wt')} npm ci`;
    expect(denied(syncBashDispatcher(bash(command, join(root, 'real')), NOOP_CTX))).toBe(true);
  });

  it('asks, not denies, when npm ci appears in a shape the parser cannot place (#5169)', () => {
    const result = syncBashDispatcher(bash("grep -rn 'npm ci' docs", join(root, 'wt')), NOOP_CTX);
    expect(result.hookSpecificOutput?.permissionDecision).toBe('ask');
  });

  it.each([
    ["grep -rn 'npm ci' docs"],
    ['if true; then npm ci; fi'],
  ])('neither denies nor asks for %s where node_modules is a real directory (#5169)', (command) => {
    const result = syncBashDispatcher(bash(command, join(root, 'real')), NOOP_CTX);
    expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  // Vercel finding 01M73R2WWKHP1QKXGW63DA83C9 on #5195: deleting every quote
  // character turned a double-quoted a'b into ab, so the guard probed a sibling
  // that does not exist and let npm ci empty the linked tree.
  describe('a double-quoted path keeps the apostrophe inside it', () => {
    beforeEach(() => {
      mkdirSync(join(root, "a'b"));
      symlinkSync(join(root, 'shared', 'node_modules'), join(root, "a'b", 'node_modules'));
    });

    it.each([
      [`npm ci --prefix "ROOT/a'b"`],
      [`npm --prefix="ROOT/a'b" ci`],
      [`npm -C "ROOT/a'b" ci`],
      [`env -C "ROOT/a'b" npm ci`],
      [`npm ci --prefix ROOT/a\\'b`],
    ])('denies %s from a cwd whose node_modules is real', (template) => {
      const result = syncBashDispatcher(bash(template.replace('ROOT', root), join(root, 'real')), NOOP_CTX);
      expect(denied(result)).toBe(true);
    });
  });

  // Review of #5195 (b137 HOLD 6780732034): a backslash inside single quotes is
  // literal, and a quoted blank does not split the word.
  it.each([
    [`npm ci --prefix 'ROOT/L\\z'`, 'L\\z'],
    [`npm ci --prefix "ROOT/L y"`, 'L y'],
    [`cd "ROOT/L y" && npm ci`, 'L y'],
  ])('denies %s when that dir has a symlinked node_modules', (template, name) => {
    mkdirSync(join(root, name));
    symlinkSync(join(root, 'shared', 'node_modules'), join(root, name, 'node_modules'));
    const result = syncBashDispatcher(bash(template.replace('ROOT', root), join(root, 'real')), NOOP_CTX);
    expect(denied(result)).toBe(true);
  });

  // Review of #5195 (b137 P2): the raw-text early exit ran before quotes and
  // escapes were removed, so the shell's npm spelled n\pm or np''m skipped the guard.
  it.each([['n\\pm ci'], ["np''m ci"], ['"np"m ci']])('denies %s in a worktree whose node_modules is a symlink', (command) => {
    expect(denied(syncBashDispatcher(bash(command, join(root, 'wt')), NOOP_CTX))).toBe(true);
  });
});

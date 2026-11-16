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
import { npmCiSymlinkGuard, npmCiTargetDir, type NpmCiSymlinkGuardDeps } from '../../../pretool/bash/npm-ci-symlink-guard.js';
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

  // Vercel Security Review, row 16 (findings 3, 4 and 5 on main). Ten of the "denies" rows below
  // were ALLOWED at 7fa39ab82 (a clean install that empties the shared tree): three of finding 3
  // (the prefix, cd and brace-group shapes), one of finding 4 (the x=$(printf ")") shape) and
  // six of finding 5. The other "denies" rows already passed at 7fa39ab82 and are kept as
  // regression rows. Each finding has controls that the legitimate neighbour is still allowed. The cwd is always the real directory
  // (not linked), so only reading the command correctly can find the linked worktree.
  describe('the three bypasses the Vercel Security Review found', () => {
    beforeEach(() => {
      // finding 3: a linked worktree whose NAME ends in a literal closing brace; its brace-less
      // sibling is a real directory
      mkdirSync(join(root, 'lw}'));
      symlinkSync(join(root, 'shared', 'node_modules'), join(root, 'lw}', 'node_modules'));
      mkdirSync(join(root, 'lw'));
      // finding 4: a parent that holds a linked worktree and a real one
      mkdirSync(join(root, 'parent', 'lw'), { recursive: true });
      symlinkSync(join(root, 'shared', 'node_modules'), join(root, 'parent', 'lw', 'node_modules'));
      mkdirSync(join(root, 'parent', 'rl'), { recursive: true });
    });

    const run = (template: string, cwd = 'real') =>
      syncBashDispatcher(bash(template.split('ROOT').join(root), join(root, cwd)), NOOP_CTX);

    // finding 3: the grammar stripper must never remove a brace from argument text
    it.each([
      ['npm ci --prefix ROOT/lw}'],
      ['npm --prefix=ROOT/lw} ci'],
      ['npm -C ROOT/lw} ci'],
      ['cd ROOT/lw} && npm ci'],
      ['{ cd ROOT/lw}; } && npm ci'],
      ['env -C ROOT/lw} npm ci'],
    ])('finding 3: denies %s (a linked directory whose name ends in a closing brace)', (template) => {
      expect(denied(run(template))).toBe(true);
    });

    it.each([
      ['npm ci --prefix ROOT/lw'],
      ['cd ROOT/lw && npm ci'],
      ['{ npm ci; }'],
      ['{ cd ROOT/real; } && npm ci'],
      ['if true; then npm ci; fi'],
    ])('finding 3 control: allows %s where no linked directory is reached', (template) => {
      expect(denied(run(template))).toBe(false);
    });

    // finding 4: a quoted closing parenthesis inside a substitution is not a subshell exit
    it.each([
      [`( cd ROOT/parent; echo "$(printf ')')"; cd lw; npm ci )`],
      [`( cd ROOT/parent; echo "$(printf ')')"; cd lw && npm ci )`],
      [`( cd ROOT/parent; x=$(printf ")"); cd lw; npm ci )`],
      [`( cd ROOT/parent; echo '$(printf ")")' "$(printf '))')"; cd lw; npm ci )`],
    ])('finding 4: denies %s (the relative cd resolves against the parent)', (template) => {
      expect(denied(run(template))).toBe(true);
    });

    it.each([
      [`( cd ROOT/parent; echo "$(printf ')')"; cd rl; npm ci )`],
      [`( cd ROOT/parent; x=$(printf ")"); cd rl; npm ci )`],
      [`( cd ROOT/parent; echo "$(date)"; cd rl; npm ci )`],
    ])('finding 4 control: allows %s where the directory it reaches is real', (template) => {
      expect(denied(run(template))).toBe(false);
    });

    // finding 5: recognising an earlier install must not stop the scan before a later one
    it.each([
      ['env CI=1 npm ci --prefix ROOT/real && cd ROOT/wt && npm ci'],
      ['env npm ci; cd ROOT/wt; npm ci'],
      ['command npm ci && cd ROOT/wt && npm ci'],
      ['npm ci && cd ROOT/wt && npm ci'],
      ['time npm ci --prefix ROOT/real && npm ci --prefix ROOT/wt'],
      ['(env npm ci) && (cd ROOT/wt && npm ci)'],
    ])('finding 5: denies %s (a later clean install reaches the linked worktree)', (template) => {
      expect(denied(run(template))).toBe(true);
    });

    it.each([
      ['env CI=1 npm ci --prefix ROOT/real && cd ROOT/parent/rl && npm ci'],
      ['env npm ci; npm ci'],
      ['npm ci && cd ROOT/real && npm ci'],
    ])('finding 5 control: allows %s where every install is in a real directory', (template) => {
      expect(denied(run(template))).toBe(false);
    });
  });

  // Row 16 fix round 1 (verifier HOLD on acceptance 2: deny or ask when the command cannot be
  // parsed with certainty). The guard reads command text with a few regexes, so a literal
  // parenthesis inside a quote, after a backslash, in a comment, in a heredoc body or as a case
  // pattern can still be mistaken for a subshell exit, and a later relative cd then resolves
  // against the wrong base. Real bash runs each of these installs in the linked worktree
  // (ROOT/parent/lw). All five were ALLOWED at 2f33f12db. When a clean install is found and the
  // command holds a subshell paren together with a quote, a backslash, `#`, `<<` or `case`, the
  // parse is uncertain, and the guard asks whenever a directory the command could reach has a
  // linked node_modules. The controls below must stay allowed (verifier C1 to C15, C17).
  describe('an uncertain parse that could reach a linked worktree asks', () => {
    beforeEach(() => {
      mkdirSync(join(root, 'parent', 'lw'), { recursive: true });
      symlinkSync(join(root, 'shared', 'node_modules'), join(root, 'parent', 'lw', 'node_modules'));
      mkdirSync(join(root, 'parent', 'rl'), { recursive: true });
      mkdirSync(join(root, 'r}'));
      mkdirSync(join(root, 'lw'));
    });

    const run = (template: string, cwd = 'real') =>
      syncBashDispatcher(bash(template.split('ROOT').join(root), join(root, cwd)), NOOP_CTX);
    const decision = (template: string, cwd = 'real') => run(template, cwd).hookSpecificOutput?.permissionDecision;

    it.each([
      ['H36 a quoted semicolon and parenthesis', "( cd ROOT/parent; echo 'q;q);q'; cd lw; npm ci )"],
      ['H37 escaped parentheses', '( cd ROOT/parent; echo \\)\\); cd lw; npm ci )'],
      ['H39 a case pattern inside a substitution', '( cd ROOT/parent; x=$(case a in a) echo;; esac); cd lw; npm ci )'],
      ['H58b a quoted parenthesis and a comment', "( cd ROOT/parent; echo ')' # )\ncd lw; npm ci )"],
      ['H64 a heredoc body holding a parenthesis', '( cd ROOT/parent\ncat <<EOF\n)\nEOF\ncd lw\nnpm ci )'],
    ])('%s: asks (never allows)', (_name, template) => {
      expect(['ask', 'deny']).toContain(decision(template));
    });

    // Fix round 2 (ruling B, the verifier's R1 to R3): two relative cds after the misparse landed
    // outside the one-level set the first round probed, although the guard already knew the parse
    // was uncertain. Now an uncertain parse that holds ANY relative cd asks whenever any linked
    // node_modules is reachable at all (under the repo's .worktrees, the cwd or any directory the
    // readings saw), with no depth to get wrong. Real bash runs each install in ROOT/parent/lw.
    // All three were ALLOWED at d7215825a.
    it.each([
      ['R1 two relative cds after a quoted parenthesis', "( cd ROOT; echo 'q;q);q'; cd parent; cd lw; npm ci )"],
      ['R2 a relative cd, then one that climbs back', '( cd ROOT/parent; echo \\)\\); cd x; cd ../lw; npm ci )'],
      ['R3 a comment and two relative cds on their own lines', "( cd ROOT; echo ')' # )\ncd parent\ncd lw; npm ci )"],
    ])('%s: asks (never allows)', (_name, template) => {
      expect(['ask', 'deny']).toContain(decision(template));
    });

    // A CERTAIN parse (no quote, backslash, comment, heredoc or case word next to a subshell paren)
    // keeps today's behaviour, relative cds included: only a link it actually reaches is denied.
    it.each([
      ['cd ROOT && cd lw && npm ci'],
      ['cd ROOT/parent && cd rl && npm ci'],
      ['( cd ROOT/parent; cd rl; npm ci )'],
    ])('a certain parse with relative cds that reaches no link is allowed: %s', (template) => {
      expect(decision(template)).toBeUndefined();
    });

    it('a certain parse with relative cds that reaches the link is still denied', () => {
      expect(denied(run('cd ROOT/parent && cd lw && npm ci'))).toBe(true);
    });

    // Where the uncertain shapes hold a relative cd and a link is reachable (this fixture has
    // ROOT/parent/lw), they ask; in a tree with no link anywhere they are allowed.
    describe('uncertain shapes with a relative cd, when nothing is linked anywhere', () => {
      let clean: string;
      beforeEach(() => {
        clean = mkdtempSync(join(tmpdir(), 'npmci-clean-'));
        mkdirSync(join(clean, 'real'));
        mkdirSync(join(clean, 'parent', 'rl'), { recursive: true });
      });
      afterEach(() => {
        rmSync(clean, { recursive: true, force: true });
      });
      const runClean = (template: string) =>
        syncBashDispatcher(bash(template.split('ROOT').join(clean), join(clean, 'real')), NOOP_CTX);

      it.each([
        ["( cd ROOT/parent; echo 'q;q);q'; cd rl; npm ci )"],
        ['( cd ROOT/parent; echo \\)\\); cd rl; npm ci )'],
        ['( cd ROOT/parent; x=$(case a in a) echo;; esac); cd rl; npm ci )'],
        ["( cd ROOT/parent; echo ')' # )\ncd rl; npm ci )"],
        ['( cd ROOT/parent\ncat <<EOF\n)\nEOF\ncd rl\nnpm ci )'],
        ["( cd ROOT; echo 'q;q);q'; cd parent; cd rl; npm ci )"],
        ['( cd ROOT/parent; echo "$(printf \')\')"; cd rl; npm ci )'],
      ])('is allowed: %s', (template) => {
        expect(runClean(template).hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });

    it.each([
      ["( cd ROOT/parent; echo 'q;q);q'; cd rl; npm ci )"],
      ['( cd ROOT/parent; x=$(case a in a) echo;; esac); cd rl; npm ci )'],
      ['( cd ROOT/parent; echo "$(printf \')\')"; cd rl; npm ci )'],
    ])('with a linked worktree reachable, an uncertain shape with a relative cd asks: %s', (template) => {
      expect(['ask', 'deny']).toContain(decision(template));
    });

    // The verifier's controls C1 to C15 and C17: legitimate commands, allowed from a real cwd.
    it.each([
      ['C1', 'npm ci'],
      ['C2', 'npm ci --no-audit --no-fund'],
      ['C3', 'npm ci --prefix ROOT/lw'],
      ['C4', 'npm ci --prefix ROOT/r}'],
      ['C5', 'cd ROOT/r} && npm ci'],
      ['C6', 'echo "(a)" && npm ci'],
      ['C7', 'git commit -m "fix (scope): x)" && npm ci'],
      ['C8', "echo ')' ; npm ci"],
      // C9 (an uncertain shape with a relative cd) moved to the clean-tree block below: since fix
      // round 2 it asks wherever a link is reachable, and stays allowed where nothing is linked.
      ['C10', 'echo "$(date)" && npm ci'],
      ['C11', '{ npm ci; }'],
      ['C12', 'npm ci && cd ROOT/parent/rl && npm ci'],
      ['C13', 'env CI=1 npm ci --prefix ROOT/real && npm ci --prefix ROOT/parent/rl'],
      ['C14', "echo '(' && npm ci"],
      ['C15', 'x=$(( (1+2) * 3 )) && npm ci'],
      ['C17', 'npm install'],
    ])('control %s is allowed: %s', (_id, template) => {
      expect(decision(template)).toBeUndefined();
    });

    it('control C16: a plain npm ci in a linked cwd is still denied', () => {
      expect(denied(run('npm ci', 'wt'))).toBe(true);
    });

    // The shapes that were already denied before this round stay denied.
    it.each([
      ['( cd ROOT/parent; echo "$(printf \')\')"; cd lw; npm ci )'],
      ['( cd ROOT/parent; x=$(printf ")"); cd lw; npm ci )'],
    ])('a certain parse into the linked worktree is still denied: %s', (template) => {
      expect(denied(run(template))).toBe(true);
    });
  });
});

// Ruling B (row 16 fix round 2), with injected deps: where the search looks, and what it does at its bound.
describe('the uncertain-parse search for a reachable link', () => {
  const UNCERTAIN = "( cd a; echo 'q;q);q'; cd b; npm ci )";
  const decisionOf = (command: string, cwd: string, deps: NpmCiSymlinkGuardDeps) =>
    npmCiSymlinkGuard(bash(command, cwd), NOOP_CTX, deps).hookSpecificOutput?.permissionDecision;

  it("asks when a sibling worktree under the repo's .worktrees has a linked node_modules", () => {
    const deps = {
      isSymlink: (p: string) => p === '/repo/.worktrees/other/node_modules',
      listSubdirs: (p: string) => (p === '/repo/.worktrees' ? ['me', 'other'] : []),
    };
    expect(decisionOf(UNCERTAIN, '/repo/.worktrees/me', deps)).toBe('ask');
  });

  it('is silent when nothing under any root is linked', () => {
    const deps = { isSymlink: () => false, listSubdirs: (p: string) => (p === '/repo/.worktrees' ? ['me', 'other'] : []) };
    expect(decisionOf(UNCERTAIN, '/repo/.worktrees/me', deps)).toBeUndefined();
  });

  it('asks when the search hits its bound before it finishes (never reads a cut-off search as clean)', () => {
    const deps = { isSymlink: () => false, listSubdirs: () => ['a', 'b'] };
    expect(decisionOf(UNCERTAIN, '/repo/me', deps)).toBe('ask');
  });

  it('does not search for a certain parse, whatever the deps hold', () => {
    const deps = { isSymlink: (p: string) => p === '/repo/.worktrees/other/node_modules', listSubdirs: () => ['other'] };
    expect(decisionOf('cd a && cd b && npm ci', '/repo/.worktrees/me', deps)).toBeUndefined();
  });

  it('does not search when the uncertain parse has only absolute cds (the one-level check still applies)', () => {
    const deps = { isSymlink: (p: string) => p === '/repo/.worktrees/other/node_modules', listSubdirs: () => ['other'] };
    expect(decisionOf("( cd /x; echo 'q;q);q'; cd /y; npm ci )", '/repo/.worktrees/me', deps)).toBeUndefined();
  });
});

// Two shapes the substitution scanner of the previous round let through: a clean install inside a
// substitution, aimed by an absolute --prefix at a linked worktree, run from a cwd that is not linked.
// The earlier extraction denied both. Neither may be allowed.
describe('substitutions the scanner must not lose', () => {
  const linked = linksAt('/lw/node_modules');
  const nothingLinked = linksAt();
  const blocked = (command: string, deps: NpmCiSymlinkGuardDeps) => {
    const d = npmCiSymlinkGuard(bash(command, '/wt'), NOOP_CTX, deps).hookSpecificOutput?.permissionDecision;
    return d === 'deny' || d === 'ask';
  };

  it.each([
    ['a lone backtick in a comment before it', '# don`t run this\necho "$(npm ci --prefix /lw)"'],
    ['a lone backtick in a comment on the same line', 'true # `\necho "$(npm ci --prefix /lw)"'],
    ['a lone backtick in a comment, backtick substitution after', '# a ` here\necho `npm ci --prefix /lw`'],
    ["a single-quoted sh -c body", "sh -c 'echo \"$(npm ci --prefix /lw)\"'"],
    ["a single-quoted bash -c body", "bash -c 'echo \"$(npm ci --prefix /lw)\"'"],
    ["a single-quoted sh -c body with a backtick substitution", "sh -c 'echo `npm ci --prefix /lw`'"],
    // A # that is not a comment to the shell must not hide what follows it.
    ['a # right after a substitution (not a word start)', 'echo $(true)# $(npm ci --prefix /lw)'],
    ['a # line inside an unquoted heredoc', 'cat <<EOF\n# $(npm ci --prefix /lw)\nEOF'],
    ["a # after an escaped quote in $'...'", "echo $'a\\' #' \"$(npm ci --prefix /lw)\""],
  ])('%s: never allowed', (_name, command) => {
    expect(blocked(command, linked)).toBe(true);
  });

  it('control: the same substitution without the trick is denied today', () => {
    expect(denied(npmCiSymlinkGuard(bash('echo "$(npm ci --prefix /lw)"', '/wt'), NOOP_CTX, linked))).toBe(true);
  });

  it.each([
    ['# don`t run this\necho "$(npm ci --prefix /lw)"'],
    ["sh -c 'echo \"$(npm ci --prefix /lw)\"'"],
  ])('control: %s is neither denied nor asked when nothing is linked', (command) => {
    expect(blocked(command, nothingLinked)).toBe(false);
  });

  it("control: sh -c 'npm ci' in a cwd whose node_modules is real stays quiet when another dir is linked", () => {
    expect(blocked("sh -c 'npm ci'", linked)).toBe(false);
  });
});

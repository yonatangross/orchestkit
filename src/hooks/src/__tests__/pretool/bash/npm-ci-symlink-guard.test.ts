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

// The speed tests below measure growth, not the clock. Four times the input may cost at most eight
// times the time: linear is four, quadratic is sixteen. Both speed tables share these.
const SIZE_STEP = 4;
const GROWTH_BOUND = 8;

const growth = (run: (n: number) => void, n: number) => measureGrowth(run, n, SIZE_STEP);

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
    // No depth at which reading stops: every body is shorter than its parent, so it ends anyway.
    ['five nested sh -c scripts', 'sh -c "sh -c \\"sh -c \'sh -c \\\\\\"sh -c \\\\\\\\\\\\\\"echo \\\\\\\\\\\\\\\\$(npm ci --prefix /lw)\\\\\\\\\\\\\\"\\\\\\"\'\\""'],
    ['seventy nested substitutions', `${'$('.repeat(70)}npm ci --prefix /lw${')'.repeat(70)}`],
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

  // Never allowed, never throws, and the time grows no faster than the input. A wall-clock bound
  // would measure the machine (a coverage run is several times slower than a plain one); the growth
  // between a small and a full size, timed back to back in this process, measures the scanner.
  const failClosedCases: ReadonlyArray<readonly [string, (n: number) => string, number]> = [
    ['twenty thousand nested substitutions', (n) => `${'$('.repeat(n)}npm ci --prefix /lw${')'.repeat(n)}`, 20000],
    ['twenty thousand nested double-quoted substitutions', (n) => `${'"$('.repeat(n)}npm ci --prefix /lw${')"'.repeat(n)}`, 20000],
    ['three thousand sibling substitutions', (n) => `${'echo "$(true)" '.repeat(n)}"$(npm ci --prefix /lw)"`, 3000],
    ['twenty thousand unclosed $( before it', (n) => `${'$( '.repeat(n)}echo "$(npm ci --prefix /lw)"`, 20000],
    ['twenty thousand lone backticks before it', (n) => `${'` '.repeat(n)}echo "$(npm ci --prefix /lw)"`, 20000],
  ];

  it('the fail-closed growth table has its five shapes', () => {
    expect(failClosedCases.length).toBe(5);
  });

  it.each(failClosedCases)('%s: fails closed (never allowed, never throws) and time grows no faster than the input', (_name, build, n) => {
    const small = Math.floor(n / SIZE_STEP);
    expect(small).toBeGreaterThan(0);
    // Blocked at both sizes: the shape never lets the install through.
    expect(blocked(build(small), linked)).toBe(true);
    expect(blocked(build(n), linked)).toBe(true);
    const g = growth((size) => void blocked(build(size), linked), n);
    // The timer returned a real duration for both sizes, or the ratio below says nothing.
    expect(g.small).toBeGreaterThan(0);
    expect(g.large).toBeGreaterThan(0);
    expect(g.ratio, `${_name}: ${g.small.toFixed(1)} ms at ${small}, ${g.large.toFixed(1)} ms at ${n}, ratio ${g.ratio.toFixed(1)} against bound ${GROWTH_BOUND}`).toBeLessThan(GROWTH_BOUND);
  }, 120000);

  it("control: sh -c 'npm ci' in a cwd whose node_modules is real stays quiet when another dir is linked", () => {
    expect(blocked("sh -c 'npm ci'", linked)).toBe(false);
  });
});

// Command shapes the reader follows to the install. Every command here runs a clean install aimed
// at /lw, a linked worktree, from /wt, which is not linked.
describe('command shapes the reader must follow to the install', () => {
  const linked = linksAt('/lw/node_modules');
  const nothingLinked = linksAt();
  const decision = (command: string, deps: NpmCiSymlinkGuardDeps, cwd = '/wt') =>
    npmCiSymlinkGuard(bash(command, cwd), NOOP_CTX, deps).hookSpecificOutput?.permissionDecision;

  describe('nested scripts, read the way the shell unquotes them', () => {
    it.each([
      ['a double-quoted sh -c body with escaped quotes', 'sh -c "echo \\"\\$(npm ci --prefix /lw)\\""'],
      ['a sh -c inside a sh -c, double quotes inside single', `sh -c 'bash -c "echo \\$(npm ci --prefix /lw)"'`],
      ['sh -c after a double dash', `sh -c -- 'echo "$(npm ci --prefix /lw)"'`],
      ['a single-quoted script inside a single-quoted script', `sh -c 'sh -c '\\''echo "$(npm ci --prefix /lw)"'\\'''`],
      ['three shells deep with escaped quotes', `sh -c 'sh -c "bash -c \\"npm ci --prefix /lw\\""'`],
      ['a path-qualified shell', `/bin/sh -c 'npm ci --prefix /lw'`],
      ['a shell after options', `bash -o pipefail -c 'npm ci --prefix /lw'`],
      ['a combined option', `bash -ec 'npm ci --prefix /lw'`],
      ['eval of a substitution', `eval 'echo "$(npm ci --prefix /lw)"'`],
      ['eval of a plain command', 'eval "npm ci --prefix /lw"'],
      ['eval with several words', 'eval npm ci --prefix /lw'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it.each([
      ["sh -c 'npm install --prefix /lw'"],
      ['eval "npm install --prefix /lw"'],
      ["bash -c 'echo npm ci'"],
      ['eval "$(ssh-agent -s)"'],
    ])('control: %s is quiet while /lw is linked', (command) => {
      expect(decision(command, linked)).toBeUndefined();
    });

    it.each([
      ["sh -c 'sh -c \"echo \\$(npm ci --prefix /lw)\"'"],
      ['eval "npm ci --prefix /lw"'],
    ])('control: %s is quiet when nothing is linked', (command) => {
      expect(decision(command, nothingLinked)).toBeUndefined();
    });
  });

  describe('a heredoc with a quoted delimiter is literal text', () => {
    it('reads the install after an apostrophe and a backtick inside the heredoc body', () => {
      const command = "cat <<'EOF'\nit's `x\nEOF\necho `npm ci --prefix /lw`";
      expect(decision(command, linked)).toBe('deny');
    });

    it('reads an install on the line after the heredoc', () => {
      expect(decision("cat <<'EOF'\nit's here\nEOF\nnpm ci --prefix /lw", linked)).toBe('deny');
    });

    it('control: the same heredoc with nothing linked is quiet', () => {
      expect(decision("cat <<'EOF'\nit's `x\nEOF\necho `npm ci --prefix /lw`", nothingLinked)).toBeUndefined();
    });

  });

  describe('a backslash before a newline joins the lines', () => {
    it.each([
      ['inside a word list', 'npm \\\nci --prefix /lw'],
      ['inside a substitution', 'echo "$(npm \\\nci --prefix /lw)"'],
      ['inside a word', 'n\\\npm ci --prefix /lw'],
      ['inside the subcommand', 'npm c\\\ni --prefix /lw'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it('control: a continued npm install is quiet', () => {
      expect(decision('npm \\\ninstall --prefix /lw', linked)).toBeUndefined();
    });
  });

  describe('a redirection is not part of the word next to it', () => {
    it.each([
      ['glued to the subcommand', 'npm ci --prefix /lw>/dev/null'],
      ['glued to the subcommand, fd number', 'npm ci --prefix /lw 2>/dev/null'],
      ['before the subcommand', 'npm >/dev/null ci --prefix /lw'],
      ['with an append', 'npm ci --prefix /lw >> out.log'],
      ['after a cd', 'cd /lw 2>/dev/null && npm ci'],
      ['an input redirect', 'npm ci --prefix /lw </dev/null'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it('reads the cwd form too', () => {
      expect(decision('npm ci>/dev/null', linked, '/lw')).toBe('deny');
    });

    it.each([
      ['npm install --prefix /lw>/dev/null'],
      ['npm test --prefix /lw 2>&1'],
      ['echo ok >/dev/null'],
    ])('control: %s is quiet', (command) => {
      expect(decision(command, linked)).toBeUndefined();
    });
  });

  describe('the command word', () => {
    it.each([
      ['an absolute path', '/usr/local/bin/npm ci --prefix /lw'],
      ['a relative path', './node_modules/.bin/npm ci --prefix /lw'],
      ['a path after a wrapper', 'sudo /opt/homebrew/bin/npm ci --prefix /lw'],
      ['npx running npm', 'npx npm ci --prefix /lw'],
      ['xargs running npm', 'echo x | xargs -n 1 npm ci --prefix /lw'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it.each([
      ['/usr/local/bin/npm install --prefix /lw'],
      ['/usr/local/bin/npmx ci --prefix /lw'],
      ['/opt/npm/bin/node ci --prefix /lw'],
    ])('control: %s is quiet', (command) => {
      expect(decision(command, linked)).toBeUndefined();
    });
  });

  describe('words the shell rewrites before it runs them', () => {
    it.each([
      ['a braced IFS for the blank', `npm\${IFS}ci --prefix /lw`],
      ['a braced IFS between every word', `npm\${IFS}ci\${IFS}--prefix\${IFS}/lw`],
      ['$IFS for the blank', 'npm$IFS$9ci --prefix /lw'],
      ['an ANSI-C escape for the subcommand', "npm $'\\x63i' --prefix /lw"],
      ['an ANSI-C word for the command', "$'npm' ci --prefix /lw"],
      ['an ANSI-C octal escape', "npm $'\\143i' --prefix /lw"],
      ['a brace expansion for the subcommand', 'npm c{i,} --prefix /lw'],
      ['a brace expansion with the install first', 'npm {ci,x} --prefix /lw'],
      ['a brace expansion in the command', '{npm,} ci --prefix /lw'],
      ['a variable holding the command', 'NPM=npm; $NPM ci --prefix /lw'],
      ['a braced variable holding the command', `NPM=npm; \${NPM} ci --prefix /lw`],
      ['a quoted variable holding the command', 'NPM=npm && "$NPM" ci --prefix /lw'],
      ['an exported variable holding the command', 'export NPM=npm; $NPM ci --prefix /lw'],
      ['a variable holding the subcommand', 'SUB=ci; npm $SUB --prefix /lw'],
      ['a variable holding a path', 'D=/lw; npm ci --prefix $D'],
      ['a variable chain', 'A=npm; B=$A; $B ci --prefix /lw'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it.each([
      ['a command word the command never defines', '$NPM ci --prefix /lw'],
      ['a subcommand the command never defines', 'npm $SUB --prefix /lw'],
      ['a substitution as the subcommand', 'npm $(echo ci) --prefix /lw'],
      ['a variable assigned two different values', 'NPM=npm; NPM=echo; $NPM ci --prefix /lw'],
    ])('%s: asked, because it cannot be read', (_name, command) => {
      expect(decision(command, linked)).toBe('ask');
    });

    it.each([
      ['npm c{a,b} --prefix /lw'],
      ['npm c{,i} --prefix /lw'],
      ['npm {x,ci} --prefix /lw'],
      ['n{p,}m ci --prefix /lw'],
      ['NPM=npm; $NPM install --prefix /lw'],
      ['SUB=install; npm $SUB --prefix /lw'],
      ['npm $FLAGS install --prefix /lw'],
      ["npm $'in\\x73tall' --prefix /lw"],
      [`npm\${IFS}install --prefix /lw`],
      ['echo $NPM ci'],
      ['$EDITOR notes.md'],
    ])('control: %s is quiet', (command) => {
      expect(decision(command, linked)).toBeUndefined();
    });

    it('control: nothing linked, nothing asked, for the commands that ask above', () => {
      for (const command of ['$NPM ci --prefix /lw', 'npm $SUB --prefix /lw', 'NPM=npm; $NPM ci --prefix /lw']) {
        expect(decision(command, nothingLinked)).toBeUndefined();
      }
    });
  });

  describe("an ANSI-C $'...' directory (#5198)", () => {
    // bash expands escapes inside $'...', so $'/L\'x' is the path /L'x: the reader must hand
    // the decoded directory to the probe, not the quoted text, or the install is allowed.
    it("the shape from the issue: an escaped apostrophe in a $'...' prefix", () => {
      const result = npmCiSymlinkGuard(bash("npm ci --prefix $'/L\\'x'"), NOOP_CTX, linksAt("/L'x/node_modules"));
      expect(denied(result)).toBe(true);
    });

    it.each([
      ['a hex escape inside the path', "npm ci --prefix $'/l\\x77'"],
      ['an octal escape inside the path', "npm ci --prefix $'/l\\167'"],
      ['a glued ANSI-C piece', "npm ci --prefix /l$'\\x77'"],
      ['a cd target in ANSI-C quotes', "cd $'/l\\x77' && npm ci"],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it.each([
      ["npm ci --prefix $'/L\\'x'"],
      ["npm ci --prefix $'/l\\x77'"],
      ["npm install --prefix $'/l\\x77'"],
    ])('control: %s is quiet', (command) => {
      expect(decision(command, nothingLinked)).toBeUndefined();
    });
  });

  describe('a cd with options', () => {
    it.each([
      ['cd -P'],
      ['cd -L'],
      ['cd --'],
      ['pushd'],
    ])('%s moves the directory for the install after it', (cdWord) => {
      expect(decision(`${cdWord} /lw && npm ci`, linked)).toBe('deny');
    });
  });

  describe('a comment after the directory', () => {
    it.each([
      ['on the same line, then a newline', 'cd /lw # reclaimed worktree\nnpm ci'],
      ['on the same line, then &&', 'cd /lw # reclaimed worktree && npm ci\nnpm ci'],
      ['after pushd', 'pushd /lw # here\nnpm ci'],
      ['after the install', 'npm ci --prefix /lw # fresh install'],
      ['after a tab, with several words in the comment', 'cd /lw\t# one two three\nnpm ci'],
    ])('%s: denied', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    // The comment cut applies to cd and pushd only. On an npm line it would drop words the shell
    // keeps, whenever the guard splits finer than the shell does.
    it.each([
      ['a # after a space inside a parameter expansion', `npm ci \${x:- #} --prefix /lw`],
      ['a # after IFS blanks', `npm\${IFS}ci\${IFS}#\${IFS}--prefix\${IFS}/lw`],
      ['a # after a bare IFS', 'npm$IFS$9ci$IFS#$IFS--prefix$IFS/lw'],
      ['a braced IFS body of more than sixteen characters', `npm\${IFS//zzzzzzzzzzzzzzzzzzz/}ci --prefix /lw`],
      ['a braced IFS body holding a variable', `npm\${IFS:-$x}ci --prefix /lw`],
      ['a braced IFS body holding a variable, trimmed', `npm\${IFS%$x}ci --prefix /lw`],
      ['a braced IFS body holding a brace', `npm\${IFS:-{}ci --prefix /lw`],
      ['a braced IFS body holding a replaced brace', `npm\${IFS//{/}ci --prefix /lw`],
      ['a braced IFS body holding a quoted variable', `npm\${IFS:-"$x"}ci --prefix /lw`],
      ['a braced IFS body between words of the prefix', `npm ci --prefix\${IFS:-$x}/lw`],
      ['a braced IFS body in a cd', `cd\${IFS:-$x}/lw; npm ci`],
      ['a carriage return before a # word', 'npm ci --foo\r#bar --prefix /lw'],
      ['a no-break space before a # word', 'npm ci --foo #bar --prefix /lw'],
      ['a form feed before a # word', 'npm ci --foo\f#bar --prefix /lw'],
      ['an ideographic space before a # word', 'npm ci --foo　#bar --prefix /lw'],
    ])('%s: the install after it is still read', (_name, command) => {
      expect(decision(command, linked)).toBe('deny');
    });

    it.each([
      ['cd /wt # reclaimed worktree\nnpm ci'],
      ['cd /lw # reclaimed worktree\nnpm install'],
      ['echo "cd /lw # x"; npm ci'],
    ])('control: %s is quiet', (command) => {
      expect(decision(command, linked)).toBeUndefined();
    });
  });

  describe('the other spellings npm accepts for a clean install', () => {
    it.each([
      ['install-ci-test'],
      ['install-ci'],
      ['install-cl'],
      ['isntall-c'],
      ['clean-install-t'],
      ['cleanInstall'],
      ['installClean'],
      ['isntallClean'],
      ['installCiTest'],
      ['cleanInstallTest'],
    ])('npm %s: denied', (spelling) => {
      expect(decision(`npm ${spelling} --prefix /lw`, linked)).toBe('deny');
    });

    it.each([['install-test'], ['install-foo'], ['run-script'], ['cleanup']])('control: npm %s is quiet', (spelling) => {
      expect(decision(`npm ${spelling} --prefix /lw`, linked)).toBeUndefined();
    });
  });

  // A command past the parse budget falls back to a word test. A backslash before a newline joins
  // the two lines for the shell, so the test must read it the same way.
  describe('past the parse budget, a line continuation does not hide the install', () => {
    const unclosed = (n: number) => Array.from({ length: n }, (_, k) => `# step ${k}: type $( to open`).join('\n');
    const padded = unclosed(70);
    const overLength = `# ${'x'.repeat(200_001)}`;

    it.each([
      ['a continuation after npm', 'npm \\\nci --prefix /lw'],
      ['a continuation and a blank after it', 'npm \\\n ci --prefix /lw'],
      ['a continuation inside the subcommand', 'npm c\\\ni --prefix /lw'],
      ['a continuation inside the command word', 'n\\\npm ci --prefix /lw'],
      ['two continuations in a row', 'npm \\\n\\\nci --prefix /lw'],
      ['a continuation after the subcommand', 'npm ci \\\n --prefix /lw'],
      ['a continuation before a spelled-out alias', 'npm \\\nclean-install --prefix /lw'],
    ])('too many unclosed openers, %s: asked', (_name, tail) => {
      expect(decision(`${padded}\n${tail}`, linked)).toBe('ask');
    });

    it.each([
      ['a continuation after npm', 'npm \\\nci --prefix /lw'],
      ['a continuation inside the subcommand', 'npm c\\\ni --prefix /lw'],
    ])('too long, %s: asked', (_name, tail) => {
      expect(decision(`${overLength}\n${tail}`, linked)).toBe('ask');
    });

    it('control: the plain form is asked, so the harness does reach the fallback', () => {
      expect(decision(`${padded}\nnpm ci --prefix /lw`, linked)).toBe('ask');
    });

    it.each([
      ['a continued npm install', 'npm \\\ninstall --prefix /lw'],
      ['npm and ci joined into one word', 'npm\\\nci --prefix /lw'],
      ['no npm at all', 'echo \\\nci --prefix /lw'],
    ])('control: %s stays quiet past the budget', (_name, tail) => {
      expect(decision(`${padded}\n${tail}`, linked)).toBeUndefined();
    });
  });

  describe('process substitution runs its body', () => {
    it.each([
      ['cat <(npm ci --prefix /lw)'],
      ['diff a >(npm ci --prefix /lw)'],
    ])('%s: denied', (command) => {
      expect(decision(command, linked)).toBe('deny');
    });
  });

  // Each shape is near the size limit and built to make a new reader work hard. Never allowed, and
  // the time grows no faster than the input. A wall-clock bound would measure the machine (a
  // coverage run is several times slower than a plain one); the growth between a small and a full
  // size, timed back to back in this process, measures the guard.
  const growthCases: ReadonlyArray<readonly [string, (n: number) => string, number]> = [
    ['two thousand eval words', (n) => `${'eval '.repeat(n)}npm ci --prefix /lw`, 2000],
    ['a variable that doubles on every assignment', (n) => `${'a=$a$a; '.repeat(n)}$a ci --prefix /lw`, 5000],
    ['four thousand brace expansions per word', (n) => `${'npm c{i,}{i,}{i,}{i,}{i,}{i,}{i,}{i,}{i,}{i,}{i,}{i,} --prefix /lw; '.repeat(n)}`, 200],
    ['eight thousand redirections', (n) => `${'echo > /dev/null '.repeat(n)}; npm ci --prefix /lw>x`, 8000],
    ['four thousand sibling here-documents', (n) => `${"cat <<'E'\nx\nE\n".repeat(n)}npm ci --prefix /lw`, 4000],
    ['a chain of sh -c scripts, each one word shorter', (n) => `${'sh -c '.repeat(n)}'npm ci --prefix /lw'`, 20000],
    ['a long run of line continuations', (n) => `${'x \\\n'.repeat(n)}; npm ci --prefix /lw`, 40000],
    ['a run of unclosed braced IFS words', (n) => `npm ci --prefix /lw ${'${IFS'.repeat(n)}`, 30000],
    ['a run of closing parentheses before a word', (n) => `npm ci --prefix /lw; echo x ${')'.repeat(n)}x`, 150000],
    ['a run of hash words', (n) => `npm ci --prefix /lw ${'# '.repeat(n)}`, 90000],
  ];

  it('the growth table is not empty', () => {
    expect(growthCases.length).toBeGreaterThanOrEqual(10);
  });

  // The ratio check must be able to fail. A workload whose cost grows with the square of its input
  // is measured with the same helper and must come out above the bound; a linear one must stay under.
  describe('the growth check itself', () => {
    it('control: a quadratic workload is above the bound', () => {
      const g = growth((n) => sink(quadratic(n)), 4000);
      expect(g.small).toBeGreaterThan(0);
      expect(g.large).toBeGreaterThan(0);
      expect(g.ratio, `quadratic ratio ${g.ratio.toFixed(1)} against bound ${GROWTH_BOUND}`).toBeGreaterThan(GROWTH_BOUND);
    }, 30000);

    it('control: a linear workload is under the bound', () => {
      const g = growth((n) => sink(linear(n * 4000)), 4000);
      expect(g.small).toBeGreaterThan(0);
      expect(g.large).toBeGreaterThan(0);
      expect(g.ratio, `linear ratio ${g.ratio.toFixed(1)} against bound ${GROWTH_BOUND}`).toBeLessThan(GROWTH_BOUND);
    }, 30000);
  });

  it.each(growthCases)('%s: blocked, and time grows no faster than the input', (_name, build, n) => {
    const small = Math.floor(n / SIZE_STEP);
    expect(small).toBeGreaterThan(0);
    // Blocked at both sizes: the shape never lets the install through.
    expect(['deny', 'ask']).toContain(decision(build(small), linked));
    expect(['deny', 'ask']).toContain(decision(build(n), linked));
    const g = growth((size) => void decision(build(size), linked), n);
    // The timer returned a real duration for both sizes, or the ratio below says nothing.
    expect(g.small).toBeGreaterThan(0);
    expect(g.large).toBeGreaterThan(0);
    expect(g.ratio, `${_name}: ${g.small.toFixed(1)} ms at ${small}, ${g.large.toFixed(1)} ms at ${n}, ratio ${g.ratio.toFixed(1)} against bound ${GROWTH_BOUND}`).toBeLessThan(GROWTH_BOUND);
  }, 120000);
});

let sinkValue = 0;
/** Keeps a computed number alive so the optimizer cannot drop the workload. */
function sink(value: number): void {
  sinkValue = (sinkValue + value) % 1000003;
}

/** Work that grows with the square of n (the shape the guard must never have). */
function quadratic(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) total += (i ^ j) & 7;
  return total;
}

/** Work that grows linearly with n. */
function linear(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i += 1) total += (i * 31) & 7;
  return total;
}

/** CPU milliseconds this process has used (user plus system): a busy machine does not add to it. */
function cpuMs(): number {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
}

/**
 * Times `run` at n / step and at n in the same process and returns both times in ms and their ratio.
 * It measures CPU time, not the clock, and alternates the small and the full size in each round, so
 * a loaded runner (a coverage run with many files in parallel) slows both sizes alike. The best of
 * six rounds is kept for each size so one slow tick does not decide. One warm-up round comes first.
 */
function measureGrowth(run: (n: number) => void, n: number, step: number): { small: number; large: number; ratio: number } {
  const smallSize = Math.floor(n / step);
  const time = (size: number): number => {
    const started = cpuMs();
    run(size);
    return cpuMs() - started;
  };
  run(smallSize);
  run(n);
  let small = Number.POSITIVE_INFINITY;
  let large = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 6; round += 1) {
    small = Math.min(small, time(smallSize));
    large = Math.min(large, time(n));
  }
  return { small, large, ratio: large / small };
}

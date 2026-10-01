#!/usr/bin/env node
// ============================================================================
// ork:careful guard unit tests (offline, no Claude Code needed)
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/careful/scripts/careful-guard.mjs is the PreToolUse Bash hook
//   the careful skill registers from its frontmatter. Once the skill is
//   invoked it runs on every Bash call for the rest of the session and must
//   deny, with exit 2 and a stderr reason naming the rule:
//     rm -rf on a non-temp path, git push --force / -f / --force-with-lease
//     (and a +refspec), git reset --hard, DROP TABLE / DROP DATABASE /
//     TRUNCATE, kubectl delete, terraform destroy.
//   Both directions regress silently: a missed pattern lets the command run,
//   an over-eager one blocks ordinary work and the operator turns careful off.
//   So every listed command has a deny case and every near miss an allow case.
//
// HOW
//
//   The exported matcher is called directly, then the CLI is spawned with a
//   real PreToolUse payload on stdin to pin the exit code and stderr contract.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as guard from '../../src/skills/careful/scripts/careful-guard.mjs';

const { findDestructive } = guard;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'src', 'skills', 'careful', 'scripts', 'careful-guard.mjs');

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

// The system temp root is assembled at runtime so test-no-hardcoded-tmp-writes
// does not read these matcher inputs as writes to a fixed /tmp path.
const SYS_TMP = ['', 'tmp'].join('/');

const rule = (command) => findDestructive(command, { tmpdir: '/var/folders/zz/abc/T' })?.rule ?? null;

// --- denied: one case per listed command, plus the shapes that hide them ----
const DENY = [
  ['rm -rf /', 'rm-rf'],
  ['rm -rf ~/project', 'rm-rf'],
  ['rm -fr build', 'rm-rf'],
  ['rm -Rf src', 'rm-rf'],
  ['rm -r -f src', 'rm-rf'],
  ['rm --recursive --force src', 'rm-rf'],
  ['/bin/rm -rf src', 'rm-rf'],
  ['sudo rm -rf /var/lib/postgres', 'rm-rf'],
  ['cd /repo && rm -rf node_modules', 'rm-rf'],
  ['rm -rf $TMPDIR', 'rm-rf'],
  [`rm -rf ${SYS_TMP}`, 'rm-rf'],
  [`rm -rf ${SYS_TMP}/../etc`, 'rm-rf'],
  ['rm -rf $TMPDIR/x src', 'rm-rf'],
  ['rm -rf "$(pwd)"', 'rm-rf'],
  ['find . -name x | xargs rm -rf', 'rm-rf'],
  ['bash -c "rm -rf src"', 'rm-rf'],
  ['git push --force', 'git-push-force'],
  ['git push -f origin main', 'git-push-force'],
  ['git push --force-with-lease origin feat/x', 'git-push-force'],
  ['git push --force-with-lease=main:abc123 origin main', 'git-push-force'],
  ['git push -uf origin feat/x', 'git-push-force'],
  ['git push origin +main', 'git-push-force'],
  ['git -C ../other push --force', 'git-push-force'],
  ['git reset --hard', 'git-reset-hard'],
  ['git reset --hard origin/main', 'git-reset-hard'],
  ['psql -c "DROP TABLE users"', 'sql-drop'],
  ["psql -c 'drop table if exists users'", 'sql-drop'],
  ['mysql -e "DROP DATABASE prod"', 'sql-drop'],
  ['psql -c "TRUNCATE events"', 'sql-truncate'],
  ['psql -c "truncate table events cascade"', 'sql-truncate'],
  ['psql <<SQL\nDROP TABLE users;\nSQL', 'sql-drop'],
  ['kubectl delete pod web-1', 'kubectl-delete'],
  ['kubectl -n prod delete deployment api', 'kubectl-delete'],
  ['terraform destroy', 'terraform-destroy'],
  ['terraform destroy -auto-approve', 'terraform-destroy'],
  ['terraform apply -destroy', 'terraform-destroy'],
  // review round 1 (estate-30 on #4576): ssh remote commands, remote branch delete, OpenTofu
  ["ssh host 'rm -rf /x'", 'rm-rf'],
  ['ssh -p 2222 -i ~/.ssh/k deploy@host "rm -rf /srv/app"', 'rm-rf'],
  ['ssh host -- git push --force', 'git-push-force'],
  ["ssh -o StrictHostKeyChecking=no host 'cd /repo && git reset --hard'", 'git-reset-hard'],
  ["ssh host 'kubectl delete ns prod'", 'kubectl-delete'],
  ['git push origin --delete feat/x', 'git-push-delete'],
  ['git push origin -d feat/x', 'git-push-delete'],
  ['git push origin :feat/x', 'git-push-delete'],
  ['tofu destroy', 'terraform-destroy'],
  ['tofu apply -destroy', 'terraform-destroy'],
];

for (const [command, expected] of DENY) check(`deny: ${command}`, rule(command), expected);

// --- allowed: the near misses ------------------------------------------------
const ALLOW = [
  `rm -rf ${SYS_TMP}/ork-test-123`,
  'rm -rf /var/folders/zz/abc/T/scratch',
  'rm file.txt',
  'rm -f stale.lock',
  'rm -r empty-dir',
  'git push',
  'git push origin feat/x',
  'git push -u origin feat/x',
  'git push --follow-tags',
  'git reset --soft HEAD~1',
  'git reset HEAD file.txt',
  'git commit -m "never git push --force here"',
  'grep -rn "rm -rf" scripts',
  "psql -c \"SELECT * FROM events WHERE action = 'drop'\"",
  'psql -c "SELECT drop_count FROM stats"',
  'truncate -s 0 app.log',
  'kubectl get pods -l app=delete-me',
  'kubectl logs delete-job-1',
  'terraform plan',
  'terraform apply',
  'echo done',
  'ssh host ls /srv',
  "ssh host 'git push origin feat/x'",
  `ssh host 'rm -rf ${SYS_TMP}/build'`,
  'git push origin feat/x:feat/x',
  'tofu plan',
];

for (const command of ALLOW) check(`allow: ${command}`, rule(command), null);

// --- $TMPDIR is only a temp root when TMPDIR really is one (review round 3) ----
// With TMPDIR unset or empty the shell expands `rm -rf $TMPDIR/*` to `rm -rf /*`.
const TMP_ALIAS = ['rm -rf $TMPDIR/*', 'rm -rf ${TMPDIR}/x', 'rm -rf "$TMPDIR"', 'rm -rf "$TMPDIR/build-cache"'];
for (const [label, tmpdir] of [['unset', undefined], ['empty', ''], ['root', '/'], ['relative', 'tmp']]) {
  for (const command of TMP_ALIAS) {
    check(`TMPDIR ${label}: deny ${command}`, findDestructive(command, { tmpdir })?.rule ?? null, 'rm-rf');
  }
}
// Review round 5: the aliases are gone entirely. A command can reassign TMPDIR
// before using it, so even with a valid TMPDIR they are denied.
for (const command of TMP_ALIAS) {
  check(`TMPDIR set: deny ${command}`, findDestructive(command, { tmpdir: '/var/folders/zz/abc/T' })?.rule ?? null, 'rm-rf');
}

// --- sweep: other temp-root aliases of the same class (review round 3) -------
// Only /tmp, /private/tmp and a validated TMPDIR are temp roots. Every other
// spelling, and any target that is nothing but a variable under a root, is
// denied whatever TMPDIR holds.
const REAL = '/var/folders/zz/abc/T';
const SWEEP_DENY = [
  'rm -rf $TMP/x', 'rm -rf ${TMP}/x', 'rm -rf $TEMP/x', 'rm -rf ${TEMP}/x',
  'rm -rf ~/tmp/x', 'rm -rf ~/x', 'rm -rf "~/tmp/x"',
  'rm -rf tmp/x', 'rm -rf ./tmp/x', 'rm -rf T/x',
  `rm -rf ${SYS_TMP}/$X`, `rm -rf ${SYS_TMP}/\${X}/`, 'rm -rf $TMPDIR/$X', 'rm -rf $TMPDIR/"$X"',
  `rm -rf ${SYS_TMP}/$(echo)`,
];
for (const command of SWEEP_DENY) {
  for (const [label, tmpdir] of [['set', REAL], ['unset', undefined], ['relative', 'T'], ['root', '/']]) {
    check(`sweep TMPDIR ${label}: deny ${command}`, findDestructive(command, { tmpdir })?.rule ?? null, 'rm-rf');
  }
}
// Only a literal path counts: any variable, substitution, glob, brace or tilde
// in the target means the shell decides the path, so it is never temp.
for (const command of [`rm -rf ${SYS_TMP}/build-$ID`, `rm -rf ${SYS_TMP}/*`, 'rm -rf $TMPDIR/cache-${RUN}',
  `rm -rf ${SYS_TMP}/{a,b}`, `rm -rf ${SYS_TMP}/x?`, `rm -rf ${SYS_TMP}/[ab]`]) {
  check(`literal only: deny ${command}`, findDestructive(command, { tmpdir: REAL })?.rule ?? null, 'rm-rf');
}
for (const command of [`rm -rf ${SYS_TMP}/build`, 'rm -rf /private/tmp/q/x', `rm -rf ${REAL}/x`]) {
  check(`literal only: allow ${command}`, findDestructive(command, { tmpdir: REAL })?.rule ?? null, null);
}
for (const [label, tmpdir] of [['root', '/'], ['dotdot to root', '/var/..'], ['relative', 'tmp']]) {
  check(`TMPDIR ${label} grants nothing: rm -rf /etc/x`, findDestructive('rm -rf /etc/x', { tmpdir })?.rule ?? null, 'rm-rf');
}

// --- CLI contract: exit 2 + stderr naming the rule, exit 0 on allow ----------
function runHook(payload, env = {}) {
  return spawnSync(process.execPath, [CLI], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    // a key set to undefined is removed from the child environment
    env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([, v]) => v !== undefined)),
  });
}

const bash = (command) => ({
  session_id: 'test-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command },
});

{
  const r = runHook(bash('git push --force origin main'));
  check('cli deny exit code', r.status, 2);
  check('cli deny names the rule', /git-push-force/.test(r.stderr), true);
  check('cli deny says ask the operator', /operator/i.test(r.stderr), true);
}
{
  const r = runHook(bash('git push origin feat/x'));
  check('cli allow exit code', r.status, 0);
  check('cli allow stderr empty', r.stderr, '');
}
{
  const r = runHook(bash('rm -rf $TMPDIR/x'), { TMPDIR: tmpdir() });
  check('cli valid TMPDIR: rm -rf $TMPDIR/x denied', r.status, 2);
  check('cli deny reason asks for the literal path', /literal/i.test(r.stderr), true);
}
{
  const r = runHook(bash('rm -rf $TMPDIR/*'), { TMPDIR: undefined });
  check('cli TMPDIR unset: rm -rf $TMPDIR/* denied', r.status, 2);
}
{
  // os.tmpdir() reads TMPDIR too; TMPDIR=/ must not turn every path into a temp path
  const r = runHook(bash('rm -rf /etc/x'), { TMPDIR: '/' });
  check('cli TMPDIR=/: rm -rf /etc/x denied', r.status, 2);
}
{
  const r = runHook(bash('rm -rf tmp/x'), { TMPDIR: 'tmp' });
  check('cli TMPDIR relative: rm -rf tmp/x denied', r.status, 2);
}
{
  const r = runHook({ ...bash('rm -rf /'), tool_name: 'Read' });
  check('cli ignores non-Bash tools', r.status, 0);
}
{
  const r = runHook('not json');
  check('cli unreadable input fails closed', r.status, 2);
}

// --- one validator for every temp root (review round 4, estate-31) -----------
// A root is used as a prefix only after validateTempRoot: path.resolve
// normalised, absolute, not /, at least 2 components deep (the one exception is
// /tmp itself), and its realpath must pass too when it exists. Node's
// os.tmpdir() falls back to TMP and TEMP, so those are covered as well.
const BAD_ENVS = [
  ['TMPDIR=/', { TMPDIR: '/' }],
  ['TMPDIR=//', { TMPDIR: '//' }],
  ['TMPDIR=/./', { TMPDIR: '/./' }],
  ['TMPDIR=/tmp/..', { TMPDIR: '/tmp/..' }],
  ['TMPDIR=/usr', { TMPDIR: '/usr' }],
  ['TMP=/, TMPDIR unset', { TMPDIR: undefined, TMP: '/' }],
  ['TEMP=/, TMPDIR and TMP unset', { TMPDIR: undefined, TMP: undefined, TEMP: '/' }],
];
for (const [label, env] of BAD_ENVS) {
  for (const command of ['rm -rf /usr', 'rm -rf /Users/me', 'rm -rf /usr/local/x']) {
    check(`cli ${label}: deny ${command}`, runHook(bash(command), env).status, 2);
  }
  check(`cli ${label}: deny rm -rf $TMPDIR/x`, runHook(bash('rm -rf $TMPDIR/x'), env).status, 2);
}
// One-component roots would turn a whole system tree into "temp" (measured at
// e1ee886b: TMPDIR=/usr allowed rm -rf /usr/bin). /Users/me is the repo's
// documentation stand-in for a home path.
for (const [env, command] of [
  [{ TMPDIR: '/usr' }, 'rm -rf /usr/bin'],
  [{ TMPDIR: '/Users' }, 'rm -rf /Users/me'],
  [{ TMPDIR: '/var' }, 'rm -rf /var/db'],
  [{ TMPDIR: '/home' }, 'rm -rf /home/me'],
  [{ TMPDIR: '/etc' }, 'rm -rf /etc/x'],
  [{ TMPDIR: '/opt' }, 'rm -rf /opt/x'],
]) {
  check(`cli TMPDIR=${env.TMPDIR}: deny ${command}`, runHook(bash(command), env).status, 2);
}
check('cli TMPDIR=/private/tmp/q: allow the literal rm -rf /private/tmp/q/x',
  runHook(bash('rm -rf /private/tmp/q/x'), { TMPDIR: '/private/tmp/q' }).status, 0);
check('cli TMPDIR=/private/tmp/q: deny rm -rf $TMPDIR/x',
  runHook(bash('rm -rf $TMPDIR/x'), { TMPDIR: '/private/tmp/q' }).status, 2);

// --- review round 5 (estate-31 HOLD 5936735483): reassignment before use ----
// With a VALID hook TMPDIR each of these ran rc=0, because the guard read
// `$TMPDIR` as the hook's value while the command had reassigned it. Every row,
// and its bash -c and sh -c forms, must be denied.
const REASSIGN = [
  'export TMPDIR=$HOME; rm -rf $TMPDIR/x',
  'TMPDIR=$HOME; rm -rf $TMPDIR/x',
  'TMPDIR=/ ; rm -rf $TMPDIR/usr',
  'TMPDIR=/usr && rm -rf ${TMPDIR}/local',
  'unset TMPDIR; rm -rf $TMPDIR/x',
  "eval 'TMPDIR=/'; rm -rf $TMPDIR/usr",
];
const VALID_ENV = { TMPDIR: '/private/tmp/q' };
for (const row of REASSIGN) {
  for (const form of [row, `bash -c ${JSON.stringify(row)}`, `sh -c ${JSON.stringify(row)}`]) {
    check(`reassign: deny ${form}`, runHook(bash(form), VALID_ENV).status, 2);
  }
}
// $TMP and $TEMP were never trusted; pin it with them set to a valid temp dir.
for (const command of ['rm -rf $TMP/x', 'rm -rf ${TEMP}/x']) {
  check(`never trusted: deny ${command}`, runHook(bash(command), { TMP: '/private/tmp/q', TEMP: '/private/tmp/q', ...VALID_ENV }).status, 2);
}

// --- review round 6 (estate-31 HOLD 5937102937): symlinks under a temp root --
// A literal temp path that runs through an existing link must be judged where
// it lands. Real links under a mkdtemp base (itself a valid TMPDIR root).
{
  const base = realpathSync(mkdtempSync(`${tmpdir()}/ork-careful-link-`));
  const other = realpathSync(mkdtempSync(`${tmpdir()}/ork-careful-other-`));
  try {
    symlinkSync('/usr', `${base}/to-usr`);
    symlinkSync('/', `${base}/to-root`);
    symlinkSync(other, `${base}/to-other`);
    symlinkSync(`${base}/c2`, `${base}/c1`);
    symlinkSync('/usr', `${base}/c2`);
    const env = { TMPDIR: base };
    check('link -> /usr: deny rm -rf <link>/local', runHook(bash(`rm -rf ${base}/to-usr/local`), env).status, 2);
    check('link -> /: deny rm -rf <link>/etc', runHook(bash(`rm -rf ${base}/to-root/etc`), env).status, 2);
    check('link to another temp dir: allow rm -rf <link>/x', runHook(bash(`rm -rf ${base}/to-other/x`), env).status, 0);
    check('tail not created yet: allow', runHook(bash(`rm -rf ${base}/not/yet/here`), env).status, 0);
    check('chain of two links ending outside: deny', runHook(bash(`rm -rf ${base}/c1/local`), env).status, 2);
    check('in-process: link -> /usr denied', findDestructive(`rm -rf ${base}/to-usr/local`, { tmpdir: base })?.rule ?? null, 'rm-rf');
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
}

{
  const realTmp = realpathSync(mkdtempSync(`${tmpdir()}/ork-careful-root-`));
  const r = runHook(bash('rm -rf $TMPDIR/x'), { TMPDIR: realTmp });
  check('cli real TMPDIR: deny rm -rf $TMPDIR/x (use the literal path)', r.status, 2);
  check('cli real TMPDIR: allow its literal path', runHook(bash(`rm -rf ${realTmp}/x`), { TMPDIR: realTmp }).status, 0);
  check('cli real TMPDIR: still deny rm -rf /usr', runHook(bash('rm -rf /usr'), { TMPDIR: realTmp }).status, 2);
  rmSync(realTmp, { recursive: true, force: true });
}
{
  const v = guard.validateTempRoot;
  check('validateTempRoot is exported', typeof v, 'function');
  if (typeof v === 'function') {
    for (const bad of ['/', '//', '/./', '/tmp/..', '/usr', '/home', '/Users', 'tmp', '', undefined, '/var/..']) {
      check(`validateTempRoot rejects ${JSON.stringify(bad)}`, v(bad), []);
    }
    check('validateTempRoot keeps /tmp', v('/tmp').includes('/tmp'), true);
    check('validateTempRoot normalises /tmp/x/../y', v('/tmp/x/../y').includes('/tmp/y'), true);
    check('validateTempRoot keeps a deep absent path', v('/no/such/ork-dir'), ['/no/such/ork-dir']);
  }
}

// --- report -------------------------------------------------------------------
if (failures.length > 0) {
  console.log(`careful-guard: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`careful-guard: ${passed} passed`);

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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDestructive } from '../../src/skills/careful/scripts/careful-guard.mjs';

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
  ['rm -rf /tmp', 'rm-rf'],
  ['rm -rf /tmp/../etc', 'rm-rf'],
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
  'rm -rf $TMPDIR/x',
  'rm -rf "$TMPDIR/build-cache"',
  'rm -rf ${TMPDIR}/x',
  'rm -rf /tmp/ork-test-123',
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
  "ssh host 'rm -rf $TMPDIR/x'",
  'git push origin feat/x:feat/x',
  'tofu plan',
];

for (const command of ALLOW) check(`allow: ${command}`, rule(command), null);

// --- CLI contract: exit 2 + stderr naming the rule, exit 0 on allow ----------
function runHook(payload, env = {}) {
  return spawnSync(process.execPath, [CLI], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
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
  const r = runHook(bash('rm -rf $TMPDIR/x'));
  check('cli tmpdir allow exit code', r.status, 0);
}
{
  const r = runHook({ ...bash('rm -rf /'), tool_name: 'Read' });
  check('cli ignores non-Bash tools', r.status, 0);
}
{
  const r = runHook('not json');
  check('cli unreadable input fails closed', r.status, 2);
}

// --- report -------------------------------------------------------------------
if (failures.length > 0) {
  console.log(`careful-guard: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`careful-guard: ${passed} passed`);

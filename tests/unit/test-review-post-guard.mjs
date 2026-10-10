#!/usr/bin/env node
// ============================================================================
// review-post-guard: /ork:review-pr posts only when the user asked (#4675)
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/review-pr/scripts/post-review.mjs, the one command that may
//   write a review or a comment to GitHub, and the review-pr SKILL.md that
//   must route every post through it. A fake `gh` on PATH records each call,
//   so no test touches GitHub and a refusal is proved by "gh was never run".
//
//   1. No --post: refused (exit 2), gh never runs.            (main: no script)
//   2. --post and a plain body: gh pr review runs once with the event and
//      --body-file.                                           (main: no script)
//   3. A verdict-shaped line anywhere (LAND, HOLD, XREVIEW, also behind markdown
//      emphasis or a heading) without --post-verdict: refused, gh never runs.
//                                                             (main: no script)
//   4. The same body with --post --post-verdict: posted.      (main: no script)
//   5. --kind comment posts with gh pr comment, same rules.   (main: no script)
//   5c. --body-file outside the temp dir, over 64 KB, or holding
//      a secret shape (gh token, AWS key, private key, sk- key): refused.
//                                                   (main: no script)
//   5d. TMPDIR or CLAUDE_JOB_DIR set by the caller does not widen it.
//                                                   (c6f23ae4: env widened it)
//   5e. --event approve without --post-verdict, a body with a second hard
//      link, --repo, GH_REPO, or a flag given twice: refused.  (bce3afb6)
//   5f. --pr other than a bare number or a github.com pull URL: usage
//      error.                                         (f0ea6fd9)
//   5g. --event request-changes without --post-verdict: refused.  (9f9bae3e)
//   6. SKILL.md has no raw `gh pr review` / `gh pr comment` line, names
//      post-review.mjs, --post and --post-verdict.   (main: Phase 6 is raw gh)
//   7. SKILL.md frontmatter wires skill/review-post-gate on Bash.
//                                                       (main: no such hook)
//   7b. The frontmatter wires the gate AND review-pr does not fork.
//                                        (6fed4bae: context: fork)
//   8. Control: POST_REVIEW_SCRIPT=<stub that always posts> fails test 1.
// ============================================================================

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL_DIR = path.join(REPO, 'src', 'skills', 'review-pr');
const REAL = path.join(SKILL_DIR, 'scripts', 'post-review.mjs');
const SCRIPT = process.env.POST_REVIEW_SCRIPT ? path.resolve(process.env.POST_REVIEW_SCRIPT) : REAL;

let failed = 0;
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`);
  }
}

const work = mkdtempSync(path.join(tmpdir(), 'review-post-guard-'));
const bin = path.join(work, 'bin');
const callLog = path.join(work, 'gh-calls.log');
const stdinLog = path.join(work, 'gh-stdin.log');
spawnSync('mkdir', ['-p', bin]);
writeFileSync(
  path.join(bin, 'gh'),
  `#!/bin/sh\nprintf '%s\\n' "$*" >> "${callLog}"\ncat > "${stdinLog}"\nexit 0\n`,
);
chmodSync(path.join(bin, 'gh'), 0o755);

function body(text) {
  const file = path.join(work, `body-${Math.abs(hash(text))}.md`);
  writeFileSync(file, text);
  return file;
}
function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function run(args, extraEnv = {}) {
  rmSync(callLog, { force: true });
  rmSync(stdinLog, { force: true });
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GH_CONFIG_DIR: work, ...extraEnv },
  });
  const calls = existsSync(callLog) ? readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { status: res.status, stderr: res.stderr ?? '', calls };
}

const PLAIN = body('Two findings, both minor.\n\n- nitpick: a.ts:3\n');

test('1. no --post: refused with exit 2, gh never runs', () => {
  const r = run(['--pr', '4668', '--event', 'comment', '--body-file', PLAIN]);
  assert.equal(r.status, 2, `exit ${r.status}, stderr: ${r.stderr}`);
  assert.deepEqual(r.calls, [], 'gh ran without --post');
  assert.match(r.stderr, /--post/, 'refusal must name the missing flag');
});

test('2. --post and a plain body: one gh pr review, body on stdin (the checked bytes)', () => {
  const r = run(['--pr', '4668', '--event', 'request-changes', '--body-file', PLAIN, '--post', '--post-verdict']);
  assert.equal(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
  assert.equal(r.calls.length, 1, `gh calls: ${JSON.stringify(r.calls)}`);
  assert.match(r.calls[0], /^pr review 4668 /);
  assert.match(r.calls[0], /--request-changes/);
  // gh gets the bytes that were checked, never the path: no re-read after the checks.
  assert.match(r.calls[0], /--body-file -$/);
  assert.ok(!r.calls[0].includes(PLAIN), 'the path reached gh');
  assert.equal(readFileSync(stdinLog, 'utf8'), readFileSync(PLAIN, 'utf8'));
});

const VERDICTS = [
  'LAND read 2026-10-08 at 2761857d6591512d772721e9f44df2e58d793967\n\nok',
  'HOLD read 2026-10-08 at 6b371bf06d5855ee8dd2d5143946bf824e06ad46\n',
  'XREVIEW: needs a second reader\n',
  '\n\n**HOLD** two blockers\n',
  '# LAND\n\nall green\n',
  '> HOLD, see below\n',
  // A verdict word behind an emoji or below the first line (HOLD 6097900519 should 4).
  '\u{1F534} HOLD two blockers\n',
  'Summary first.\n\nHOLD: two blockers\n',
  '\u2705 LAND\n',
  'Verdict: HOLD\n',
  '**Verdict:** LAND, merge it\n',
  // The class, not two spellings (HOLD 6098834922 must 1).
  'VERDICT: HOLD\n',
  '**VERDICT:** LAND\n',
  'Verdict - HOLD\n',
  '1. HOLD\n',
  '- hold: two blockers\n',
  'Hold.\n',
  '_verdict_ xreview\n',
  // One rule (HOLD 6099092719, codex22 6099058888): a verdict word among the
  // first four words of any line, split on \n and \r.
  'hold, see the blockers below\n',
  'land; CI is green\n',
  'xreview\u2026 needs a second reader\n',
  'Final verdict: HOLD\n',
  'Verdict is HOLD\n',
  'Recommendation: HOLD\n',
  '| Verdict | HOLD |\n',
  '**Verdict:** \u2705 LAND\n',
  '*hold*\n',
  'Summary\rHOLD\n',
  // Prose refused by design: the word stands alone among the first four.
  'hold on, one nit\n',
  'Hold-out set is fine\n',
];

test('3. a verdict-shaped line without --post-verdict: refused, gh never runs', () => {
  for (const text of VERDICTS) {
    const r = run(['--pr', '4668', '--event', 'comment', '--body-file', body(text), '--post']);
    assert.equal(r.status, 2, `${JSON.stringify(text)}: exit ${r.status}, stderr: ${r.stderr}`);
    assert.deepEqual(r.calls, [], `${JSON.stringify(text)}: gh ran`);
    assert.match(r.stderr, /--post-verdict/, 'refusal must name --post-verdict');
  }
});

test('3b. a word that only starts like a verdict is not a verdict', () => {
  for (const text of ['Holding this for a later pass.\n', 'Landing notes: fine.\n', 'Verdicts differ by reviewer.\n', '1. Landing page copy\n', 'Two findings and one nit, all minor; we can hold\n']) {
    const r = run(['--pr', '4668', '--event', 'comment', '--body-file', body(text), '--post']);
    assert.equal(r.status, 0, `${JSON.stringify(text)}: exit ${r.status}, stderr: ${r.stderr}`);
    assert.equal(r.calls.length, 1);
  }
});

test('4. verdict body with --post --post-verdict: posted', () => {
  const r = run(['--pr', '4668', '--event', 'comment', '--body-file', body(VERDICTS[0]), '--post', '--post-verdict']);
  assert.equal(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
  assert.equal(r.calls.length, 1);
  assert.match(r.calls[0], /^pr review 4668 .*--comment/);
});

test('5. --kind comment: gh pr comment, same two refusals', () => {
  let r = run(['--pr', '4668', '--kind', 'comment', '--body-file', PLAIN]);
  assert.equal(r.status, 2);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--kind', 'comment', '--body-file', body(VERDICTS[1]), '--post']);
  assert.equal(r.status, 2);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--kind', 'comment', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.calls.length, 1);
  assert.match(r.calls[0], /^pr comment 4668 --body-file -$/);
});

test('5b. bad input: missing body file or unknown event is a usage error, gh never runs', () => {
  let r = run(['--pr', '4668', '--event', 'comment', '--body-file', path.join(work, 'nope.md'), '--post']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--event', 'merge', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.calls, []);
});

test('5c. --body-file must be a small file in the temp dir, with no secret shapes', () => {
  let r = run(['--pr', '4668', '--event', 'comment', '--body-file', '/etc/hosts', '--post']);
  assert.equal(r.status, 2, `outside the temp dir: exit ${r.status} ${r.stderr}`);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--event', 'comment', '--body-file', body('x'.repeat(65537)), '--post']);
  assert.equal(r.status, 2, `too big: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
  // Placeholders built from parts, so no secret-shaped literal sits in this file.
  const shapes = ['ghp_' + 'a'.repeat(36), 'AKIA' + 'B'.repeat(16), '-----BEGIN OPENSSH ' + 'PRIVATE KEY-----', 'sk-ant-' + 'c'.repeat(40), 'github_pat_' + 'd'.repeat(40)];
  for (const secret of shapes) {
    r = run(['--pr', '4668', '--event', 'comment', '--body-file', body(`Review\n\nvalue ${secret}\n`), '--post']);
    assert.equal(r.status, 2, `${secret.slice(0, 8)}: exit ${r.status}`);
    assert.deepEqual(r.calls, []);
  }
  const link = path.join(work, 'link.md');
  symlinkSync('/etc/hosts', link);
  r = run(['--pr', '4668', '--event', 'comment', '--body-file', link, '--post']);
  assert.equal(r.status, 2, `symlink out of tmp: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
});

test('5d. TMPDIR or CLAUDE_JOB_DIR set by the caller does not move the allowed root', () => {
  for (const env of [{ TMPDIR: '/etc' }, { CLAUDE_JOB_DIR: '/etc' }, { TMPDIR: '/' }]) {
    const r = run(['--pr', '4668', '--event', 'comment', '--body-file', '/etc/hosts', '--post'], env);
    assert.equal(r.status, 2, `${JSON.stringify(env)}: exit ${r.status} ${r.stderr}`);
    assert.deepEqual(r.calls, []);
  }
});

test('5e. approve needs --post-verdict; a hard link, --repo, GH_REPO or a repeated flag is refused', () => {
  let r = run(['--pr', '4668', '--event', 'approve', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 2, `approve without --post-verdict: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--event', 'approve', '--body-file', PLAIN, '--post', '--post-verdict']);
  assert.equal(r.status, 0, r.stderr);
  const linked = body('linked review\n');
  linkSync(linked, path.join(work, 'second-link.md'));
  r = run(['--pr', '4668', '--event', 'comment', '--body-file', linked, '--post']);
  assert.equal(r.status, 2, `hard link: exit ${r.status} ${r.stderr}`);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--event', 'comment', '--body-file', PLAIN, '--post', '--repo', 'o/other']);
  assert.equal(r.status, 1, `--repo: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--event', 'comment', '--body-file', PLAIN, '--post'], { GH_REPO: 'o/other' });
  assert.equal(r.status, 2, `GH_REPO: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
  r = run(['--pr', '4668', '--pr', '4669', '--event', 'comment', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 1, `repeated --pr: exit ${r.status}`);
  assert.deepEqual(r.calls, []);
});

test('5g. request-changes is a verdict too: refused without --post-verdict', () => {
  const r = run(['--pr', '4668', '--event', 'request-changes', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 2, `exit ${r.status}`);
  assert.deepEqual(r.calls, []);
  assert.match(r.stderr, /--post-verdict/);
});

test('5f. --pr is a bare number or a github.com pull URL, nothing else', () => {
  for (const pr of ['#4668', '4668abc', 'https://evil.example/o/r/pull/4668', 'https://github.com/o/r/pull/4668/files', 'o/r#4668', '-1']) {
    const r = run(['--pr', pr, '--event', 'comment', '--body-file', PLAIN, '--post']);
    assert.equal(r.status, 1, `${pr}: exit ${r.status}`);
    assert.deepEqual(r.calls, [], `${pr}: gh ran`);
  }
  const r = run(['--pr', 'https://github.com/o/r/pull/4668', '--event', 'comment', '--body-file', PLAIN, '--post']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls[0], /^pr review https:\/\/github\.com\/o\/r\/pull\/4668 /);
});

const SKILL = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

test('6. SKILL.md routes every post through post-review.mjs', () => {
  const raw = SKILL.split('\n').filter((l) => /^\s*gh\s+(pr\s+(review|comment)|issue\s+comment)\b/.test(l));
  assert.deepEqual(raw, [], 'raw posting lines left in SKILL.md');
  assert.match(SKILL, /scripts\/post-review\.mjs/);
  assert.match(SKILL, /--post-verdict/);
  assert.match(SKILL, /never posts unless/i);
});

test('7b. the gate is skill-scoped, so review-pr must not fork (a fork drops frontmatter hooks)', () => {
  // Measured on CC 2.1.294: run 913b0ab4 (context: fork) left no record of
  // this hook on a Bash call; run c6fae215 (inline) ran it and it denied.
  const fm = SKILL.split(/^---\s*$/m)[1] ?? '';
  assert.match(fm, /run-hook\.mjs skill\/review-post-gate/);
  assert.doesNotMatch(fm, /^context:\s*["']?fork["']?\s*(?:#.*)?$/m, 'review-pr sets context: fork, so the post gate never runs');
  assert.match(fm, /matcher:\s*"Bash\|Monitor"/, 'Monitor runs commands too, so the gate must match it');
  assert.match(fm, /matcher:\s*"[^"]*mcp__\.\*[^"]*"/, 'MCP tools must reach the gate (a GitHub MCP server holds its own token)');
});

test('7. SKILL.md frontmatter wires skill/review-post-gate on Bash', () => {
  const fm = SKILL.split(/^---\s*$/m)[1] ?? '';
  assert.match(fm, /matcher:\s*"Bash\|Monitor"\s*\n\s*hooks:\s*\n\s*-\s*type:\s*command\s*\n\s*command:\s*"[^"]*run-hook\.mjs skill\/review-post-gate"/);
});

rmSync(work, { recursive: true, force: true });
console.log(`\nreview-post-guard: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

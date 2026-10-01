#!/usr/bin/env node
// ============================================================================
// rule-check: /ork:review-pr rule-check mode, offline with a stubbed agent()
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/review-pr/workflows/rule-check.js (one verifier per rule over the
//   diff, then a skeptic per violation, report only survivors) and
//   src/skills/review-pr/scripts/collect-rules.mjs (which files feed it).
//   No live agent runs: every verifier and skeptic answer is scripted.
//
//   1. Splitting, on fixtures: top-level list items, nested items and lazy
//      continuation fold into their parent, table data rows (not header or
//      separator), directive paragraphs and quotes; code fences, YAML
//      frontmatter and HTML comments are never rules; text with no directive
//      word is skipped AND reported; one rule copied into two files is checked
//      once and records where else it lives.
//   2. Fan-out: one verifier per rule at effort low; above the ceiling, rules
//      share verifiers in contiguous batches and none is dropped; the ceiling
//      is lowerable and never above 24.
//   3. Survivor filter: a skeptic kill needs refuted=true, a file:line citation
//      inside the diff and a reason; an unbacked kill, a dead skeptic or
//      refuted=false leaves the violation standing. Violations in files outside
//      the diff are out of scope; violations with no file go to unverified;
//      over the skeptic ceiling go to unverified, never to survivors silently.
//   4. Reporting: a dead or BLOCKED verifier leaves its rules unchecked, and a
//      verifier that skips a rule in its batch leaves that rule unchecked.
//   5. Collector: project and user CLAUDE.md, rules/**/*.md, whole-line @imports
//      one level deep, --no-user, no file read twice.
//   6. Determinism: no Date.now(), Math.random() or argless new Date().
//   7. Control: RULE_CHECK_SCRIPT=<stub that reports every violation> fails.
// ============================================================================

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAL = path.join(REPO, 'src', 'skills', 'review-pr', 'workflows', 'rule-check.js');
const COLLECT = path.join(REPO, 'src', 'skills', 'review-pr', 'scripts', 'collect-rules.mjs');
const SCRIPT = process.env.RULE_CHECK_SCRIPT ? path.resolve(process.env.RULE_CHECK_SCRIPT) : REAL;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const SOURCE = readFileSync(SCRIPT, 'utf8');
const body = new AsyncFunction('args', 'agent', 'phase', 'log', 'pipeline', SOURCE.replace(/^export const meta/m, 'const meta'));

async function pipeline(items, ...stages) {
  return Promise.all(
    items.map(async (item, i) => {
      let v = item;
      try {
        for (let s = 0; s < stages.length; s++) v = await (s === 0 ? stages[s](item, item, i) : stages[s](v, item, i));
        return v;
      } catch {
        return null;
      }
    }),
  );
}

async function run(args, answer) {
  const calls = [];
  const agent = async (prompt, opts) => {
    calls.push({ prompt, opts });
    return answer(opts, prompt);
  };
  const result = await body(args, agent, () => {}, () => {}, pipeline);
  return { result, calls };
}

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL: ${name}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------
const CLAUDE_MD = `---
paths: ["src/**"]
---
# Project rules

This file says what the repo is. It is a plugin.

## Writing
- Never use the em-dash in any output.
- Prefer plain words over jargon, and
  stop when the point is made.
  - nested: this also counts as part of the parent rule
- Shorter replies read better.

Always respond in English unless asked otherwise.

> Avoid \`Any\` typing; use the strongest type the data supports.

\`\`\`bash
# never run this, it is a code sample
rm -rf /never
\`\`\`

<!-- never treat a comment as a rule -->

## Gotchas
| Gotcha | Why |
|--------|-----|
| Never push to main without approval | protected branch |
| The wrapper eats exit 2 | historical note |
`;
const RULES_MD = `# Anti-patterns
- **offset pagination**: Avoid offset pagination; use cursor-based pagination instead.
- Never use the em-dash in any output.
`;
const SOURCES = [
  { path: 'CLAUDE.md', text: CLAUDE_MD },
  { path: '.claude/rules/antipatterns.md', text: RULES_MD },
];
const FILES = ['src/api.ts', 'README.md'];
const BASE = { target: 'PR #4242', diffCommand: 'gh pr diff 4242', sources: SOURCES, changedFiles: FILES };
const idsIn = (prompt) => [...prompt.matchAll(/- (R\d+) \(/g)].map((m) => m[1]);
const NONE = (o, p) => (o.phase === 'Verify' ? { status: 'DONE', results: idsIn(p).map((ruleId) => ({ ruleId, applies: false, violations: [] })) } : { refuted: false, reason: 'n/a' });

// --------------------------------------------------------------------------
// 1. Splitting
// --------------------------------------------------------------------------
await test('splits list items, table rows, directive paragraphs and quotes', async () => {
  const { result } = await run(BASE, NONE);
  const texts = result.rules.map((r) => r.text);
  assert.ok(texts.includes('Never use the em-dash in any output.'), texts.join('\n'));
  assert.ok(texts.some((t) => t.startsWith('Prefer plain words over jargon, and stop when the point is made. nested: this also counts')), 'continuation and nested item fold into the parent');
  assert.ok(texts.includes('Always respond in English unless asked otherwise.'));
  assert.ok(texts.includes('Avoid `Any` typing; use the strongest type the data supports.'));
  assert.ok(texts.includes('Never push to main without approval | protected branch'));
  assert.ok(texts.some((t) => t.includes('offset pagination')));
  assert.equal(result.rulesFound, 6, `got:\n${texts.join('\n')}`);
});

await test('code fences, frontmatter, HTML comments and table headers are never rules', async () => {
  const { result } = await run(BASE, NONE);
  const all = [...result.rules, ...result.skipped].map((r) => r.text).join('\n');
  assert.ok(!all.includes('rm -rf'), 'code fence leaked');
  assert.ok(!all.includes('paths:'), 'frontmatter leaked');
  assert.ok(!all.includes('treat a comment'), 'HTML comment leaked');
  assert.ok(!all.includes('Gotcha | Why'), 'table header leaked');
  assert.ok(!all.includes('--------'), 'table separator leaked');
});

await test('text with no directive word is skipped and reported, not dropped', async () => {
  const { result } = await run(BASE, NONE);
  const sk = result.skipped.map((s) => s.text);
  assert.ok(sk.includes('This file says what the repo is. It is a plugin.'));
  assert.ok(sk.includes('Shorter replies read better.'));
  assert.ok(sk.includes('The wrapper eats exit 2 | historical note'));
  assert.ok(result.skipped.every((s) => s.reason === 'no directive word' && s.source && s.line));
});

await test('a rule copied into two files is checked once and records the copy', async () => {
  const { result, calls } = await run(BASE, NONE);
  const em = result.rules.filter((r) => r.text === 'Never use the em-dash in any output.');
  assert.equal(em.length, 1);
  assert.equal(em[0].source, 'CLAUDE.md');
  assert.deepEqual(em[0].alsoIn, ['.claude/rules/antipatterns.md:3']);
  assert.equal(calls.filter((c) => c.opts.phase === 'Verify').length, 6);
});

// --------------------------------------------------------------------------
// 2. Fan-out
// --------------------------------------------------------------------------
await test('one verifier per rule, each at effort low, each prompt carries one rule', async () => {
  const { calls, result } = await run(BASE, NONE);
  const v = calls.filter((c) => c.opts.phase === 'Verify');
  assert.equal(v.length, result.rulesFound);
  for (const c of v) {
    assert.equal(c.opts.effort, 'low');
    assert.equal(idsIn(c.prompt).length, 1);
    assert.match(c.prompt, /Check this ONE rule/);
    assert.match(c.prompt, /gh pr diff 4242/);
  }
  assert.equal(result.batched, false);
});

await test('above the ceiling rules share verifiers in batches, none dropped', async () => {
  const many = { path: 'big.md', text: Array.from({ length: 30 }, (_, i) => `- Never do thing number ${i + 1}.`).join('\n') };
  const { calls, result } = await run({ ...BASE, sources: [many], maxVerifiers: 4 }, NONE);
  const v = calls.filter((c) => c.opts.phase === 'Verify');
  assert.equal(v.length, 4);
  const covered = v.flatMap((c) => idsIn(c.prompt));
  assert.equal(covered.length, 30);
  assert.equal(new Set(covered).size, 30);
  assert.equal(result.batched, true);
  assert.ok(result.reasons.some((r) => r.startsWith('batched: 30 rules over 4 verifiers')));
});

await test('default ceiling is 12 and never above 24', async () => {
  const many = { path: 'big.md', text: Array.from({ length: 60 }, (_, i) => `- Never do thing number ${i + 1}.`).join('\n') };
  const d = await run({ ...BASE, sources: [many] }, NONE);
  assert.equal(d.calls.filter((c) => c.opts.phase === 'Verify').length, 12);
  const hi = await run({ ...BASE, sources: [many], maxVerifiers: 500 }, NONE);
  assert.equal(hi.calls.filter((c) => c.opts.phase === 'Verify').length, 24);
});

// --------------------------------------------------------------------------
// 3. Survivor filter
// --------------------------------------------------------------------------
const EM = 'Never use the em-dash in any output.';
const VIOLATE = (file, line) => (o, p) => {
  if (o.phase !== 'Verify') return null;
  return { status: 'DONE', results: idsIn(p).map((ruleId) => ({ ruleId, applies: true, violations: p.includes(EM) ? [{ file, line, quote: 'a \u2014 b', explanation: 'em-dash added' }] : [] })) };
};
const withSkeptic = (verify, skeptic) => (o, p) => (o.phase === 'Verify' ? verify(o, p) : skeptic(o, p));

await test('a backed skeptic kill removes the violation from survivors', async () => {
  const { result } = await run(BASE, withSkeptic(VIOLATE('src/api.ts', 10), () => ({ refuted: true, citation: 'src/api.ts:10', reason: 'that line is unchanged context' })));
  assert.equal(result.survivors.length, 0);
  assert.equal(result.refuted.length, 1);
  assert.equal(result.refuted[0].citation, 'src/api.ts:10');
});

await test('refuted=false keeps the violation as a survivor', async () => {
  const { result } = await run(BASE, withSkeptic(VIOLATE('src/api.ts', 10), () => ({ refuted: false, reason: 'line 10 adds an em-dash' })));
  assert.equal(result.survivors.length, 1);
  assert.equal(result.survivors[0].skeptic, 'upheld');
  assert.equal(result.survivors[0].confidence, 'high');
});

await test('an unbacked kill (no citation, or a citation outside the diff) does not refute', async () => {
  for (const vote of [{ refuted: true, reason: 'looks fine' }, { refuted: true, citation: 'other/file.ts:3', reason: 'x' }, { refuted: true, citation: 'src/api.ts', reason: 'no line' }, { refuted: true, citation: 'src/api.ts:10', reason: '  ' }]) {
    const { result } = await run(BASE, withSkeptic(VIOLATE('src/api.ts', 10), () => vote));
    assert.equal(result.survivors.length, 1, JSON.stringify(vote));
    assert.equal(result.survivors[0].skeptic, 'unbacked refutation');
  }
});

await test('a dead or throwing skeptic leaves the violation standing at low confidence', async () => {
  for (const sk of [() => null, () => { throw new Error('api error'); }]) {
    const { result } = await run(BASE, withSkeptic(VIOLATE('src/api.ts', 10), sk));
    assert.equal(result.survivors.length, 1);
    assert.equal(result.survivors[0].confidence, 'low');
  }
});

await test('violations outside the diff are out of scope and never reach a skeptic', async () => {
  const { result, calls } = await run(BASE, withSkeptic(VIOLATE('lib/old.ts', 4), () => ({ refuted: false, reason: 'x' })));
  assert.equal(result.outOfScope.length, 1);
  assert.equal(result.survivors.length, 0);
  assert.equal(calls.filter((c) => c.opts.phase === 'Skeptic').length, 0);
});

await test('a violation with no file goes to unverified, not survivors', async () => {
  const { result } = await run(BASE, withSkeptic(VIOLATE('', 4), () => ({ refuted: false, reason: 'x' })));
  assert.equal(result.unverified.length, 1);
  assert.equal(result.survivors.length, 0);
});

await test('over the skeptic ceiling, the rest go to unverified with a reason', async () => {
  const verify = (o, p) => ({ status: 'DONE', results: idsIn(p).map((ruleId) => ({ ruleId, applies: true, violations: [{ file: 'src/api.ts', line: Number(ruleId.slice(1)), quote: 'q', explanation: 'e' }] })) });
  const { result, calls } = await run({ ...BASE, maxSkeptics: 2 }, withSkeptic(verify, () => ({ refuted: false, reason: 'x' })));
  assert.equal(calls.filter((c) => c.opts.phase === 'Skeptic').length, 2);
  assert.equal(result.survivors.length, 2);
  assert.equal(result.unverified.length, result.rulesFound - 2);
  assert.ok(result.reasons.some((r) => r.startsWith('manual:')));
});

await test('the skeptic prompt carries the rule, the location and the quote, not the verifier explanation', async () => {
  const { calls } = await run(BASE, withSkeptic(VIOLATE('src/api.ts', 10), () => ({ refuted: false, reason: 'x' })));
  const s = calls.find((c) => c.opts.phase === 'Skeptic');
  assert.match(s.prompt, /REFUTE/);
  assert.match(s.prompt, /src\/api\.ts:10/);
  assert.ok(s.prompt.includes(EM));
  assert.ok(!s.prompt.includes('em-dash added'), 'verifier explanation leaked to the skeptic');
});

// --------------------------------------------------------------------------
// 4. Unchecked rules
// --------------------------------------------------------------------------
await test('a dead, BLOCKED or silent verifier leaves its rules unchecked', async () => {
  const { result } = await run(BASE, (o, p) => {
    if (o.phase !== 'Verify') return null;
    const id = idsIn(p)[0];
    if (id === 'R1') return null;
    if (id === 'R2') return { status: 'BLOCKED', results: [] };
    if (id === 'R3') return { status: 'DONE', results: [] };
    if (id === 'R4') throw new Error('boom');
    return { status: 'DONE', results: [{ ruleId: id, applies: false, violations: [] }] };
  });
  assert.deepEqual(result.unchecked.map((u) => u.id).sort(), ['R1', 'R2', 'R3', 'R4']);
  assert.ok(result.reasons.some((r) => r.startsWith('unchecked: 4')));
});

await test('no sources reports no-sources and spawns nothing', async () => {
  const { result, calls } = await run({ ...BASE, sources: [] }, NONE);
  assert.equal(result.status, 'no-sources');
  assert.equal(calls.length, 0);
});

// --------------------------------------------------------------------------
// 5. Collector
// --------------------------------------------------------------------------
await test('collect-rules reads project and user files, follows @imports once', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'rule-check-'));
  try {
    const repo = path.join(root, 'repo');
    const home = path.join(root, 'home');
    mkdirSync(path.join(repo, '.claude', 'rules', 'sub'), { recursive: true });
    mkdirSync(path.join(home, '.claude', 'rules'), { recursive: true });
    writeFileSync(path.join(repo, 'CLAUDE.md'), '# P\n- Never do X.\n');
    writeFileSync(path.join(repo, '.claude', 'rules', 'a.md'), '- Always do Y.\n');
    writeFileSync(path.join(repo, '.claude', 'rules', 'sub', 'b.md'), '- Avoid Z.\n');
    writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '@RTK.md\n@~/.claude/RTK.md\n@missing.md\n- Prefer W.\n');
    writeFileSync(path.join(home, '.claude', 'RTK.md'), '- Never trust a proxy metric.\n');
    writeFileSync(path.join(home, '.claude', 'rules', 'c.md'), '- Only use V.\n');
    const out = JSON.parse(execFileSync('node', [COLLECT, '--repo', repo, '--home', home], { encoding: 'utf8' }));
    assert.deepEqual(out.sources.map((s) => s.path), ['CLAUDE.md', '.claude/rules/a.md', '.claude/rules/sub/b.md', '~/.claude/CLAUDE.md', '~/.claude/RTK.md', '~/.claude/rules/c.md']);
    assert.deepEqual(out.missing, []);
    assert.deepEqual(out.skipped, [{ import: '@missing.md', from: '~/.claude/CLAUDE.md', reason: 'missing' }]);
    const projOnly = JSON.parse(execFileSync('node', [COLLECT, '--repo', repo, '--home', home, '--no-user'], { encoding: 'utf8' }));
    assert.deepEqual(projOnly.sources.map((s) => s.path), ['CLAUDE.md', '.claude/rules/a.md', '.claude/rules/sub/b.md']);
    const { result } = await run({ ...BASE, sources: out.sources }, NONE);
    assert.equal(result.rulesFound, 6);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Review fix (estate-29 on #4573): an @import is plain text in a CLAUDE.md the
// reviewed PR may have written. Only a .md whose realpath sits inside the repo
// root or ~/.claude is followed; anything else is skipped with a reason and
// never read, so its bytes cannot reach a verifier or skeptic prompt.
function importFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'rule-check-imp-'));
  const repo = path.join(root, 'repo');
  const home = path.join(root, 'home');
  const outside = path.join(root, 'outside');
  mkdirSync(path.join(repo, 'docs'), { recursive: true });
  mkdirSync(path.join(home, '.claude'), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, 'notes.txt'), '- Never reveal SECRET-TXT-4573.\n');
  writeFileSync(path.join(outside, 'notes.md'), '- Never reveal SECRET-MD-4573.\n');
  writeFileSync(path.join(outside, 'linked.md'), '- Never reveal SECRET-LINK-4573.\n');
  symlinkSync(path.join(outside, 'linked.md'), path.join(repo, 'docs', 'escape.md'));
  writeFileSync(path.join(repo, 'docs', 'style.md'), '- Always name the PR in the commit.\n');
  writeFileSync(path.join(repo, 'docs', 'data.txt'), '- Never reveal SECRET-NOTMD-4573.\n');
  writeFileSync(
    path.join(repo, 'CLAUDE.md'),
    '# P\n@../outside/notes.txt\n@../outside/notes.md\n@docs/escape.md\n@docs/data.txt\n@docs/style.md\n- Never do X.\n',
  );
  const out = JSON.parse(execFileSync('node', [COLLECT, '--repo', repo, '--home', home], { encoding: 'utf8' }));
  return { root, out };
}
const reasonOf = (out, imp) => ((out.skipped || []).find((x) => x.import === imp) || {}).reason;

await test('import fix: @../outside/notes.txt is skipped and never reaches a prompt', async () => {
  const { root, out } = importFixture();
  try {
    assert.ok(!JSON.stringify(out.sources).includes('SECRET-TXT-4573'), 'outside file content was read into sources');
    assert.equal(reasonOf(out, '@../outside/notes.txt'), 'outside-root', `skipped: ${JSON.stringify(out.skipped || null)}`);
    const { calls } = await run({ ...BASE, sources: out.sources }, (o, p) =>
      o.phase === 'Verify' ? { status: 'DONE', results: idsIn(p).map((ruleId) => ({ ruleId, applies: true, violations: [{ file: 'src/api.ts', line: 1, quote: 'q', explanation: 'e' }] })) } : { refuted: false, reason: 'x' },
    );
    assert.ok(calls.length > 0);
    for (const c of calls) assert.ok(!/SECRET-[A-Z]+-4573/.test(c.prompt), `secret leaked into a ${c.opts.phase} prompt`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('import fix: a .md outside both roots is skipped as outside-root', async () => {
  const { root, out } = importFixture();
  try {
    assert.equal(reasonOf(out, '@../outside/notes.md'), 'outside-root');
    assert.ok(!JSON.stringify(out.sources).includes('SECRET-MD-4573'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('import fix: an in-repo symlink pointing outside is skipped as symlink-escape', async () => {
  const { root, out } = importFixture();
  try {
    assert.equal(reasonOf(out, '@docs/escape.md'), 'symlink-escape');
    assert.ok(!JSON.stringify(out.sources).includes('SECRET-LINK-4573'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('import fix: an in-repo non-.md file is skipped as not-md', async () => {
  const { root, out } = importFixture();
  try {
    assert.equal(reasonOf(out, '@docs/data.txt'), 'not-md');
    assert.ok(!JSON.stringify(out.sources).includes('SECRET-NOTMD-4573'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('import fix: an in-repo .md is followed', async () => {
  const { root, out } = importFixture();
  try {
    assert.deepEqual(out.sources.map((x) => x.path), ['CLAUDE.md', 'docs/style.md']);
    assert.equal(reasonOf(out, '@docs/style.md'), undefined);
    assert.equal((out.skipped || []).length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --------------------------------------------------------------------------
// 6. Determinism
// --------------------------------------------------------------------------
await test('no Date.now, Math.random or argless new Date in the script', async () => {
  const code = SOURCE.replace(/\/\/.*$/gm, '');
  assert.ok(!/Date\.now\(|Math\.random\(|new Date\(\s*\)/.test(code));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);

#!/usr/bin/env node
// ============================================================================
// review-fanout: Phases 3 and 4.5 of /ork:review-pr, offline with a stubbed agent()
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/review-pr/workflows/review-fanout.js must never let refutation
//   alone turn request-changes into approve, never refute ground truth, and never
//   spawn more refuters than the engine section 8 ceiling. Every case below
//   scripts the agents' answers and asserts the result:
//
//   1. Selection (STEP 0 plus Phase 1 domains): full, security, performance and
//      quick focus; backend, frontend and ai domain flags; unknown focus or
//      missing domain flags fail toward coverage.
//   2. Refutation effort gate: none at low/medium; one ADVISORY vote at high that
//      never demotes; quorum at xhigh (3 for a request-changes blocker, 2 for
//      HIGH); majority of PLANNED votes; a vote needs an in-scope file:line
//      citation and a command; a null or throwing refuter is upheld.
//   3. Blindness: the refuter prompt carries category and location only, never
//      the producer's title, description, suggestion or role; the refuter runs
//      as the producer's agent type.
//   4. Ceiling: 24 spawns by default, lowerable never raisable; HIGH findings
//      never take the last blocker quorum; overflow is flagged for manual review.
//   5. Gate: producer-basis verdict plus a separate post-refutation verdict; a
//      killed blocker lands in confirmationNeeded; failing checks, dead or
//      BLOCKED reviewers and a reviewer's lone request-changes are floors.
//   6. Streaming: a finding reaches its refuters before a slower reviewer
//      returns (pipeline, not a barrier).
//   7. Determinism: no Date.now(), Math.random() or argless new Date().
//   8. Control: a stub script that approves everything fails this harness.
//
// HOW
//
//   Same harness as test-verify-dispatch.mjs: the script runs as an async
//   function body with args, agent, phase, log and pipeline injected. The
//   pipeline stub follows the Workflow runtime contract: "Every stage callback
//   receives (prevResult, originalItem, index)" and "A stage that throws drops
//   that item to null and skips its remaining stages."
//
//   REVIEW_FANOUT_SCRIPT=<path> runs the whole suite against another script
//   (the planted-control run: point it at a stub and the suite must fail).
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAL = path.join(REPO, 'src', 'skills', 'review-pr', 'workflows', 'review-fanout.js');
const SCRIPT = process.env.REVIEW_FANOUT_SCRIPT ? path.resolve(process.env.REVIEW_FANOUT_SCRIPT) : REAL;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const compile = (src) => new AsyncFunction('args', 'agent', 'phase', 'log', 'pipeline', src.replace(/^export const meta/m, 'const meta'));
const SOURCE = readFileSync(SCRIPT, 'utf8');
const body = compile(SOURCE);

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

const FILES = ['api/db.py', 'api/auth.py', 'web/App.tsx', 'web/util.ts'];
const F = (over = {}) => ({ id: 'SEC-001', severity: 'critical', category: 'security', file: 'api/db.py', line: 40, title: 'SQL built by string concat', description: 'user input reaches the query unescaped', suggestion: 'use a bound parameter', conventional_comment: 'issue', ...over });
const CLEAN = { status: 'DONE', summary: 'clean', verdict: 'approve', findings: [] };
const WITH = (...findings) => ({ status: 'DONE', summary: 'x', verdict: findings.length ? 'request-changes' : 'approve', findings });
const KILL = (cit = 'api/db.py:40') => ({ exists: false, citation: cit, command: `sed -n 38,42p ${cit.split(':')[0]}`, reason: 'bound parameter already used' });
const DOWN = (severity, cit = 'api/db.py:40') => ({ exists: true, severity, citation: cit, command: 'sed -n 38,42p api/db.py', reason: 'real but bounded' });
const UP = { exists: true, severity: 'critical', citation: 'api/db.py:40', command: 'sed -n 38,42p api/db.py', reason: 'confirmed' };
const BASE = { target: 'PR #4242', effort: 'xhigh', focus: 'full', domains: { backend: true, frontend: true, ai: false }, changedFiles: FILES };

async function run({ args = {}, review = {}, refute = [], gate } = {}) {
  const calls = [];
  const refQ = [...refute];
  const agent = async (prompt, opts) => {
    const [kind, ...rest] = String(opts.label).split(':');
    const who = rest.join(':');
    calls.push({ kind, who, opts, prompt });
    if (kind === 'review') {
      if (gate && gate[who]) await gate[who]();
      if (!(who in review)) return CLEAN;
      const r = review[who];
      if (r instanceof Error) throw r;
      return r;
    }
    if (kind === 'refute') {
      if (!refQ.length) throw new Error(`no scripted refute answer left for ${opts.label}`);
      const r = refQ.shift();
      if (r instanceof Error) throw r;
      return r;
    }
    throw new Error(`unexpected label ${opts.label}`);
  };
  const logs = [];
  const merged = { ...BASE, ...args };
  const result = await body(merged, agent, () => {}, (m) => logs.push(String(m)), pipeline);
  const of = (k) => calls.filter((c) => c.kind === k);
  return { result, calls, logs, reviewed: of('review').map((c) => c.who).sort(), refuters: of('refute') };
}

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(e && e.message).split('\n').join('\n       ')}`);
  }
}
const why = (r) => r.reasons.join('\n');
const find = (r, key) => r.findings.find((f) => f.key === key);

console.log('review-fanout');

// 1. selection
await test('full focus, full-stack diff: security, readability, type-safety, tests, backend, frontend', async () => {
  const { reviewed, calls } = await run();
  assert.deepEqual(reviewed, ['backend', 'frontend', 'readability', 'security', 'tests', 'type-safety']);
  assert.equal(calls[0].who, 'security', 'security is dispatched first');
});
await test('backend-only diff skips the frontend reviewer', async () => {
  const { reviewed } = await run({ args: { domains: { backend: 'true', frontend: 'false', ai: 'false' } } });
  assert.deepEqual(reviewed, ['backend', 'readability', 'security', 'tests', 'type-safety']);
});
await test('an AI diff adds the llm-integrator as a 7th reviewer', async () => {
  const { reviewed, calls } = await run({ args: { domains: { backend: true, frontend: true, ai: true } } });
  assert.equal(reviewed.length, 7);
  assert.equal(calls.find((c) => c.who === 'ai').opts.agentType, 'ork:llm-integrator');
});
await test('reviewers run as the agent types in rules/agent-prompts-task-tool.md', async () => {
  const { calls } = await run();
  const types = Object.fromEntries(calls.map((c) => [c.who, c.opts.agentType]));
  assert.deepEqual(types, { security: 'ork:security-auditor', readability: 'ork:code-quality-reviewer', 'type-safety': 'ork:code-quality-reviewer', tests: 'ork:test-generator', backend: 'ork:backend-system-architect', frontend: 'ork:frontend-ui-developer' });
});
await test('quick focus runs a single code-quality reviewer', async () => {
  const { reviewed } = await run({ args: { focus: 'quick' } });
  assert.deepEqual(reviewed, ['readability']);
});
await test('security focus runs security plus one quality reviewer', async () => {
  const { reviewed } = await run({ args: { focus: 'Security' } });
  assert.deepEqual(reviewed, ['readability', 'security']);
});
await test('performance focus adds the frontend-performance-engineer', async () => {
  const { reviewed, calls } = await run({ args: { focus: 'performance' } });
  assert.ok(reviewed.includes('performance'));
  assert.equal(calls.find((c) => c.who === 'performance').opts.agentType, 'ork:frontend-performance-engineer');
});
await test('an unknown focus runs the full review and says so', async () => {
  const { reviewed, result } = await run({ args: { focus: 'deep' } });
  assert.equal(reviewed.length, 6);
  assert.match(why(result), /unknown focus "deep"/);
});
await test('missing domain flags fail toward coverage: backend and frontend both run', async () => {
  const { reviewed, result } = await run({ args: { domains: undefined } });
  assert.ok(reviewed.includes('backend') && reviewed.includes('frontend'));
  assert.match(why(result), /domain flags not passed/);
});
await test('reviewer prompts carry the target, the changed files and the project context', async () => {
  const { calls } = await run({ args: { projectContext: 'CONVENTION-XYZ' } });
  for (const c of calls) {
    assert.match(c.prompt, /Target: PR #4242/);
    assert.match(c.prompt, /api\/db\.py/);
    assert.match(c.prompt, /CONVENTION-XYZ/);
    assert.match(c.prompt, /untrusted input/);
  }
});
await test('modelOverride reaches every agent call', async () => {
  const { calls } = await run({ args: { modelOverride: 'sonnet' }, review: { security: WITH(F()) }, refute: [UP, UP, UP] });
  assert.ok(calls.length > 6 && calls.every((c) => c.opts.model === 'sonnet'));
});

// 2. effort gate
await test('clean review approves with no refuters', async () => {
  const { result, refuters } = await run();
  assert.equal(refuters.length, 0);
  assert.equal(result.verdict, 'approve');
  assert.equal(result.postRefutationVerdict, 'approve');
});
for (const effort of ['low', 'medium']) {
  await test(`${effort} effort spawns no refuter, a critical is request-changes`, async () => {
    const { result, refuters } = await run({ args: { effort }, review: { security: WITH(F()) } });
    assert.equal(refuters.length, 0);
    assert.equal(result.verdict, 'request-changes');
    assert.equal(result.postRefutationVerdict, 'request-changes');
    assert.equal(find(result, 'api/db.py:40:security').refutation.outcome, 'skipped-effort');
  });
}
await test('high: one advisory refuter, a kill never demotes, the user sees it', async () => {
  const { result, refuters } = await run({ args: { effort: 'high' }, review: { security: WITH(F()) }, refute: [KILL()] });
  assert.equal(refuters.length, 1);
  assert.equal(result.verdict, 'request-changes');
  assert.equal(result.postRefutationVerdict, 'request-changes');
  assert.equal(result.confirmationNeeded.length, 0);
  assert.deepEqual(result.advisory.map((a) => a.outcome), ['advisory-refuted']);
});
await test('"max" means xhigh: a blocker gets 3 refuters', async () => {
  const { result, refuters } = await run({ args: { effort: 'max' }, review: { security: WITH(F()) }, refute: [UP, UP, UP] });
  assert.equal(result.effort, 'xhigh');
  assert.equal(refuters.length, 3);
});
await test('xhigh: a HIGH non-blocker gets 2, a medium gets none', async () => {
  const { refuters } = await run({ review: { readability: WITH(F({ id: 'MAINT-1', severity: 'high', category: 'maintainability', conventional_comment: 'suggestion' }), F({ id: 'MAINT-2', severity: 'medium', category: 'maintainability', line: 50, conventional_comment: 'issue' })) }, refute: [UP, UP] });
  assert.equal(refuters.length, 2);
});
await test('xhigh: a HIGH issue is a request-changes blocker and gets 3', async () => {
  const { refuters, result } = await run({ review: { backend: WITH(F({ severity: 'high', category: 'correctness' })) }, refute: [UP, UP, UP] });
  assert.equal(refuters.length, 3);
  assert.equal(result.verdict, 'request-changes');
});
await test('xhigh: 2 of 3 kills with citations drop the blocker only in the post-refutation view', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [KILL(), KILL(), UP] });
  assert.equal(result.verdict, 'request-changes');
  assert.equal(result.postRefutationVerdict, 'approve');
  assert.equal(result.confirmationNeeded.length, 1);
  assert.equal(result.confirmationNeeded[0].outcome, 'killed');
  assert.deepEqual(result.confirmationNeeded[0].citations, ['api/db.py:40', 'api/db.py:40']);
  assert.match(why(result), /confirm: 1 refuted blocker/);
});
await test('1 kill of 3 survives with low confidence', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [KILL(), UP, UP] });
  const f = find(result, 'api/db.py:40:security');
  assert.equal(f.refutation.outcome, 'survived');
  assert.equal(f.refutation.confidence, 'low');
  assert.equal(result.postRefutationVerdict, 'request-changes');
});
await test('a kill without a command, or with no citation, is upheld', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [{ exists: false, citation: 'api/db.py:40', reason: 'fine' }, { exists: false, command: 'cat api/db.py', reason: 'fine' }, KILL()] });
  assert.equal(find(result, 'api/db.py:40:security').refutation.outcome, 'survived');
});
await test('a kill citing a file outside the diff and the trace is upheld', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [KILL('lib/other.py:3'), KILL('lib/other.py:9'), UP] });
  assert.equal(find(result, 'api/db.py:40:security').refutation.outcome, 'survived');
});
await test('dead and throwing refuters count as upheld: 1 kill and 2 dead is not a majority', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [null, new Error('boom'), KILL()] });
  assert.equal(find(result, 'api/db.py:40:security').refutation.outcome, 'survived');
  assert.equal(result.postRefutationVerdict, 'request-changes');
});
await test('downgrade majority revises to the near band edge, not the lowest vote', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [DOWN('high'), DOWN('low'), UP] });
  const f = find(result, 'api/db.py:40:security');
  assert.equal(f.refutation.outcome, 'downgraded');
  assert.equal(f.postSeverity, 'high');
  assert.equal(result.postRefutationVerdict, 'request-changes', 'high + issue is still a blocker');
});
await test('a downgrade to medium removes the blocker and asks for confirmation', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [DOWN('medium'), DOWN('medium'), UP] });
  assert.equal(result.postRefutationVerdict, 'comment');
  assert.equal(result.confirmationNeeded[0].downgradeTo, 'medium');
});
await test('a HIGH non-blocker needs both of its 2 votes to be killed', async () => {
  const hi = F({ severity: 'high', conventional_comment: 'suggestion' });
  const one = await run({ review: { security: WITH(hi) }, refute: [KILL(), UP] });
  assert.equal(find(one.result, 'api/db.py:40:security').refutation.outcome, 'survived');
  const two = await run({ review: { security: WITH(hi) }, refute: [KILL(), KILL()] });
  assert.equal(find(two.result, 'api/db.py:40:security').refutation.outcome, 'killed');
});

// 3. blindness and exemptions
await test('the refuter prompt is blind: category and location, no title, prose, severity label or producer', async () => {
  const { refuters } = await run({ review: { security: WITH(F()) }, refute: [UP, UP, UP] });
  for (const r of refuters) {
    assert.match(r.prompt, /a security defect at api\/db\.py:40/);
    for (const leak of ['SQL built by string concat', 'unescaped', 'bound parameter', 'SEC-001', 'security-auditor', 'reviewer']) assert.ok(!r.prompt.includes(leak), `leaked "${leak}"`);
    assert.ok(!/\bcritical\b(?! = )/.test(r.prompt), 'leaked the producer severity label');
    assert.equal(r.opts.agentType, 'ork:security-auditor', 'refuter runs as the producer type');
  }
});
await test('a cross-file finding carries its traced files and the UPHELD default', async () => {
  const { refuters } = await run({ review: { security: WITH(F({ traced_files: ['api/db.py', 'api/auth.py'] })) }, refute: [UP, UP, UP] });
  assert.match(refuters[0].prompt, /spans these files: api\/db\.py, api\/auth\.py/);
  assert.match(refuters[0].prompt, /cannot reproduce the flow.*exists=true/);
});
await test('ground truth is never refuted', async () => {
  const { result, refuters } = await run({ review: { tests: WITH(F({ category: 'testing', ground_truth: true })) } });
  assert.equal(refuters.length, 0);
  assert.equal(find(result, 'api/db.py:40:testing').refutation.outcome, 'exempt-ground-truth');
  assert.equal(result.postRefutationVerdict, 'request-changes');
});
await test('a failing required check is request-changes in both verdicts', async () => {
  const { result } = await run({ args: { failingChecks: ['ci / unit'] } });
  assert.equal(result.verdict, 'request-changes');
  assert.equal(result.postRefutationVerdict, 'request-changes');
  assert.match(why(result), /failing required check\(s\): ci \/ unit/);
});
await test('a finding with no file is not refuted and goes to manual review', async () => {
  const { result, refuters } = await run({ review: { security: WITH(F({ file: '' })) } });
  assert.equal(refuters.length, 0);
  assert.deepEqual(result.manualReview.map((m) => m.outcome), ['unrefuted-no-location']);
});

// 4. ceiling
await test('default ceiling is 24: ten blockers at xhigh refute eight, flag two', async () => {
  const many = Array.from({ length: 10 }, (_, i) => F({ id: `SEC-${i}`, line: 100 + i }));
  const { result, refuters } = await run({ review: { security: WITH(...many) }, refute: Array(30).fill(UP) });
  assert.equal(refuters.length, 24);
  assert.equal(result.refuterCeiling, 24);
  assert.equal(result.manualReview.length, 2);
  assert.ok(result.manualReview.every((m) => m.note === 'not independently refuted, manual review required'));
});
await test('high effort caps at 6 advisory refuters (review-pr binding)', async () => {
  const many = Array.from({ length: 8 }, (_, i) => F({ id: `SEC-${i}`, line: 200 + i }));
  const { result, refuters } = await run({ args: { effort: 'high', maxRefuters: 50 }, review: { security: WITH(...many) }, refute: Array(8).fill(UP) });
  assert.equal(result.refuterCeiling, 6);
  assert.equal(refuters.length, 6);
  assert.equal(result.manualReview.length, 2);
});
await test('maxRefuters can lower the ceiling but never raise it', async () => {
  const big = await run({ args: { maxRefuters: 999 }, review: { security: WITH(F()) }, refute: [UP, UP, UP] });
  assert.equal(big.result.refuterCeiling, 24);
  const zero = await run({ args: { maxRefuters: -5 }, review: { security: WITH(F()) } });
  assert.equal(zero.result.refuterCeiling, 0);
  assert.equal(zero.refuters.length, 0);
  assert.equal(zero.result.manualReview.length, 1);
});
await test('never a partial quorum: 4 slots and two blockers refute one fully, flag the other', async () => {
  const { result, refuters } = await run({ args: { maxRefuters: 4 }, review: { security: WITH(F(), F({ id: 'SEC-2', line: 90 })) }, refute: Array(6).fill(UP) });
  assert.equal(refuters.length, 3);
  assert.equal(result.manualReview.length, 1);
});
await test('inside a batch the blocker is refuted first even when listed last', async () => {
  const hi = F({ id: 'SEC-H', severity: 'high', conventional_comment: 'suggestion', line: 10 });
  const { result } = await run({ args: { maxRefuters: 3 }, review: { security: WITH(hi, F()) }, refute: [UP, UP, UP] });
  assert.equal(find(result, 'api/db.py:40:security').refutation.outcome, 'survived');
  assert.equal(find(result, 'api/db.py:10:security').refutation.outcome, 'unrefuted-ceiling');
});
await test('HIGH findings never take the last blocker quorum', async () => {
  const hi = F({ id: 'SEC-H', severity: 'high', conventional_comment: 'suggestion', line: 10 });
  const { result, refuters } = await run({ args: { maxRefuters: 4 }, review: { security: WITH(hi) } });
  assert.equal(refuters.length, 0, '4 minus a 3-vote reserve leaves 1, a HIGH needs 2');
  assert.equal(find(result, 'api/db.py:10:security').refutation.outcome, 'unrefuted-ceiling');
});

// 5. dedup and re-tier
await test('the same file, line and category from two reviewers is one finding, one refutation', async () => {
  const { result, refuters } = await run({ review: { security: WITH(F()), readability: WITH(F({ id: 'MAINT-9', severity: 'medium', conventional_comment: 'suggestion' })) }, refute: [UP, UP, UP] });
  assert.equal(result.findings.length, 1);
  assert.equal(refuters.length, 3);
  assert.deepEqual([...find(result, 'api/db.py:40:security').raisedBy].sort(), ['readability', 'security']);
  assert.equal(find(result, 'api/db.py:40:security').severity, 'critical');
});
await test('a duplicate that raises the tier after refutation voids the kill (fail closed)', async () => {
  let release;
  const held = new Promise((r) => (release = r));
  const hi = F({ severity: 'high', conventional_comment: 'suggestion' });
  const agentRun = run({
    review: { readability: WITH(hi), security: WITH(F()) },
    gate: { security: () => held },
    refute: [KILL(), KILL()],
  });
  setTimeout(() => release(), 20);
  const { result } = await agentRun;
  const f = find(result, 'api/db.py:40:security');
  assert.equal(f.severity, 'critical');
  assert.equal(f.refutation.outcome, 'unrefuted-retiered');
  assert.equal(result.postRefutationVerdict, 'request-changes');
  assert.equal(result.confirmationNeeded.length, 0);
});

// 5b. late tier: a duplicate that raises an unrefuted entry's tier (SEC-003, wf_13264988-13c)
const LATER = { tests: () => new Promise((r) => setTimeout(r, 20)) };
const LOWQ = F({ id: 'SEC-003', severity: 'low', conventional_comment: 'question', file: 'api/auth.py', line: 5 });
const HIGHISSUE = F({ id: 'TEST-7', severity: 'high', conventional_comment: 'issue', file: 'api/auth.py', line: 5 });
const K5 = 'api/auth.py:5:security';
await test('late tier: a low finding raised to high/issue by a later duplicate is refuted', async () => {
  const { result, refuters } = await run({ review: { security: WITH(LOWQ), tests: WITH(HIGHISSUE) }, gate: LATER, refute: [UP, UP, UP] });
  const f = find(result, K5);
  assert.equal(f.severity, 'high');
  assert.equal(f.conventional_comment, 'issue');
  assert.equal(refuters.length, 3, 'blocker quorum at xhigh');
  assert.ok(refuters.every((r) => r.opts.label === `refute:${K5}`));
  assert.equal(f.refutation.outcome, 'survived');
  assert.equal(f.refutation.tier, 'blocker');
  assert.equal(result.manualReview.length, 0);
  assert.match(why(result), /rose to the blocker tier on a duplicate from tests/);
});
await test('late tier: with the budget exhausted the entry lands in manualReview as unrefuted-late-tier', async () => {
  const { result, refuters } = await run({ args: { maxRefuters: 3 }, review: { security: WITH(F(), LOWQ), tests: WITH(HIGHISSUE) }, gate: LATER, refute: [UP, UP, UP] });
  assert.equal(refuters.length, 3, 'only the first blocker is refuted');
  assert.deepEqual(result.manualReview, [{ key: K5, id: 'SEC-003', outcome: 'unrefuted-late-tier', note: 'not independently refuted, manual review required', reason: 'tier raised by a duplicate from tests' }]);
  assert.equal(result.postRefutationVerdict, 'request-changes');
});
await test('late tier: a HIGH raised late cannot take the reserved blocker slots', async () => {
  const { result, refuters } = await run({ args: { maxRefuters: 4 }, review: { security: WITH(LOWQ), tests: WITH({ ...HIGHISSUE, conventional_comment: 'suggestion' }) }, gate: LATER });
  assert.equal(refuters.length, 0, '4 minus the 3-vote reserve leaves 1, a HIGH needs 2');
  assert.equal(find(result, K5).refutation.outcome, 'unrefuted-late-tier');
});
await test('late tier: a key already refuted is not refuted again, and the retier rule voids its kill', async () => {
  const hi = F({ id: 'SEC-4', severity: 'high', conventional_comment: 'suggestion', file: 'api/auth.py', line: 5 });
  const { result, refuters } = await run({ review: { security: WITH(hi), tests: WITH({ ...HIGHISSUE, severity: 'critical' }) }, gate: LATER, refute: [KILL('api/auth.py:5'), KILL('api/auth.py:5'), UP] });
  assert.equal(refuters.length, 2, 'only the original HIGH quorum ran');
  assert.equal(find(result, K5).refutation.outcome, 'unrefuted-retiered');
  assert.equal(result.postRefutationVerdict, 'request-changes');
});
await test('late tier: an issue from any reviewer wins the comment type over a higher-severity question', async () => {
  const { result } = await run({ args: { effort: 'medium' }, review: { security: WITH({ ...LOWQ, severity: 'high' }), tests: WITH({ ...HIGHISSUE, severity: 'medium' }) }, gate: LATER });
  const f = find(result, K5);
  assert.equal(f.severity, 'high');
  assert.equal(f.conventional_comment, 'issue');
  assert.equal(result.verdict, 'request-changes', 'high + issue is a blocker');
});

// 6. reviewers that fail
await test('a dead reviewer keeps approve off the table', async () => {
  for (const dead of [null, new Error('crash'), { status: 'BLOCKED', verdict: 'approve', findings: [] }, { status: 'NEEDS_CONTEXT', verdict: 'approve', findings: [] }]) {
    const { result } = await run({ review: { tests: dead } });
    assert.equal(result.verdict, 'comment', JSON.stringify(dead && dead.status));
    assert.match(why(result), /tests not reviewed/);
  }
});
await test('a dead security reviewer is named as security not reviewed', async () => {
  const { result } = await run({ review: { security: null } });
  assert.equal(result.verdict, 'comment');
  assert.match(why(result), /security not reviewed/);
});
await test('a reviewer saying request-changes with no blocker finding floors at comment', async () => {
  const { result } = await run({ review: { backend: { status: 'DONE', verdict: 'request-changes', findings: [F({ severity: 'low', category: 'maintainability', conventional_comment: 'nitpick' })] } } });
  assert.equal(result.verdict, 'comment');
  assert.match(why(result), /backend said request-changes without a blocker-severity finding/);
});
await test('reviewers split between approve and request-changes set reviewerDisagreement', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [UP, UP, UP] });
  assert.equal(result.reviewerDisagreement, true);
  const calm = await run();
  assert.equal(calm.result.reviewerDisagreement, false);
});
await test('an unknown severity fails closed as critical, an unknown comment type as issue', async () => {
  const { result } = await run({ args: { effort: 'medium' }, review: { readability: WITH(F({ severity: 'blocker', conventional_comment: 'must-fix', category: 'maintainability' })) } });
  const f = result.findings[0];
  assert.equal(f.severity, 'critical');
  assert.equal(f.conventional_comment, 'issue');
  assert.equal(result.verdict, 'request-changes');
});
await test('praise and nitpicks alone still approve; a suggestion comments', async () => {
  const nits = await run({ review: { readability: { ...WITH(F({ severity: 'info', category: 'maintainability', conventional_comment: 'praise' }), F({ severity: 'low', line: 2, category: 'maintainability', conventional_comment: 'nitpick' })), verdict: 'approve' } } });
  assert.equal(nits.result.verdict, 'approve');
  const sug = await run({ review: { readability: { ...WITH(F({ severity: 'medium', category: 'maintainability', conventional_comment: 'suggestion' })), verdict: 'comment-only' } } });
  assert.equal(sug.result.verdict, 'comment');
});
await test('no changed files floors at comment', async () => {
  const { result } = await run({ args: { changedFiles: [] } });
  assert.equal(result.verdict, 'comment');
  assert.match(why(result), /no changed files/);
});
await test('the ledger follows engine section 10', async () => {
  const { result } = await run({ review: { security: WITH(F()) }, refute: [KILL(), KILL(), UP] });
  assert.deepEqual(result.ledger[0], { finding_id: 'SEC-001', key: 'api/db.py:40:security', refuters: 3, votes: { refuted: 2, upheld: 1, downgrade: 0 }, verified_citations: ['api/db.py:40', 'api/db.py:40'], outcome: 'killed', confidence: 'high', original_value: 'critical', revised_value: 'killed' });
});

// 7. streaming, not a barrier
await test('a finding reaches its refuters before a slower reviewer returns', async () => {
  let sawRefute;
  const refuteSeen = new Promise((r) => (sawRefute = r));
  const order = [];
  const agent = async (_p, o) => {
    const [kind, who] = String(o.label).split(':');
    if (kind === 'refute') {
      order.push('refute');
      sawRefute();
      return UP;
    }
    if (who === 'tests') {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('tests reviewer waited 500 ms and no refuter started: the script is a barrier')), 500));
      await Promise.race([refuteSeen, timeout]);
      order.push('tests-returned');
      return CLEAN;
    }
    return who === 'security' ? WITH(F()) : CLEAN;
  };
  const result = await body({ ...BASE }, agent, () => {}, () => {}, pipeline);
  assert.equal(order[0], 'refute');
  assert.ok(order.includes('tests-returned'));
  assert.equal(result.reviewers.find((r) => r.role === 'tests').outcome, 'REVIEWED');
});

// 8. args shape and determinism
await test('args, domains and changedFiles given as JSON or newline text are parsed', async () => {
  const labels = [];
  const agent = async (_p, o) => {
    labels.push(o.label);
    return CLEAN;
  };
  const result = await body(JSON.stringify({ ...BASE, domains: JSON.stringify({ backend: true, frontend: false }), changedFiles: 'api/db.py\napi/auth.py\n' }), agent, () => {}, () => {}, pipeline);
  assert.equal(labels.length, 5);
  assert.equal(result.verdict, 'approve');
  const arr = await body({ ...BASE, changedFiles: JSON.stringify(['api/db.py']) }, agent, () => {}, () => {}, pipeline);
  assert.equal(arr.verdict, 'approve');
  await assert.rejects(body({ ...BASE, changedFiles: '[not json' }, agent, () => {}, () => {}, pipeline), /changedFiles is not valid JSON/);
});
await test('malformed args text fails with a clear message', async () => {
  await assert.rejects(body('{not json', async () => CLEAN, () => {}, () => {}, pipeline), /review-fanout: args is not valid JSON/);
});
await test('the script uses no Date.now(), Math.random() or argless new Date()', async () => {
  const code = SOURCE.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /Date\.now\s*\(/);
  assert.doesNotMatch(code, /Math\.random\s*\(/);
  assert.doesNotMatch(code, /new\s+Date\s*\(\s*\)/);
});
await test('meta names the workflow and its three phases', async () => {
  assert.match(SOURCE, /name: "review-fanout"/);
  for (const p of ['Review', 'Refute', 'Gate']) assert.match(SOURCE, new RegExp(`title: "${p}"`));
});

// 9. planted control: the harness must be able to fail
await test('control: a stub that approves everything fails a core case of this harness', async () => {
  const stub = compile('return { status: "reviewed", verdict: "approve", postRefutationVerdict: "approve", confirmationNeeded: [], manualReview: [], advisory: [], reasons: [], reviewers: [], findings: [], ledger: [], refutersSpawned: 0, refuterCeiling: 24 };');
  const res = await stub({ ...BASE, failingChecks: ['ci / unit'] }, async () => CLEAN, () => {}, () => {}, pipeline);
  assert.throws(() => assert.equal(res.verdict, 'request-changes'), 'the stub must not pass the failing-check case');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

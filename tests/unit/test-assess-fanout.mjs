#!/usr/bin/env node
// ============================================================================
// assess-fanout: Phases 2 and 2.5 of /ork:assess, offline with a stubbed agent()
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/assess/workflows/assess-fanout.js must never let refutation alone
//   raise a score or flip a fail to a pass, never let a planted security defect
//   through, and never spawn more refuters than the ceiling. Every case below
//   scripts the agents' answers and asserts the result:
//
//   1. Selection (STEP 0 focus plus the effort subset): full, quality, security
//      and quick focus; low, medium, high and xhigh; comparison mode adds
//      simplicity; a frontend domain picks the frontend performance engineer.
//   2. Rating: an assessor scores only its own dimensions; invalid, dead and
//      BLOCKED answers count as not scored; missing file:line evidence is noted.
//   3. Gate: weighted composite over the scored dimensions, grade, rubric
//      min_pass and min_blocker, fail closed on an unscored blocker dimension.
//   4. Planted defect: a SQL injection returned by the security assessor fails
//      the verdict with a security blocker and a priority concern, and a
//      refuter quorum that would lift it cannot clear chainVerdict.
//   5. Refutation: none at low/medium, one ADVISORY vote at high that never
//      moves a score, a 3-vote majority at xhigh revised to the near band edge;
//      a vote needs an in-scope file:line citation and a command; a dead or
//      throwing refuter is upheld; a minority dissent is a caveat.
//   6. Blindness: the refuter prompt never carries the producer's score,
//      evidence or reasoning; the refuter runs as the producer's agent type.
//   7. Ceiling: 4 at high, 24 at xhigh, lowerable never raisable, overflow is
//      flagged for manual review.
//   8. Determinism: no Date.now(), Math.random() or argless new Date().
//   9. Control: a stub that passes everything fails this harness.
//
// HOW
//
//   Same harness as test-review-fanout.mjs: the script runs as an async
//   function body with args, agent, phase, log and pipeline injected.
//   ASSESS_FANOUT_SCRIPT=<path> runs the whole suite against another script.
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAL = path.join(REPO, 'src', 'skills', 'assess', 'workflows', 'assess-fanout.js');
const SCRIPT = process.env.ASSESS_FANOUT_SCRIPT ? path.resolve(process.env.ASSESS_FANOUT_SCRIPT) : REAL;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const compile = (src) => new AsyncFunction('args', 'agent', 'phase', 'log', 'pipeline', src.replace(/^export const meta/m, 'const meta'));
const SOURCE = readFileSync(SCRIPT, 'utf8');
const body = compile(SOURCE);
const pipeline = async () => {
  throw new Error('assess-fanout does not use pipeline');
};

const FILES = ['api/auth.py', 'api/db.py', 'api/models.py'];
const DIM = (dimension, score, over = {}) => ({ dimension, score, evidence: [`api/db.py:${Math.round(score * 10)}`], reasoning: `${dimension} reasoning text`, pros: [], cons: [], improvements: [], ...over });
const GROUP_DIMS = { security: ['security'], quality: ['correctness', 'maintainability', 'compliance'], performance: ['performance', 'scalability'], testability: ['testability'] };
// A healthy default: every dimension 6.5 (mid band, 1.0 above min_pass 5.5).
const OK = (group, score = 6.5) => ({ status: 'DONE', summary: 'ok', dimensions: GROUP_DIMS[group].map((d) => DIM(d, score)) });
const BAND = (lo, hi, cit = 'api/db.py:12') => ({ score: (lo + hi) / 2, band_low: lo, band_high: hi, citation: cit, command: `sed -n 10,14p ${cit.split(':')[0]}`, reason: 'read the code' });
const NOOP = { score: 5, band_low: 0, band_high: 10, citation: 'api/db.py:1', command: 'cat api/db.py', reason: 'no opinion' };
const RUBRIC = JSON.parse(readFileSync(path.join(REPO, 'src', 'skills', 'assess', 'rubric.json'), 'utf8'));
const BASE = { target: 'api/', effort: 'xhigh', focus: 'full', scopeFiles: FILES, rubric: RUBRIC };

// The planted defect: the code under assessment concatenates user input into SQL,
// and the security assessor reports it.
const PLANTED = {
  status: 'DONE_WITH_CONCERNS',
  summary: 'SQL injection in the login query',
  dimensions: [DIM('security', 2.0, { evidence: ['api/auth.py:42'], reasoning: 'f"SELECT * FROM users WHERE name = \'{username}\'" builds the query from request input' })],
};

async function run({ args = {}, rate = {}, refute = {}, overrideGroupAnswer } = {}) {
  const calls = [];
  const queues = Object.fromEntries(Object.entries(refute).map(([k, v]) => [k, [...v]]));
  const agent = async (prompt, opts) => {
    const [kind, who] = String(opts.label).split(':');
    calls.push({ kind, who, opts, prompt });
    if (kind === 'rate') {
      if (overrideGroupAnswer) return overrideGroupAnswer(who);
      const r = who in rate ? rate[who] : OK(who);
      if (r instanceof Error) throw r;
      return r;
    }
    if (kind === 'refute') {
      const q = queues[who];
      const r = q && q.length ? q.shift() : NOOP;
      if (r instanceof Error) throw r;
      return r;
    }
    throw new Error(`unexpected label ${opts.label}`);
  };
  const logs = [];
  const result = await body({ ...BASE, ...args }, agent, () => {}, (m) => logs.push(String(m)), pipeline);
  const of = (k) => calls.filter((c) => c.kind === k);
  return { result, calls, logs, rated: of('rate').map((c) => c.who).sort(), refuters: of('refute') };
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
const dim = (r, name) => r.dimensions.find((d) => d.dimension === name);

console.log('assess-fanout');

// 4 first: the planted defect is the case this lane exists for.
await test('planted defect: a SQL injection from the security assessor fails the verdict with a security blocker', async () => {
  // Every other dimension is strong, so only the defect can fail this.
  const { result } = await run({ args: { effort: 'medium' }, rate: { security: PLANTED, quality: OK('quality', 8.6), testability: OK('testability', 8.6) } });
  assert.equal(dim(result, 'security').score, 2);
  assert.ok(result.composite >= RUBRIC.composite.min_pass, `composite ${result.composite} clears min_pass, so the blocker alone must fail it`);
  assert.equal(result.verdict, 'fail');
  assert.deepEqual(result.blockers.map((b) => b.dimension), ['security']);
  assert.match(result.blockers[0].reason, /api\/auth\.py:42/);
  assert.equal(result.chainVerdict.verdict, 'fail');
  assert.equal(result.chainVerdict.blockers[0].dimension, 'security');
  assert.deepEqual(result.priorityConcerns.map((p) => p.dimension), ['security']);
});
await test('planted defect: a backed refuter quorum that would lift it cannot clear chainVerdict without the user', async () => {
  const lift = BAND(8, 10, 'api/auth.py:42');
  const { result } = await run({ rate: { security: PLANTED, quality: OK('quality', 8.6), performance: OK('performance', 8.6), testability: OK('testability', 8.6) }, refute: { security: [lift, lift, lift] } });
  assert.equal(dim(result, 'security').refutation.outcome, 'upgraded');
  assert.equal(result.postRefutation.verdict, 'pass', 'the post-refutation basis alone would pass');
  assert.equal(result.verdict, 'fail');
  assert.equal(result.chainVerdict.verdict, 'fail', 'chainVerdict keeps the defect until the user confirms');
  assert.equal(result.chainVerdict.dimension_scores.security, 2);
  assert.deepEqual(result.confirmationNeeded.map((c) => c.dimension), ['security']);
  assert.match(why(result), /from fail to pass/);
});
await test('planted defect: unbacked refuter votes leave it in place', async () => {
  const bare = { score: 9, band_low: 8, band_high: 10, reason: 'looks parameterized to me' };
  const { result } = await run({ rate: { security: PLANTED }, refute: { security: [bare, bare, bare] } });
  assert.equal(dim(result, 'security').refutation.outcome, 'survived');
  assert.equal(dim(result, 'security').postScore, 2);
  assert.equal(result.postRefutation.verdict, 'fail');
});

// 1. selection
await test('full focus at high: security, quality, performance, testability, security dispatched first', async () => {
  const { rated, calls } = await run({ args: { effort: 'high' } });
  assert.deepEqual(rated, ['performance', 'quality', 'security', 'testability']);
  assert.equal(calls[0].who, 'security');
  assert.equal(calls.find((c) => c.who === 'security').opts.agentType, 'ork:security-auditor');
  assert.equal(calls.find((c) => c.who === 'quality').opts.agentType, 'ork:code-quality-reviewer');
  assert.equal(calls.find((c) => c.who === 'performance').opts.agentType, 'ork:python-performance-engineer');
  assert.equal(calls.find((c) => c.who === 'testability').opts.agentType, 'ork:test-generator');
});
await test('effort low scores security and quality; medium adds testability', async () => {
  assert.deepEqual((await run({ args: { effort: 'low' } })).rated, ['quality', 'security']);
  assert.deepEqual((await run({ args: { effort: 'medium' } })).rated, ['quality', 'security', 'testability']);
});
await test('focus quality skips security and performance; security focus runs security and quality; quick runs one', async () => {
  assert.deepEqual((await run({ args: { focus: 'quality' } })).rated, ['quality', 'testability']);
  assert.deepEqual((await run({ args: { focus: 'security' } })).rated, ['quality', 'security']);
  assert.deepEqual((await run({ args: { focus: 'quick' } })).rated, ['quality']);
});
await test('an unknown focus runs the full assessment and says so', async () => {
  const { rated, result } = await run({ args: { focus: 'vibes', effort: 'high' } });
  assert.equal(rated.length, 4);
  assert.match(why(result), /unknown focus "vibes"/);
});
await test('a frontend domain uses the frontend performance engineer', async () => {
  const { calls } = await run({ args: { domain: 'frontend' } });
  assert.equal(calls.find((c) => c.who === 'performance').opts.agentType, 'ork:frontend-performance-engineer');
});
await test('comparison mode asks the quality assessor for simplicity and uses the comparison weights', async () => {
  const quality = { status: 'DONE', dimensions: ['correctness', 'maintainability', 'compliance', 'simplicity'].map((d) => DIM(d, 6.5)) };
  const { result, calls } = await run({ args: { mode: 'comparison' }, rate: { quality } });
  assert.match(calls.find((c) => c.who === 'quality').prompt, /SIMPLICITY/);
  assert.equal(dim(result, 'simplicity').weight, 0.1);
  assert.equal(result.weights.security, 0.18, 'comparison mode never takes rubric.json default weights');
});
await test('the rate prompt carries the scope, the context and the untrusted-input rule', async () => {
  const { calls } = await run({ args: { projectContext: 'ADR-7: all SQL goes through the repository layer' } });
  const p = calls.find((c) => c.who === 'security').prompt;
  for (const f of FILES) assert.ok(p.includes(f));
  assert.match(p, /ADR-7/);
  assert.match(p, /untrusted input/);
  assert.match(p, /confidence/, 'xhigh asks for confidence and caveats');
});

// 2. rating
await test('an assessor cannot score a dimension outside its group', async () => {
  const quality = { status: 'DONE', dimensions: [DIM('correctness', 6.5), DIM('maintainability', 6.5), DIM('compliance', 6.5), DIM('security', 10)] };
  const { result } = await run({ args: { effort: 'low' }, rate: { quality, security: OK('security', 6.5) } });
  assert.equal(dim(result, 'security').score, 6.5);
  assert.equal(dim(result, 'security').group, 'security');
});
await test('an out-of-range or non-numeric score counts as not scored', async () => {
  const testability = { status: 'DONE', dimensions: [DIM('testability', 11)] };
  const { result } = await run({ rate: { testability } });
  assert.equal(dim(result, 'testability'), undefined);
  assert.deepEqual(result.unscored, ['testability']);
  assert.match(why(result), /invalid score for testability/);
});
await test('a dead, throwing or BLOCKED assessor is NOT-ASSESSED', async () => {
  const { result } = await run({ rate: { performance: null, testability: new Error('boom'), quality: { status: 'BLOCKED', dimensions: [] } } });
  const out = Object.fromEntries(result.assessors.map((a) => [a.group, a.outcome]));
  assert.deepEqual(out, { security: 'ASSESSED', quality: 'NOT-ASSESSED', performance: 'NOT-ASSESSED', testability: 'NOT-ASSESSED' });
  assert.deepEqual(result.unscored.sort(), ['compliance', 'correctness', 'maintainability', 'performance', 'scalability', 'testability']);
});
await test('a score with no file:line evidence is noted', async () => {
  const testability = { status: 'DONE', dimensions: [DIM('testability', 6.5, { evidence: ['looks fine'] })] };
  const { result } = await run({ rate: { testability } });
  assert.equal(dim(result, 'testability').evidenceMissing, true);
  assert.match(why(result), /testability scored 6.5 with no file:line evidence/);
});

// 2b. live run wf_7b023867-8f9 (render-spec.mjs, high): the shapes real assessors returned
const INVENTED = ['Core logic purity & determinism (validate/renderElement)', 'Dependency injection & seams (I/O boundary)'];
await test('off-schema dimension names: the assigned dimension is recorded unscored with a visible reason, never silently dropped', async () => {
  const testability = { status: 'DONE', dimensions: [DIM(INVENTED[0], 9), DIM(INVENTED[1], 3)] };
  const { result } = await run({ rate: { testability } });
  assert.deepEqual(result.unscored, ['testability']);
  assert.deepEqual(result.rejectedDimensions, [{ group: 'testability', names: INVENTED }]);
  assert.match(why(result), /testability returned off-schema dimension name\(s\) "Core logic purity[^\n]*; testability not scored, weight 0\.13 left out of the composite/);
});
await test('the rate schema makes dimension an enum of exactly the group dimensions, one entry each', async () => {
  const { calls } = await run();
  const items = (who) => calls.find((c) => c.who === who).opts.schema.properties.dimensions;
  assert.deepEqual(items('testability').items.properties.dimension.enum, ['testability']);
  assert.deepEqual(items('quality').items.properties.dimension.enum, ['correctness', 'maintainability', 'compliance']);
  assert.equal(items('quality').minItems, 3);
  assert.equal(items('quality').maxItems, 3);
  assert.match(calls.find((c) => c.who === 'testability').prompt, /exactly one of: testability/);
});
await test('an UPPERCASE dimension whose evidence is path:line then prose is not flagged as missing evidence', async () => {
  const quality = { status: 'DONE', dimensions: ['CORRECTNESS', 'MAINTAINABILITY', 'COMPLIANCE'].map((d) => DIM(d, 6.5, { evidence: ['api/db.py:36-37: the null check pushes an error but does not return', 'api/auth.py:47 CATALOG lookup resolves "constructor"'] })) };
  const { result } = await run({ rate: { quality } });
  assert.equal(dim(result, 'correctness').score, 6.5);
  assert.equal(dim(result, 'correctness').evidenceMissing, false);
  assert.doesNotMatch(why(result), /no file:line evidence/);
});
await test('an OWASP tag such as A06:2025 is not file:line evidence', async () => {
  const testability = { status: 'DONE', dimensions: [DIM('testability', 6.5, { evidence: ['cycle overflows the stack. A10:2025 / A06:2025'] })] };
  const { result } = await run({ rate: { testability } });
  assert.equal(dim(result, 'testability').evidenceMissing, true);
});
await test('a refuter citation with an absolute path or bare basename and trailing prose is backed', async () => {
  const abs = BAND(2, 4, '/Users/me/repo/api/db.py:40 (validate() at :52-56 never checks cycles)');
  const base = BAND(2, 5, 'db.py:41 the same defect');
  const { result } = await run({ refute: { security: [abs, base, NOOP] } });
  assert.equal(dim(result, 'security').refutation.outcome, 'downgraded');
  assert.equal(dim(result, 'security').postScore, 5);
});

// 3. gate
await test('the composite is the weighted average over the scored dimensions and maps to a grade', async () => {
  const { result } = await run({ args: { effort: 'low' }, rate: { security: OK('security', 9), quality: OK('quality', 6) } });
  // (0.20*9 + 0.45*6) / 0.65 = 6.923
  assert.equal(result.composite, 6.92);
  assert.equal(result.grade, 'C');
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(result.blockers, []);
});
await test('a composite below min_pass fails with no blocker', async () => {
  const { result } = await run({ rate: { security: OK('security', 5), quality: OK('quality', 5), performance: OK('performance', 5), testability: OK('testability', 5) } });
  assert.equal(result.composite, 5);
  assert.equal(result.verdict, 'fail');
  assert.deepEqual(result.blockers, []);
  assert.match(why(result), /below min_pass 5.5/);
});
await test('rubric.json thresholds are honoured: a raised min_pass fails the same scores', async () => {
  const rubric = { ...RUBRIC, composite: { min_pass: 7 } };
  const { result } = await run({ args: { rubric: JSON.stringify(rubric) } });
  assert.equal(result.composite, 6.5);
  assert.equal(result.verdict, 'fail');
});
const withRubric = (edit) => {
  const r = JSON.parse(JSON.stringify(RUBRIC));
  edit(r);
  return r;
};
await test('a null rubric min_blocker is absent, not 0: the planted defect still fails on the default floor', async () => {
  const rubric = withRubric((r) => (r.dimensions.find((d) => d.name === 'security').min_blocker = null));
  const { result } = await run({ args: { effort: 'medium', rubric }, rate: { security: PLANTED, quality: OK('quality', 8.6), testability: OK('testability', 8.6) } });
  assert.equal(result.verdict, 'fail');
  assert.deepEqual(result.blockers.map((b) => b.dimension), ['security']);
});
await test('a null rubric weight or min_pass keeps the default, never 0', async () => {
  const rubric = withRubric((r) => {
    r.dimensions.find((d) => d.name === 'security').weight = null;
    r.composite.min_pass = null;
  });
  const { result } = await run({ args: { rubric }, rate: { security: OK('security', 5), quality: OK('quality', 5), performance: OK('performance', 5), testability: OK('testability', 5) } });
  assert.equal(dim(result, 'security').weight, 0.2);
  assert.equal(result.verdict, 'fail', 'composite 5 is below the default min_pass 5.5');
});
await test('a non-numeric rubric value is ignored with a visible reason', async () => {
  const rubric = withRubric((r) => (r.dimensions.find((d) => d.name === 'security').min_blocker = '4'));
  const { result } = await run({ args: { rubric } });
  assert.match(why(result), /rubric security\.min_blocker "4" is not a finite number, ignored/);
});
await test('security selected but not scored is a blocker (fail closed)', async () => {
  const { result } = await run({ rate: { security: null } });
  assert.equal(result.verdict, 'fail');
  assert.equal(result.blockers[0].dimension, 'security');
  assert.equal(result.blockers[0].score, null);
});
await test('security out of focus is not a blocker, it is listed as unassessed', async () => {
  const { result } = await run({ args: { focus: 'quality' } });
  assert.equal(result.verdict, 'pass');
  assert.ok(result.unassessed.includes('security'));
  assert.match(why(result), /not assessed at focus=quality/);
});
await test('no dimension scored fails', async () => {
  const { result } = await run({ overrideGroupAnswer: () => null });
  assert.equal(result.composite, null);
  assert.equal(result.verdict, 'fail');
});
await test('quick wins are collected per dimension', async () => {
  const testability = { status: 'DONE', dimensions: [DIM('testability', 6.5, { improvements: [{ title: 'add a fixture', effort: 1, impact: 4 }, { title: 'rewrite suite', effort: 5, impact: 5 }] })] };
  const { result } = await run({ args: { effort: 'medium' }, rate: { testability } });
  assert.deepEqual(result.quickWins, [{ dimension: 'testability', title: 'add a fixture', effort: 1, impact: 4 }]);
});

// 5. refutation
await test('low and medium effort spawn no refuters', async () => {
  for (const effort of ['low', 'medium']) {
    const { refuters, result } = await run({ args: { effort }, rate: { security: PLANTED } });
    assert.equal(refuters.length, 0);
    assert.equal(dim(result, 'security').refutation.outcome, 'skipped-effort');
  }
});
await test('only decision-bearing scores are refuted: a mid-band low-weight score is not', async () => {
  const performance = { status: 'DONE', dimensions: [DIM('performance', 6.5), DIM('scalability', 6.2)] };
  const testability = { status: 'DONE', dimensions: [DIM('testability', 8.1)] };
  const { refuters } = await run({ rate: { performance, testability } });
  const who = new Set(refuters.map((r) => r.who));
  assert.ok(!who.has('scalability'), 'scalability 6.2 at weight 0.10 is not decision-bearing');
  assert.ok(!who.has('performance'), 'performance 6.5 at weight 0.12 is not decision-bearing');
  assert.ok(who.has('testability'), 'testability 8.1 is praise-inflation territory');
  for (const d of ['security', 'correctness', 'maintainability', 'compliance']) assert.ok(who.has(d), `${d} is high-weight`);
});
await test('a low-weight score within 0.5 of min_pass is refuted', async () => {
  const performance = { status: 'DONE', dimensions: [DIM('performance', 7.4), DIM('scalability', 5.8)] };
  const { refuters } = await run({ rate: { performance } });
  assert.ok(refuters.some((r) => r.who === 'scalability'));
  assert.ok(!refuters.some((r) => r.who === 'performance'), 'performance 7.4 is mid band on a 0.12 weight');
});
await test('high effort: one ADVISORY vote per score that never moves it, ceiling 4', async () => {
  const drop = BAND(3, 5, 'api/db.py:40');
  const { result, refuters } = await run({ args: { effort: 'high' }, refute: { security: [drop] } });
  assert.equal(refuters.length, 4);
  assert.equal(dim(result, 'security').refutation.outcome, 'advisory-down');
  assert.equal(dim(result, 'security').postScore, 6.5);
  assert.deepEqual(result.revisions, []);
  assert.equal(result.advisory[0].refuterEdge, 5);
  assert.deepEqual(result.manualReview, [], 'the four high-weight scores fit the ceiling of 4');
});
await test('xhigh: a 2-of-3 backed majority lowers the score to the near band edge', async () => {
  const { result } = await run({ refute: { security: [BAND(3, 5), BAND(4, 5.5), NOOP] } });
  const s = dim(result, 'security');
  assert.equal(s.refutation.outcome, 'downgraded');
  assert.equal(s.postScore, 5.5, 'near edge is the band_high closest to the producer score');
  assert.equal(result.chainVerdict.dimension_scores.security, 5.5, 'a lowering revision applies without the user');
  assert.deepEqual(result.revisions.map((r) => [r.dimension, r.original, r.revised]), [['security', 6.5, 5.5]]);
  assert.equal(result.confirmationNeeded.length, 0);
});
await test('xhigh: a 1-of-3 dissent never revises, it becomes a caveat and low confidence', async () => {
  const { result } = await run({ refute: { security: [BAND(2, 4), NOOP, NOOP] } });
  const s = dim(result, 'security');
  assert.equal(s.refutation.outcome, 'survived');
  assert.equal(s.postScore, 6.5);
  assert.equal(s.confidence, 'low');
  assert.match(s.caveats.join(' '), /1 of 3 refuters/);
  assert.equal(result.ledger.find((l) => l.finding_id === 'dim:security').confidence, 'low');
});
await test('a vote needs an in-scope file:line citation and a command, and a sane band', async () => {
  const outOfScope = BAND(1, 2, 'other/file.py:3');
  const noCommand = { ...BAND(1, 2), command: '' };
  const noLine = { ...BAND(1, 2), citation: 'api/db.py' };
  const inverted = BAND(5, 1);
  for (const bad of [outOfScope, noCommand, noLine, inverted]) {
    const { result } = await run({ refute: { security: [bad, bad, bad] } });
    assert.equal(dim(result, 'security').refutation.outcome, 'survived', JSON.stringify(bad));
    assert.equal(dim(result, 'security').refutation.votes.upheld, 3);
  }
});
await test('dead and throwing refuters are upheld: a 2-of-3 needs two live backed votes', async () => {
  const { result } = await run({ refute: { security: [BAND(2, 4), null, new Error('crash')] } });
  assert.equal(dim(result, 'security').refutation.outcome, 'survived');
});
await test('no scoped file list: every vote is upheld and the reason says why', async () => {
  const { result } = await run({ args: { scopeFiles: [] }, refute: { security: [BAND(2, 4), BAND(2, 4), BAND(2, 4)] } });
  assert.equal(dim(result, 'security').refutation.outcome, 'survived');
  assert.match(why(result), /no scoped file list/);
});

// 6. blindness
await test('the refuter prompt carries no producer score, evidence or reasoning; it runs as the producer type', async () => {
  const security = { status: 'DONE', dimensions: [DIM('security', 7.3, { evidence: ['api/auth.py:77'], reasoning: 'UNIQUE-PRODUCER-PROSE' })] };
  const { refuters } = await run({ rate: { security } });
  const r = refuters.find((c) => c.who === 'security');
  assert.equal(r.opts.agentType, 'ork:security-auditor');
  assert.doesNotMatch(r.prompt, /7\.3/);
  assert.doesNotMatch(r.prompt, /api\/auth\.py:77/);
  assert.doesNotMatch(r.prompt, /UNIQUE-PRODUCER-PROSE/);
  assert.doesNotMatch(r.prompt, /security-auditor|code-quality-reviewer/);
  assert.match(r.prompt, /SECURITY/);
});

// 7. ceiling
await test('xhigh ceiling is 24, a caller can lower it and the overflow is flagged for manual review', async () => {
  const { result, refuters } = await run({ args: { maxRefuters: 3 } });
  assert.equal(refuters.length, 3);
  assert.ok(refuters.every((r) => r.who === 'security'), 'the highest weight is refuted first');
  assert.equal(result.refuterCeiling, 3);
  assert.deepEqual(result.manualReview.map((m) => m.dimension).sort(), ['compliance', 'correctness', 'maintainability']);
  assert.match(why(result), /not independently refuted/);
});
await test('a caller cannot raise the ceiling', async () => {
  assert.equal((await run({ args: { maxRefuters: 100 } })).result.refuterCeiling, 24);
  assert.equal((await run({ args: { effort: 'high', maxRefuters: 100 } })).result.refuterCeiling, 4);
});

// ledger and args
await test('the ledger follows engine section 10', async () => {
  const { result } = await run({ refute: { security: [BAND(3, 5), BAND(4, 5.5), NOOP] } });
  assert.deepEqual(result.ledger.find((l) => l.finding_id === 'dim:security'), { finding_id: 'dim:security', refuters: 3, votes: { refuted: 0, upheld: 1, downgrade: 2 }, verified_citations: ['api/db.py:12', 'api/db.py:12'], outcome: 'downgraded', confidence: 'high', original_value: 6.5, revised_value: 5.5 });
});
await test('args, rubric and scopeFiles given as JSON or newline text are parsed', async () => {
  const agent = async (_p, o) => (String(o.label).startsWith('rate:') ? OK(String(o.label).split(':')[1]) : NOOP);
  const res = await body(JSON.stringify({ ...BASE, effort: 'low', rubric: JSON.stringify(RUBRIC), scopeFiles: 'api/auth.py\napi/db.py\n' }), agent, () => {}, () => {}, pipeline);
  assert.equal(res.verdict, 'pass');
  const arr = await body({ ...BASE, effort: 'low', scopeFiles: JSON.stringify(['api/db.py']) }, agent, () => {}, () => {}, pipeline);
  assert.equal(arr.verdict, 'pass');
  await assert.rejects(body({ ...BASE, scopeFiles: '[not json' }, agent, () => {}, () => {}, pipeline), /scopeFiles is not valid JSON/);
  await assert.rejects(body('{not json', agent, () => {}, () => {}, pipeline), /assess-fanout: args is not valid JSON/);
});
await test('the script uses no Date.now(), Math.random() or argless new Date()', async () => {
  const code = SOURCE.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /Date\.now\s*\(/);
  assert.doesNotMatch(code, /Math\.random\s*\(/);
  assert.doesNotMatch(code, /new\s+Date\s*\(\s*\)/);
});
await test('meta names the workflow and its three phases', async () => {
  assert.match(SOURCE, /name: "assess-fanout"/);
  for (const p of ['Rate', 'Refute', 'Gate']) assert.match(SOURCE, new RegExp(`title: "${p}"`));
});

// 9. planted control: the harness must be able to fail
await test('control: a stub that passes everything fails the planted-defect case', async () => {
  const stub = compile('return { status: "assessed", verdict: "pass", composite: 8, grade: "A", blockers: [], chainVerdict: { verdict: "pass", blockers: [] }, dimensions: [], reasons: [] };');
  const res = await stub({ ...BASE }, async () => PLANTED, () => {}, () => {}, pipeline);
  assert.throws(() => assert.equal(res.verdict, 'fail'), 'the stub must not pass the planted-defect case');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

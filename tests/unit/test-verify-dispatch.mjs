#!/usr/bin/env node
// ============================================================================
// verify-dispatch: Phase 2 of /ork:verify, offline with a stubbed agent()
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/verify/workflows/verify-dispatch.js must never return a verdict
//   cap higher than SKILL.md and references/grading-rubric.md allow. Every case
//   below scripts the agents' answers and asserts the cap:
//
//   1. Effort scaling (STEP 0): low none, medium security/quality/coverage,
//      high and xhigh all six; "max" means xhigh; unknown dimensions lower the
//      cap and an override that selects nothing is BLOCKED.
//   2. Refuters: only critical blockers and low scores; 1 vote at high, 3 at
//      xhigh; majority of PLANNED votes; a refutation needs a command (and a
//      correctedScore for a score); a null or throwing refuter is a no.
//   3. Gate: Tests not EVIDENCE, or EVIDENCE with a non-zero or unknown exit,
//      is BLOCKED; no testEvidence is PENDING-TESTS with capIfTestsPass;
//      security under min_blocker is BLOCKED unless refuted to a corrected
//      score at or above it; compliance (api, ui) under min_pass caps; missing
//      rubric applies defaults and caps; no command-backed evidence, CLAIMED
//      items, a dead verifier and a high blocker cap at IMPROVEMENTS
//      RECOMMENDED.
//   4. Agent ceiling: dispatch slots are reserved first (security first),
//      refuters share the rest, and every dropped spawn is logged and caps.
//
// HOW
//
//   The script runs as an async function body with args, agent, phase, log and
//   pipeline injected. The pipeline stub follows the Workflow runtime contract
//   in Claude Code's bundled workflow-authoring reference: "Every stage callback
//   receives (prevResult, originalItem, index)" and "A stage that throws drops
//   that item to null and skips its remaining stages."
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'src', 'skills', 'verify', 'workflows', 'verify-dispatch.js');
const RUBRIC = JSON.parse(readFileSync(path.join(REPO, 'src', 'skills', 'verify', 'rubric.json'), 'utf8'));

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const body = new AsyncFunction(
  'args',
  'agent',
  'phase',
  'log',
  'pipeline',
  readFileSync(SCRIPT, 'utf8').replace(/^export const meta/m, 'const meta'),
);

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

const GOOD = (score = 8) => ({ score, evidence: [{ claim: 'lint clean', command: 'npm run lint', exit: 0, keyLine: '0 problems' }], blockers: [] });
const CRIT = { score: 7, evidence: GOOD().evidence, blockers: [{ issue: 'SQL built by string concat', fileLine: 'api/db.py:40', severity: 'critical' }] };
const PASSED = { outcome: 'EVIDENCE', exitCode: 0, summaryLine: '214 passed' };
const YES = (extra = {}) => ({ refuted: true, reason: 'disproved', command: 'rg -n SECRET src', exit: 1, ...extra });
const NO = { refuted: false, reason: 'could not disprove' };

async function run({ args = {}, dispatch = {}, refute = [] }) {
  const calls = [];
  const refQ = [...refute];
  const agent = async (_prompt, opts) => {
    const [kind, focus] = String(opts.label).split(':');
    calls.push({ kind, focus, opts });
    if (kind === 'dispatch') {
      if (!(focus in dispatch)) return GOOD();
      const r = dispatch[focus];
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
  const merged = { rubric: RUBRIC, testEvidence: PASSED, ...args };
  const result = await body(merged, agent, () => {}, (m) => logs.push(String(m)), pipeline);
  const of = (k) => calls.filter((c) => c.kind === k);
  return { result, calls, logs, dispatched: of('dispatch').map((c) => c.focus).sort(), refuters: of('refute').length };
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
    console.log(`  FAIL ${name}\n       ${e.message.split('\n').join('\n       ')}`);
  }
}
const why = (r) => r.reasons.join('\n');

console.log('verify-dispatch');

// 1. effort and selection
await test('low effort spawns no verifier', async () => {
  const { calls, result } = await run({ args: { effort: 'low' } });
  assert.equal(calls.length, 0);
  assert.equal(result.verdictCap, 'READY FOR MERGE');
});
await test('medium effort spawns security, quality, coverage', async () => {
  const { dispatched } = await run({ args: { effort: 'medium' } });
  assert.deepEqual(dispatched, ['coverage', 'quality', 'security']);
});
await test('high effort spawns all six with their agent types', async () => {
  const { calls, result } = await run({ args: { effort: 'high' } });
  const types = calls.filter((c) => c.kind === 'dispatch').map((c) => c.opts.agentType).sort();
  assert.deepEqual(types, ['ork:backend-system-architect', 'ork:code-quality-reviewer', 'ork:frontend-ui-developer', 'ork:python-performance-engineer', 'ork:security-auditor', 'ork:test-generator']);
  assert.equal(result.verdictCap, 'READY FOR MERGE');
});
await test('probe K: effort "max" means xhigh (3 votes)', async () => {
  const { refuters, result } = await run({ args: { effort: 'max' }, dispatch: { security: CRIT }, refute: [NO, NO, NO] });
  assert.equal(result.effort, 'xhigh');
  assert.equal(refuters, 3);
});
await test('probe F: an override naming no known verifier is BLOCKED', async () => {
  const { calls, result } = await run({ args: { effort: 'high', dimensions: ['bogus'] } });
  assert.equal(calls.length, 0);
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('an override with one unknown name caps and still runs the known one', async () => {
  const { dispatched, result } = await run({ args: { effort: 'high', dimensions: ['Security', 'compliance'] } });
  assert.deepEqual(dispatched, ['security']);
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.match(why(result), /unknown dimension\(s\) requested: compliance/);
});
await test('modelOverride reaches every agent call', async () => {
  const { calls } = await run({ args: { effort: 'medium', modelOverride: 'sonnet' } });
  assert.ok(calls.every((c) => c.opts.model === 'sonnet'));
});

// 2. tests gate
await test('Tests outcome other than EVIDENCE is BLOCKED', async () => {
  const { result } = await run({ args: { effort: 'medium', testEvidence: { outcome: 'COULD-NOT-OBSERVE' } } });
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('probe C: EVIDENCE with a non-zero exit is BLOCKED', async () => {
  const { result } = await run({ args: { effort: 'medium', testEvidence: { outcome: 'EVIDENCE', exitCode: 1, summaryLine: '3 failed, 211 passed' } } });
  assert.equal(result.verdictCap, 'BLOCKED');
  assert.match(why(result), /EVIDENCE with exit 1/);
});
await test('EVIDENCE without an exit code is BLOCKED', async () => {
  const { result } = await run({ args: { effort: 'medium', testEvidence: { outcome: 'EVIDENCE', summaryLine: '214 passed' } } });
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('probe J: no testEvidence is PENDING-TESTS, never READY', async () => {
  const { result } = await run({ args: { effort: 'high', testEvidence: undefined } });
  assert.equal(result.verdictCap, 'PENDING-TESTS');
  assert.equal(result.capIfTestsPass, 'READY FOR MERGE');
  assert.equal(result.tests.outcome, 'PENDING');
});

// 3. rubric
await test('probe A: missing rubric applies defaults and caps (security 1 is BLOCKED)', async () => {
  const { result } = await run({ args: { effort: 'high', rubric: undefined }, dispatch: { security: GOOD(1) }, refute: [NO] });
  assert.equal(result.verdictCap, 'BLOCKED');
  assert.match(why(result), /default thresholds applied/);
});
await test('probe B: rubric given as JSON text is parsed (security 1 is BLOCKED)', async () => {
  const { result } = await run({ args: { effort: 'high', rubric: JSON.stringify(RUBRIC) }, dispatch: { security: GOOD(1) }, refute: [NO] });
  assert.equal(result.verdictCap, 'BLOCKED');
  assert.doesNotMatch(why(result), /default thresholds/);
});
await test('compliance: an api score under min_pass caps at IMPROVEMENTS RECOMMENDED', async () => {
  const { result } = await run({ args: { effort: 'high' }, dispatch: { api: GOOD(5) }, refute: [NO] });
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.match(why(result), /api 5\/10 below min_pass 6/);
});

// 4. refuters
await test('security under min_blocker stays BLOCKED when the refuter says no', async () => {
  const { result, refuters } = await run({ args: { effort: 'high' }, dispatch: { security: GOOD(3) }, refute: [NO] });
  assert.equal(refuters, 1);
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('probe I: a refuted score without correctedScore does not count', async () => {
  const { result } = await run({ args: { effort: 'high' }, dispatch: { security: GOOD(3) }, refute: [YES()] });
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('a refuted score is held to its correctedScore', async () => {
  const low = await run({ args: { effort: 'high' }, dispatch: { security: GOOD(3) }, refute: [YES({ correctedScore: 3.5 })] });
  assert.equal(low.result.verdictCap, 'BLOCKED');
  const ok = await run({ args: { effort: 'high' }, dispatch: { security: GOOD(3) }, refute: [YES({ correctedScore: 7 })] });
  assert.equal(ok.result.verdictCap, 'READY FOR MERGE');
  assert.equal(ok.result.agents.find((a) => a.focus === 'security').effectiveScore, 7);
});
await test('a refutation without a command does not count', async () => {
  const { result } = await run({ args: { effort: 'high' }, dispatch: { security: CRIT }, refute: [{ refuted: true, reason: 'looks fine' }] });
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('xhigh: 2 of 3 refuting with commands drops a critical blocker', async () => {
  const { result, refuters } = await run({ args: { effort: 'xhigh' }, dispatch: { security: CRIT }, refute: [YES(), YES(), NO] });
  assert.equal(refuters, 3);
  assert.equal(result.verdictCap, 'READY FOR MERGE');
});
await test('probe E: 2 dead refuters and 1 yes is not a majority of 3', async () => {
  const { result } = await run({ args: { effort: 'xhigh' }, dispatch: { security: CRIT }, refute: [null, null, YES()] });
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('probe G: a throwing refuter counts as no, the blocker survives', async () => {
  const { result } = await run({ args: { effort: 'high' }, dispatch: { security: CRIT }, refute: [new Error('boom')] });
  assert.equal(result.verdictCap, 'BLOCKED');
  assert.equal(result.agents.find((a) => a.focus === 'security').outcome, 'SCORED');
});
await test('medium never spawns refuters, a critical blocker is BLOCKED', async () => {
  const { result, refuters } = await run({ args: { effort: 'medium' }, dispatch: { quality: CRIT } });
  assert.equal(refuters, 0);
  assert.equal(result.verdictCap, 'BLOCKED');
});
await test('probe H: a high blocker caps without spending a refuter', async () => {
  const { result, refuters } = await run({ args: { effort: 'high' }, dispatch: { security: { ...GOOD(8), blockers: [{ issue: 'weak cipher', severity: 'high' }] } } });
  assert.equal(refuters, 0);
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
});

// 5. evidence and dead agents
await test('probe D: a score with no command-backed evidence caps', async () => {
  const { result } = await run({ args: { effort: 'high' }, dispatch: { security: { score: 10, evidence: [], blockers: [] } } });
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.match(why(result), /no command-backed evidence/);
});
await test('CLAIMED evidence caps at IMPROVEMENTS RECOMMENDED', async () => {
  const { result } = await run({ args: { effort: 'medium' }, dispatch: { coverage: { score: 9, evidence: [{ claim: 'coverage is 91%' }, GOOD().evidence[0]], blockers: [] } } });
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.deepEqual(result.agents.find((a) => a.focus === 'coverage').claimed, ['coverage is 91%']);
});
await test('a verifier that returns null caps', async () => {
  const { result } = await run({ args: { effort: 'medium' }, dispatch: { quality: null } });
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.equal(result.agents.find((a) => a.focus === 'quality').outcome, 'NO-RESULT');
});
await test('a verifier that throws caps (no result branch)', async () => {
  const { result } = await run({ args: { effort: 'medium' }, dispatch: { quality: new Error('crash') } });
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.match(why(result), /quality: no result/);
});

// 6. ceiling
await test('ceiling below the verifier count drops the last verifiers, keeps security', async () => {
  const { result, dispatched, logs } = await run({ args: { effort: 'high', maxAgents: 4 } });
  assert.ok(dispatched.includes('security'));
  assert.equal(dispatched.length, 4);
  assert.equal(result.dropped.length, 2);
  assert.equal(result.verdictCap, 'IMPROVEMENTS RECOMMENDED');
  assert.ok(logs.some((l) => /agent ceiling 4 reached/.test(l)));
});
await test('refuters use only the slots left after dispatch', async () => {
  const { result, refuters } = await run({ args: { effort: 'xhigh', maxAgents: 7 }, dispatch: { security: CRIT }, refute: [YES(), YES(), YES()] });
  assert.equal(refuters, 1);
  assert.equal(result.verdictCap, 'BLOCKED');
  assert.equal(result.dropped.length, 2);
});
await test('maxAgents is clamped to 12, and 0 means 1', async () => {
  const big = await run({ args: { effort: 'high', maxAgents: 999 } });
  assert.equal(big.result.dropped.length, 0);
  const zero = await run({ args: { effort: 'high', maxAgents: 0 } });
  assert.equal(zero.dispatched.length, 1);
  assert.deepEqual(zero.dispatched, ['security']);
});

// 7. args shape
await test('args given as a JSON string are parsed', async () => {
  const labels = [];
  const agent = async (_p, o) => {
    labels.push(o.label);
    return GOOD();
  };
  await body(JSON.stringify({ effort: 'medium', rubric: RUBRIC, testEvidence: PASSED }), agent, () => {}, () => {}, pipeline);
  assert.equal(labels.length, 3);
});
await test('malformed args text fails with a clear message', async () => {
  await assert.rejects(body('{not json', async () => GOOD(), () => {}, () => {}, pipeline), /verify-dispatch: args is not valid JSON/);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

#!/usr/bin/env node
// ============================================================================
// brainstorm-diverge: Phase 2 of /ork:brainstorm at effort low, offline with a
// stubbed agent()
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/brainstorm/workflows/brainstorm-diverge.js is the only place
//   brainstorm spends low effort (claude.dev "Spending your effort": low for
//   in-the-loop brainstorming). Skill frontmatter cannot scope effort to one
//   phase and the Agent tool has no per-call effort, so this script carries it.
//
//   1. Effort: EVERY agent() call passes effort "low", including the top-up.
//   2. No evaluation: the idea schema carries no score field and the prompt
//      forbids scoring, so Phase 4 stays at the session effort.
//   3. Coverage: workflow-architect and test-generator are always generators.
//   4. Pool: duplicate titles merge (raisedBy grows), a BLOCKED, null or
//      throwing generator is reported as NO-IDEAS, PARTIAL ideas are flagged.
//   5. Top-up: exactly one extra round under the target, none at or above it,
//      and the top-up prompt names the titles already in the pool.
//   6. Determinism: no Date.now(), Math.random() or argless new Date().
//   7. Control: a stub that ignores effort fails this harness.
//
// HOW
//
//   Same harness as test-review-fanout.mjs: the script runs as an async
//   function body with args, agent, phase, log and pipeline injected.
//   BRAINSTORM_DIVERGE_SCRIPT=<path> runs the suite against another script.
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAL = path.join(REPO, 'src', 'skills', 'brainstorm', 'workflows', 'brainstorm-diverge.js');
const SCRIPT = process.env.BRAINSTORM_DIVERGE_SCRIPT ? path.resolve(process.env.BRAINSTORM_DIVERGE_SCRIPT) : REAL;

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

const IDEAS = (n, prefix, status = 'DONE') => ({ status, ideas: Array.from({ length: n }, (_, i) => ({ title: `${prefix} idea ${i + 1}`, sketch: 's' })) });

async function run(args, answer) {
  const calls = [];
  const agent = async (prompt, opts) => {
    calls.push({ prompt, opts });
    return answer(opts, prompt, calls.length);
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

const BASE = { topic: 'notification system', tier: 'MVP (Tier 3)', agents: ['ork:backend-system-architect'] };

await test('every generator call runs at effort low', async () => {
  const { calls } = await run(BASE, (o) => IDEAS(4, o.agentType));
  assert.ok(calls.length >= 3, `expected 3 generators, got ${calls.length}`);
  for (const c of calls) assert.equal(c.opts.effort, 'low', `${c.opts.label} ran at effort ${c.opts.effort}`);
});

await test('the top-up round also runs at effort low', async () => {
  const { calls, result } = await run(BASE, (o, _p, n) => (n <= 3 ? IDEAS(2, o.agentType) : IDEAS(6, 'extra')));
  assert.equal(result.toppedUp, true);
  const top = calls.filter((c) => c.opts.phase === 'Top-up');
  assert.equal(top.length, 1);
  assert.equal(top[0].opts.effort, 'low');
});

await test('result reports effort low', async () => {
  const { result } = await run(BASE, (o) => IDEAS(4, o.agentType));
  assert.equal(result.effort, 'low');
});

await test('no scoring: schema has no score field and the prompt forbids it', async () => {
  const { calls } = await run(BASE, (o) => IDEAS(4, o.agentType));
  const props = Object.keys(calls[0].opts.schema.properties.ideas.items.properties);
  assert.ok(!props.some((p) => /score|rating|rank/i.test(p)), `schema carries ${props.join(', ')}`);
  assert.match(calls[0].prompt, /Do NOT filter, score or critique/);
});

await test('workflow-architect and test-generator always generate', async () => {
  const { calls, result } = await run({ topic: 't', agents: ['backend-system-architect'] }, (o) => IDEAS(4, o.agentType));
  const types = calls.map((c) => c.opts.agentType);
  for (const a of ['ork:workflow-architect', 'ork:test-generator', 'ork:backend-system-architect']) assert.ok(types.includes(a), `${a} missing from ${types.join(', ')}`);
  assert.ok(result.reasons.some((r) => r.includes('added ork:workflow-architect')));
});

await test('duplicate titles merge into one idea', async () => {
  const same = { status: 'DONE', ideas: [{ title: 'Use a queue', sketch: 'a' }, { title: 'Fan-out by topic', sketch: 'b' }] };
  const { result } = await run({ ...BASE, minIdeas: 1 }, () => same);
  const q = result.ideas.filter((i) => i.title === 'Use a queue');
  assert.equal(q.length, 1);
  assert.equal(q[0].raisedBy.length, 3);
});

await test('BLOCKED, null and throwing generators are NO-IDEAS, not dropped', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, (o) => {
    if (o.agentType === 'ork:test-generator') return { status: 'BLOCKED', ideas: [] };
    if (o.agentType === 'ork:backend-system-architect') throw new Error('api error');
    return IDEAS(3, 'wa');
  });
  const none = result.perspectives.filter((p) => p.outcome === 'NO-IDEAS').map((p) => p.perspective);
  assert.deepEqual(none.sort(), ['ork:backend-system-architect', 'ork:test-generator']);
  assert.ok(result.reasons.some((r) => r.startsWith('missing:')));
});

await test('PARTIAL generator ideas are flagged for Phase 3', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, (o) => IDEAS(2, o.agentType, o.agentType === 'ork:test-generator' ? 'PARTIAL' : 'DONE'));
  assert.equal(result.ideas.filter((i) => i.partial).length, 2);
  assert.ok(result.reasons.some((r) => r.startsWith('partial:')));
});

await test('no top-up at or above the target', async () => {
  const { calls, result } = await run(BASE, (o) => IDEAS(4, o.agentType));
  assert.equal(result.toppedUp, false);
  assert.equal(calls.length, 3);
  assert.equal(result.short, false);
});

await test('exactly one top-up, it names existing titles, short is reported', async () => {
  const { calls, result } = await run(BASE, (o) => IDEAS(1, o.agentType));
  const top = calls.filter((c) => c.opts.phase === 'Top-up');
  assert.equal(top.length, 1);
  assert.match(top[0].prompt, /already in the pool/);
  assert.match(top[0].prompt, /ork:test-generator idea 1/);
  assert.equal(result.short, true);
  assert.ok(result.reasons.some((r) => r.startsWith('short:')));
});

// Review fix (estate-29 on #4572, CodeRabbit): the operator brainstorms in Hebrew.
const HE_A = 'תור הודעות'; // "message queue"
const HE_B = 'שליחה מרוכזת'; // "batched send"
const ONLY = (byType) => (o) => byType[o.agentType] || { status: 'DONE', ideas: [] };

await test('Hebrew: two different Hebrew titles stay distinct, with their own sketches', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, ONLY({ 'ork:workflow-architect': { status: 'DONE', ideas: [{ title: HE_A, sketch: 'sketch A' }, { title: HE_B, sketch: 'sketch B' }] } }));
  const titles = result.ideas.map((i) => i.title);
  assert.deepEqual(titles, [HE_A, HE_B]);
  assert.deepEqual(result.ideas.map((i) => i.sketch), ['sketch A', 'sketch B']);
});

await test('Hebrew: the same Hebrew title twice dedups to one idea', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, ONLY({
    'ork:workflow-architect': { status: 'DONE', ideas: [{ title: HE_A, sketch: 'first' }] },
    'ork:test-generator': { status: 'DONE', ideas: [{ title: ` ${HE_A}! `, sketch: 'second' }] },
  }));
  const a = result.ideas.filter((i) => i.sketch === 'first' || i.sketch === 'second');
  assert.equal(a.length, 1);
  assert.deepEqual(a[0].raisedBy, ['ork:workflow-architect', 'ork:test-generator']);
});

await test('Hebrew: a mixed Hebrew and English title keys on both scripts', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, ONLY({ 'ork:workflow-architect': { status: 'DONE', ideas: [
    { title: `Redis ${HE_A}`, sketch: 'x' },
    { title: `Redis ${HE_B}`, sketch: 'y' },
    { title: `redis  ${HE_A}`, sketch: 'z' },
  ] } }));
  assert.deepEqual(result.ideas.map((i) => i.sketch), ['x', 'y']);
});

await test('empty DONE: an empty or all-untitled DONE list is NO-IDEAS and named in missing:', async () => {
  const { result } = await run({ ...BASE, minIdeas: 1 }, ONLY({
    'ork:workflow-architect': IDEAS(3, 'wa'),
    'ork:test-generator': { status: 'DONE', ideas: [] },
    'ork:backend-system-architect': { status: 'DONE', ideas: [{ title: '', sketch: 'a' }, { title: '  ', sketch: 'b' }, { title: '!!', sketch: 'c' }] },
  }));
  const none = result.perspectives.filter((p) => p.outcome === 'NO-IDEAS').map((p) => p.perspective).sort();
  assert.deepEqual(none, ['ork:backend-system-architect', 'ork:test-generator']);
  const missing = result.reasons.find((r) => r.startsWith('missing:')) || '';
  assert.match(missing, /ork:test-generator/);
  assert.match(missing, /ork:backend-system-architect/);
});

await test('all duplicates: a generator whose ideas were all in the pool gets its own reason, not missing:', async () => {
  const same = { status: 'DONE', ideas: [{ title: 'Use a queue', sketch: 'a' }] };
  const { result } = await run({ topic: 't', agents: [], minIdeas: 1 }, ONLY({ 'ork:workflow-architect': same, 'ork:test-generator': same }));
  const dup = result.perspectives.filter((p) => p.outcome === 'ALL-DUPLICATES').map((p) => p.perspective);
  assert.equal(dup.length, 1);
  assert.ok(result.reasons.some((r) => r.startsWith('duplicates:') && r.includes(dup[0])), result.reasons.join(' | '));
  assert.ok(!result.reasons.some((r) => r.startsWith('missing:')), 'a duplicate-only generator is not missing');
});

await test('missing topic throws', async () => {
  await assert.rejects(run({}, () => IDEAS(1, 'x')), /topic is required/);
});

await test('no Date.now, Math.random or argless new Date in the script', async () => {
  const code = SOURCE.replace(/\/\/.*$/gm, '');
  assert.ok(!/Date\.now\(|Math\.random\(|new Date\(\s*\)/.test(code));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);

#!/usr/bin/env node
// ============================================================================
// fix-blast-radius contract: the safety fact, the proof ladder, the rubric mark
// ============================================================================
// WHAT THIS GUARDS
//
//   1. src/skills/fix-issue/references/fix-blast-radius.md asks the user
//      nothing (no AskUserQuestion), carries the five-step proof ladder, says a
//      pass needs step 4 (a run against the real code), says an unreached fact
//      is written as unproven, and keeps the upstream credit and MIT notice.
//   2. fix-issue SKILL.md and references/claude-code.md point at the ladder,
//      not at the old four questions.
//   3. src/skills/review-pr/rubric.json has a zero-weight safety_proof
//      criterion: unproven below ladder step 4, proven at 4 and above, and it
//      never changes the other weights (they still sum to 1). It carries the
//      same min_blocker as the other dimensions, because the skill eval skips
//      a dimension without one and the criterion would stay unmeasured.
//   4. Control: the checks fail on text that lacks the property.
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(REPO, p), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL: ${name}\n  ${e.message}`);
  }
};

const REF = 'src/skills/fix-issue/references/fix-blast-radius.md';

const refProblems = (text) => {
  const problems = [];
  if (/AskUserQuestion/.test(text)) problems.push('asks the user (AskUserQuestion)');
  for (const step of ['1 | You said so', '2 | You pointed at the line', '3 | You showed the bad case cannot happen', '4 | You ran it', '5 | You reproduced it']) {
    if (!text.includes(step)) problems.push(`ladder row missing: ${step}`);
  }
  if (!/A pass needs step 4/.test(text)) problems.push('no rule that a pass needs step 4');
  if (!/written down as\s+\*\*unproven\*\*/.test(text)) problems.push('no rule that a fact below step 4 is written as unproven');
  if (/\b(floor|lane|seat|conductor|desk)\b/i.test(text)) problems.push('public text names an internal term');
  if (!/Lauren Tan/.test(text) || !/MIT License/.test(text)) problems.push('credit or MIT notice missing');
  if (!/Copyright \(c\) 2026 Lauren Tan/.test(text)) problems.push('upstream copyright line missing');
  return problems;
};

check('reference: no user question, ladder, step-4 pass rule, unproven mark, credit', () => {
  assert.deepEqual(refProblems(read(REF)), []);
});

check('control: the reference check fails on the old four-question text', () => {
  const old = 'Ordered `AskUserQuestion`, highest first, cap ~4. Schema / migration. Auth / security.';
  assert.ok(refProblems(old).length >= 5, 'old text should trip several problems');
});

check('fix-issue SKILL.md and claude-code.md point at the ladder, not the questions', () => {
  for (const p of ['src/skills/fix-issue/SKILL.md', 'src/skills/fix-issue/references/claude-code.md']) {
    const t = read(p);
    assert.ok(/proof ladder/.test(t), `${p}: no proof ladder mention`);
    assert.ok(/step 4/.test(t), `${p}: no step 4 pass rule`);
    assert.ok(/No user questions/.test(t), `${p}: does not say the gate asks nothing`);
    assert.ok(!/blast-radius\*\* via ordered `AskUserQuestion`/.test(t), `${p}: still carries the four questions`);
  }
});

check('rubric: safety_proof is a zero-weight criterion that requires step 4', () => {
  const rubric = JSON.parse(read('src/skills/review-pr/rubric.json'));
  const dim = rubric.dimensions.find((d) => d.name === 'safety_proof');
  assert.ok(dim, 'safety_proof dimension missing');
  assert.equal(dim.weight, 0);
  assert.equal(dim.min_blocker, 4.0, 'the skill eval skips a dimension without min_blocker, so it would stay unmeasured');
  assert.match(dim.description, /UNPROVEN/);
  assert.match(dim.description, /Step 4 or 5 passes/);
  assert.match(dim.description, /skill eval/, 'the description must say the minimum applies to the skill eval, not to the review verdict');
  const unproven = dim.bands.find((b) => b.label === 'unproven');
  const byRun = dim.bands.find((b) => b.label === 'proven-by-run');
  assert.ok(unproven && unproven.score_max === 3, 'unproven band must end below step 4');
  assert.ok(byRun && byRun.score_min === 4, 'proven-by-run band must start at step 4');
  const sum = rubric.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.001, `weights must still sum to 1 (got ${sum})`);
});

// tests/evals/scripts/run-skill-eval.sh reads `.min_blocker // empty` per dimension and
// skips a dimension that has none ("no hard floor"). A zero-weight criterion without one is
// never checked, whatever the skill does with it. Every dimension must carry the same
// minimum, so the criterion is measured like the others.
const floorProblems = (rubric) => {
  const problems = [];
  const others = rubric.dimensions.filter((d) => d.name !== 'safety_proof');
  const common = [...new Set(others.map((d) => d.min_blocker))];
  if (common.length !== 1 || typeof common[0] !== 'number') problems.push(`other dimensions do not share one min_blocker (${common.join(', ')})`);
  for (const d of rubric.dimensions) {
    if (typeof d.min_blocker !== 'number') problems.push(`${d.name}: no min_blocker, the skill eval skips it`);
    else if (common.length === 1 && d.min_blocker !== common[0]) problems.push(`${d.name}: min_blocker ${d.min_blocker} differs from ${common[0]}`);
  }
  return problems;
};

check('rubric: every dimension, safety_proof included, carries the same min_blocker the skill eval reads', () => {
  assert.deepEqual(floorProblems(JSON.parse(read('src/skills/review-pr/rubric.json'))), []);
});

check('control: the floor check fails on a rubric where safety_proof has none, or a different one', () => {
  const rubric = JSON.parse(read('src/skills/review-pr/rubric.json'));
  const without = structuredClone(rubric);
  delete without.dimensions.find((d) => d.name === 'safety_proof').min_blocker;
  assert.ok(floorProblems(without).some((p) => /safety_proof: no min_blocker/.test(p)), 'missing floor not reported');
  const lower = structuredClone(rubric);
  lower.dimensions.find((d) => d.name === 'safety_proof').min_blocker = 3.0;
  assert.ok(floorProblems(lower).some((p) => /safety_proof: min_blocker 3 differs/.test(p)), 'different floor not reported');
});

check('generated plugin copies match src (run npm run build after editing)', () => {
  for (const p of ['skills/fix-issue/references/fix-blast-radius.md', 'skills/fix-issue/references/claude-code.md', 'skills/review-pr/rubric.json']) {
    assert.equal(read(`plugins/ork/${p}`), read(`src/${p}`), `plugins/ork/${p} differs from src/${p}`);
  }
});

check('rubric text carries no internal term', () => {
  assert.ok(!/\b(floor|lane|seat|conductor|desk)\b/i.test(read('src/skills/review-pr/rubric.json')));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

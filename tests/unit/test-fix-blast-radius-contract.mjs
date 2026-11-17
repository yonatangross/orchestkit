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
//      never changes the other weights (they still sum to 1).
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
  if (!/unproven/.test(text)) problems.push('no unproven mark');
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
    assert.ok(!/blast-radius\*\* via ordered `AskUserQuestion`/.test(t), `${p}: still carries the four questions`);
  }
});

check('rubric: safety_proof is a zero-weight criterion that requires step 4', () => {
  const rubric = JSON.parse(read('src/skills/review-pr/rubric.json'));
  const dim = rubric.dimensions.find((d) => d.name === 'safety_proof');
  assert.ok(dim, 'safety_proof dimension missing');
  assert.equal(dim.weight, 0);
  assert.equal(dim.min_blocker, undefined, 'a mark, not a blocker');
  assert.match(dim.description, /UNPROVEN/);
  assert.match(dim.description, /Step 4 or 5 passes/);
  const unproven = dim.bands.find((b) => b.label === 'unproven');
  const byRun = dim.bands.find((b) => b.label === 'proven-by-run');
  assert.ok(unproven && unproven.score_max === 3, 'unproven band must end below step 4');
  assert.ok(byRun && byRun.score_min === 4, 'proven-by-run band must start at step 4');
  const sum = rubric.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.001, `weights must still sum to 1 (got ${sum})`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

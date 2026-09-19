import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalize, summarize, readRows } from '../../scripts/jev-shadow-report.mjs';

const route = (extra = {}) => ({ intent: 'dev_fix', conf: 0.9, floor: 0.8, flag: 'shadow', ...extra });
const rows = [
  normalize(route({ incumbent_intent: 'dev_build' }), 'high', { correct: 'dev_build' }),
  normalize(route({ incumbent_intent: 'dev_build', conf: 0.7 }), 'low'),
  normalize(route({ incumbent_intent: 'dev_fix', conf: 0.8 }), 'agree'),
  normalize(route(), 'unknown'),
  normalize(route({ conf: 2 }), 'invalid'),
  normalize(route({ intent: null, conf: null, error: 'timeout' }), 'error'),
];
const [s] = summarize(rows);
assert.deepEqual([s.rows, s.paired, s.agreements, s.highDisagreements, s.highPaired, s.belowFloor, s.errors, s.falseHigh, s.labeledHigh], [6, 3, 1, 1, 2, 1, 1, 1, 1]);
assert.equal(s.examples[0].source, 'high');
assert.equal(s.bands[2].agreements, 1);
assert.equal(rows[3].agree, null);
assert.equal(rows[4].confidence, null);
assert.equal(normalize(route(), 'label', { incumbent: 'dev_build' }).highDisagreement, true);
assert.equal(normalize({ haiku: 'fix', jev: 'feature', jev_confidence: 0.8, threshold: 0.8, provider: 'shadow' }, 'category').highDisagreement, true);
assert.equal(normalize({ step_id: 's', jev_action: 'click_e1', model_action_key: null, agree: false, jev_confidence: 0.9 }, 'legacy').highDisagreement, false);
const dir = mkdtempSync(join(tmpdir(), 'jev-report-'));
try {
  const file = join(dir, 'samples.jsonl');
  writeFileSync(file, `${JSON.stringify(route())}\n{bad\nJEV_SHADOW|s|${JSON.stringify({ step_id: 's', jev_action: 'click_e2', model_action_key: 'click_e1', jev_confidence: 0.95, floor: 0.5 })}\n${JSON.stringify(route({ flag: 'steer' }))}\n`);
  writeFileSync(join(dir, 'session-identity.shadow.json'), JSON.stringify({ haiku: 'fix', jev: 'feature', provider: 'shadow', jev_confidence: 0.8, threshold: 0.8 }, null, 2));
  const input = readRows([dir, file]);
  assert.equal(input.rows.length, 4);
  assert.equal(input.malformed, 1);
  const labels = join(dir, 'labels.txt');
  writeFileSync(labels, JSON.stringify({ source: `${file}:1`, incumbent: 'dev_build', correct: 'dev_build' }));
  const output = execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', labels, dir], { encoding: 'utf8' });
  assert.match(output, /3 rows; malformed=1; ignored=0; excluded_modes=1/);
  assert.match(output, /route: rows=1 paired=1 unpaired=0 agreement=0\/1/);
  assert.match(output, /expect: rows=1 paired=1/);
  assert.match(output, /category: rows=1 paired=1/);
  assert.match(output, /labeled false-high=1\/1/);
  assert.match(output, /share_high_paired=100.0%/);
  const canonical = join(dir, 'canonical.jsonl');
  const cases = ['route', 'expect', 'category'].flatMap((seam) => [
    { seam, mode: 'shadow', jev_pick: 'a', incumbent_pick: 'b', agree: false, jev_confidence: 0.8, floor: 0.8 },
    { seam, mode: 'shadow', jev_pick: 'a', incumbent_pick: 'b', agree: false, jev_confidence: 0.79, floor: 0.8 },
    { seam, mode: 'shadow', jev_pick: 'a', incumbent_pick: 'a', agree: true, jev_confidence: 0.9, floor: 0.8 },
    { seam, mode: 'shadow', jev_pick: 'a', incumbent_pick: 'unparsed', agree: null, jev_confidence: 0.9, floor: 0.8 },
  ]);
  writeFileSync(canonical, cases.map((row) => JSON.stringify(row)).join('\n'));
  assert.equal(normalize(cases[3], 'unparsed').paired, false);
  const queue = execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--confident-wrong', canonical], { encoding: 'utf8' }).trim().split('\n').map(JSON.parse);
  assert.deepEqual(queue.map((row) => row.seam), ['route', 'expect', 'category']);
  for (const row of queue) {
    assert.equal(row.agree, false);
    assert.equal(row.jev_confidence, row.floor);
    assert.equal(row.review_status, 'awaiting_adjudication');
    assert.equal(row.outcome_label, null);
    assert.ok('decided_by' in row);
  }
  const revisions = join(dir, 'revisions.jsonl');
  const pending = { ...cases[0], incumbent_pick: null, agree: null, decision_id: 'prompt-a', phase: 'pending' };
  const paired = { ...cases[0], decision_id: 'prompt-a', phase: 'paired' };
  writeFileSync(revisions, [pending, paired, pending, paired, { ...paired, decision_id: 'prompt-b' }].map(JSON.stringify).join('\n'));
  const deduped = readRows([revisions]);
  assert.equal(deduped.rows.length, 2);
  assert.equal(deduped.superseded, 3);
  assert.equal(deduped.rows[0].source, `${revisions}:2`);
  assert.ok(deduped.rows.every((row) => row.phase === 'paired' && row.agree === false));
  const otherSession = join(dir, 'other-session.jsonl');
  writeFileSync(otherSession, JSON.stringify(paired));
  assert.equal(readRows([revisions, otherSession]).rows.length, 3);
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('PASS: Jev shadow report counts, confidence bands, labels, legacy unknowns, malformed rows and CLI');

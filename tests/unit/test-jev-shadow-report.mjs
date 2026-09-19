import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonical, decisionSha256, normalize, summarize, readRows } from '../../scripts/jev-shadow-report.mjs';

const route = (extra = {}) => ({ intent: 'dev_fix', conf: 0.9, floor: 0.8, flag: 'shadow', ...extra });
const labelFor = (row, fields) => ({ ...fields, decision_sha256: decisionSha256(row) });
const high = route({ incumbent_intent: 'dev_build' });
const low = route({ incumbent_intent: 'dev_build', conf: 0.7 });
const agree = route({ incumbent_intent: 'dev_fix', conf: 0.8 });
const rows = [
  normalize(high, 'high', labelFor(high, { correct: 'dev_build' })),
  normalize(low, 'low'),
  normalize(agree, 'agree'),
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
const labeled = route();
assert.equal(normalize(labeled, 'label', labelFor(labeled, { incumbent: 'dev_build' })).highDisagreement, true);
assert.equal(normalize({ haiku: 'fix', jev: 'feature', jev_confidence: 0.8, threshold: 0.8, provider: 'shadow' }, 'category').highDisagreement, true);
assert.equal(normalize({ step_id: 's', jev_action: 'click_e1', model_action_key: null, agree: false, jev_confidence: 0.9 }, 'legacy').highDisagreement, false);
assert.deepEqual(canonical({ b: { y: 2, x: 1 }, a: [{ d: 4, c: 3 }] }), { a: [{ c: 3, d: 4 }], b: { x: 1, y: 2 } });
assert.equal(
  decisionSha256({ b: { y: 2, x: 1 }, a: [{ d: 4, c: 3 }] }),
  decisionSha256({ a: [{ c: 3, d: 4 }], b: { x: 1, y: 2 } }),
);
const replaced = route({ intent: 'dev_build' });
const stale = normalize(replaced, 'rewritten:1', labelFor(route(), { incumbent: 'dev_fix', correct: 'dev_fix' }));
assert.equal(stale.labelMismatch, true);
assert.equal(stale.correct, null);
assert.equal(stale.falseHigh, false);
const invalidRoute = normalize(high, 'invalid-route', labelFor(high, { correct: 'dev_fxi' }));
assert.equal(invalidRoute.invalidLabel, true);
assert.equal(invalidRoute.correct, null);
assert.equal(invalidRoute.falseHigh, false);
const category = { haiku: 'bugfix', jev: 'feature', jev_confidence: 0.9, threshold: 0.8, provider: 'shadow' };
assert.equal(normalize(category, 'category', labelFor(category, { correct: 'feature' })).invalidLabel, false);
assert.equal(normalize(category, 'invalid-category', labelFor(category, { correct: 'review' })).invalidLabel, true);
const expectRow = { step_id: 's', jev_action: 'click:@e2', model_action_key: 'click:@e1', jev_confidence: 0.95, floor: 0.5 };
assert.equal(normalize(expectRow, 'expect', labelFor(expectRow, { correct: 'click:@e2' })).invalidLabel, false);
assert.equal(normalize(expectRow, 'invalid-expect', labelFor(expectRow, { correct: 'press:@e1' })).invalidLabel, true);
const weak = normalize(high, 'weak', { kind: 'weak', ...labelFor(high, { correct: 'dev_build' }) });
assert.equal(weak.invalidLabel, true);
assert.equal(weak.correct, null);
assert.equal(weak.falseHigh, false);
const dir = mkdtempSync(join(tmpdir(), 'jev-report-'));
try {
  const file = join(dir, 'samples.jsonl');
  const loggedRoute = route();
  writeFileSync(file, `${JSON.stringify(loggedRoute)}\n{bad\nJEV_SHADOW|s|${JSON.stringify({ step_id: 's', jev_action: 'click_e2', model_action_key: 'click_e1', jev_confidence: 0.95, floor: 0.5 })}\n${JSON.stringify(route({ flag: 'steer' }))}\n`);
  writeFileSync(join(dir, 'session-identity.shadow.json'), JSON.stringify({ haiku: 'fix', jev: 'feature', provider: 'shadow', jev_confidence: 0.8, threshold: 0.8 }, null, 2));
  const input = readRows([dir, file]);
  assert.equal(input.rows.length, 4);
  assert.equal(input.malformed, 1);
  const staleInput = readRows([file], new Map([[`${file}:1`, labelFor(route({ intent: 'dev_build' }), { correct: 'dev_build' })]]));
  assert.equal(staleInput.labelMismatches, 1);
  assert.equal(staleInput.rows[0].correct, null);
  const invalidInput = readRows([file], new Map([[`${file}:1`, labelFor(loggedRoute, { correct: 'dev_fxi' })]]));
  assert.equal(invalidInput.invalidLabels, 1);
  assert.equal(invalidInput.rows[0].falseHigh, false);
  const labels = join(dir, 'labels.txt');
  writeFileSync(labels, JSON.stringify({ source: `${file}:1`, ...labelFor(loggedRoute, { incumbent: 'dev_build', correct: 'dev_build' }) }));
  const output = execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', labels, dir], { encoding: 'utf8' });
  assert.match(output, /3 rows; malformed=1; ignored=0; invalid_labels=0; label_mismatches=0; excluded_modes=1/);
  assert.match(output, /route: rows=1 paired=1 unpaired=0 agreement=0\/1/);
  assert.match(output, /expect: rows=1 paired=1/);
  assert.match(output, /category: rows=1 paired=1/);
  assert.match(output, /labeled false-high=1\/1/);
  assert.match(output, /share_high_paired=100.0%/);
  const weakLabels = join(dir, 'weak-labels.txt');
  writeFileSync(weakLabels, JSON.stringify({ source: `${file}:1`, kind: 'weak', ...labelFor(loggedRoute, { correct: 'dev_build' }) }));
  assert.throws(
    () => execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', weakLabels, file], { encoding: 'utf8', stdio: 'pipe' }),
    /Invalid adjudicated label/,
  );
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('PASS: Jev shadow report counts, confidence bands, labels, legacy unknowns, malformed rows and CLI');

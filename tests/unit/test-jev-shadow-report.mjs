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
const weak = normalize(route(), 'weak', { kind: 'weak', outcome: 'wrong', signal: 'operator_redirect', decision_sha256: normalize(route(), 'weak').decisionHash, correct: 'dev_build', incumbent: 'dev_build' });
assert.equal(weak.correct, null, 'weak corrected picks are not adjudication');
assert.equal(weak.incumbent, null, 'weak labels cannot manufacture incumbent agreement');
assert.equal(weak.falseHigh, false);
assert.equal(weak.labeledHigh, false);
assert.equal(summarize([weak])[0].weakHighWrong, 1);
assert.equal(summarize([normalize(route({ conf: 0.8 }), 'boundary', { kind: 'weak', outcome: 'wrong', signal: 'alternate_executor', decision_sha256: normalize(route({ conf: 0.8 }), 'boundary').decisionHash })])[0].weakHighWrong, 1);
const stale = normalize(route({ prompt_id: 'new' }), 'weak', { kind: 'weak', outcome: 'wrong', signal: 'alternate_executor', decision_sha256: normalize(route({ prompt_id: 'old' }), 'weak').decisionHash });
assert.equal(stale.weak, 'unknown', 'rotated source lines cannot reuse another prompt outcome');
assert.equal(summarize([stale])[0].weakMismatches, 1);
assert.equal(summarize([stale])[0].weakHighWrong, 0);
for (const changed of [{ ts: 'new' }, { input_hash: 'new' }, { error: 'timeout' }, { nested: { request: ['new'] } }]) {
  const original = route({ ts: 'old', input_hash: 'old', nested: { request: ['old'] } });
  const label = { kind: 'weak', outcome: 'correct', signal: 'clean_completion', decision_sha256: normalize(original, 'same').decisionHash };
  assert.equal(normalize({ ...original, ...changed }, 'same', label).weak, 'unknown', 'every raw decision field must be fingerprinted');
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(normalize(reordered, 'same', label).weak, 'correct', 'key order is not a new decision');
}
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
  writeFileSync(labels, JSON.stringify({ source: `${file}:1`, kind: 'weak', outcome: 'unknown', signal: 'missing_prompt_id' }));
  const weakOutput = execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', labels, file], { encoding: 'utf8' });
  assert.match(weakOutput, /weak outcomes: correct=0 wrong=0 unknown=1/);
  assert.match(weakOutput, /labeled false-high=0\/0/);
  writeFileSync(labels, JSON.stringify({ source: `${file}:1`, kind: 'weak', outcome: 'maybe', correct: 'dev_fix', signal: 'guess' }));
  assert.throws(() => execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', labels, file], { stdio: 'pipe' }), /Command failed/);
  writeFileSync(labels, [
    { source: `${file}:1`, correct: 'dev_fix' },
    { source: `${file}:1`, kind: 'weak', outcome: 'wrong', signal: 'alternate_executor' },
  ].map(JSON.stringify).join('\n'));
  assert.throws(() => execFileSync(process.execPath, ['scripts/jev-shadow-report.mjs', '--labels', labels, file], { stdio: 'pipe' }), /Duplicate label source/);
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('PASS: Jev shadow report counts, confidence bands, labels, legacy unknowns, malformed rows and CLI');

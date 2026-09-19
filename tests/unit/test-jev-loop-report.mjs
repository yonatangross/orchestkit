import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { collect, decisionHash } from '../../scripts/jev-loop-report.mjs';

const dir = mkdtempSync(join(tmpdir(), 'jev-loop-'));
const row = (extra = {}) => ({ seam: 'route', mode: 'shadow', session_id: 's', prompt_id: 'p',
  router: 'ork:auto', phase: 'paired', jev_pick: 'fix', jev_confidence: 0.9,
  incumbent_pick: 'build', agree: false, floor: 0.9, decided_by: 'incumbent', ...extra });
const source = (files, extra = {}) => ({ harness: 'claude-code', namespace: 'host-a', producer: 'ork', seam: '*', files, ...extra });
const manifest = (sources) => ({ version: 1, sources });
const write = (name, rows) => { const path = join(dir, name); writeFileSync(path, rows.map(JSON.stringify).join('\n')); return path; };
try {
  const upstream = write('hq.jsonl', [row({ router: 'hq-ext:auto', handoff_to: 'ork:auto', phase: 'handoff' })]);
  const terminal = write('ork.jsonl', [row({ phase: 'pending', incumbent_pick: null, agree: null, incumbent_pick_reason: 'not_run' }), row()]);
  const m = manifest([source([upstream], { producer: 'hq-ext' }), source([terminal])]);
  let result = collect(m);
  assert.equal(result.rows.length, 3);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.confident_wrong.length, 1);
  assert.equal(result.confident_wrong[0].router, 'ork:auto');
  assert.equal(result.confident_wrong[0].lineage.length, 3);
  assert.equal(result.typesafe_credits, 0);
  assert.equal(result.rows[2].decision_sha256, decisionHash(row()));
  assert.equal(decisionHash({ b: { y: 2, x: 1 }, a: 1 }), decisionHash({ a: 1, b: { x: 1, y: 2 } }));
  assert.notEqual(decisionHash(row()), decisionHash(row({ prompt_id: 'other' })));
  const other = write('other.jsonl', [row()]);
  assert.equal(collect(manifest([...m.sources, source([other], { harness: 'codex' })])).decisions.length, 2);
  assert.equal(collect(manifest([...m.sources, source([other], { namespace: 'host-b' })])).decisions.length, 2);
  assert.equal(collect(manifest([m.sources[0]])).confident_wrong.length, 0);
  const conflict = write('conflict.jsonl', [row({ jev_pick: 'review' })]);
  result = collect(manifest([...m.sources, source([conflict])]));
  assert.equal(result.decisions[0].join_status, 'ambiguous');
  assert.equal(result.confident_wrong.length, 0);
  const legacy = write('legacy.jsonl', [{ intent: 'fix', conf: 0.95, floor: 0.5, flag: 'shadow' },
    { intent: 'fix', conf: 0.95, floor: 0.5, flag: 'shadow' },
    { surface: 'nudge-prompt', session_id: 's', incumbent: { choice: 'x' }, answer: { confidence: 1 } }]);
  result = collect(manifest([source([legacy])]));
  assert.equal(result.decisions.length, 3);
  assert.equal(result.rows[0].join_status, 'unjoined');
  assert.equal(result.decisions[0].join_status, 'missing_identity');
  assert.equal(result.rows[2].jev_confidence, null);
  assert.equal(result.confident_wrong.length, 0);
  assert.deepEqual(result.rows[0].missing_contract, ['jev_pick', 'jev_confidence', 'incumbent_pick', 'agree', 'decided_by']);
  const cases = write('cases.jsonl', [
    row({ prompt_id: 'below', jev_confidence: 0.89 }), row({ prompt_id: 'agree', agree: true }),
    row({ prompt_id: 'unknown', agree: null }), row({ prompt_id: 'mode', mode: 'act' }),
    row({ prompt_id: 'bad', jev_confidence: '0.99' }), row({ prompt_id: 'floor', floor: null }),
    row({ prompt_id: 'failed', incumbent_pick: { status: 'failed', reason: 'timeout' }, agree: null }),
    { haiku: 'fix', jev: 'feature', jev_confidence: 0.8, threshold: 0.8, provider: 'shadow' },
    row({ seam: 'inbox', prompt_id: null }), row({ seam: 'expect', prompt_id: null })]);
  result = collect(manifest([source([cases])]));
  assert.deepEqual(result.confident_wrong.map((r) => r.seam), ['category', 'inbox', 'expect']);
  assert.deepEqual(result.rows[6].incumbent_pick, { status: 'failed', reason: 'timeout' });
  assert.equal(result.rows[6].agree, null);
  const invalid = write('invalid.jsonl', [row({ incumbent_pick: null, agree: null }),
    row({ incumbent_pick: { status: 'failed' }, agree: false })]);
  result = collect(manifest([source([invalid])]));
  assert.equal(result.complete, false);
  assert.equal(result.invalid_contracts, 2);
  assert.deepEqual(result.rows[0].contract_errors, ['null_incumbent_without_reason']);
  assert.deepEqual(result.rows[1].contract_errors, ['non_choice_incumbent_requires_null_agree']);
  assert.equal(result.confident_wrong.length, 0);
  const alias = join(dir, 'alias.jsonl'); symlinkSync(terminal, alias);
  assert.equal(collect(manifest([source([terminal, alias])])).rows.length, 2);
  assert.throws(() => collect(manifest([source([terminal]), source([alias], { harness: 'pi' })])), /Conflicting provenance/);
  assert.throws(() => collect(manifest([source([dir])])), /Expected file/);
  assert.throws(() => collect(manifest([source([terminal], { seam: 'expect' })])), /Unexpected seam/);
  assert.throws(() => collect(manifest([source(['missing'])]), dir), /ENOENT/);
  assert.equal(collect(manifest([source([], { harness: 'devin' })])).inventory[0].observed_rows, 0);
  const malformed = join(dir, 'malformed.jsonl'); writeFileSync(malformed, '{broken\n');
  const manifestPath = join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest([source([malformed])])));
  let cli = spawnSync(process.execPath, ['scripts/jev-loop-report.mjs', manifestPath], { encoding: 'utf8' });
  assert.equal(cli.status, 2); assert.equal(JSON.parse(cli.stdout).complete, false);
  writeFileSync(manifestPath, JSON.stringify(m));
  cli = spawnSync(process.execPath, ['scripts/jev-loop-report.mjs', manifestPath], { encoding: 'utf8' });
  assert.equal(cli.status, 0); assert.equal(JSON.parse(cli.stdout).confident_wrong.length, 1);
  console.log('PASS: Jev loop collection, provenance, exact joins, unknowns, export, and CLI contracts');
} finally { rmSync(dir, { recursive: true, force: true }); }

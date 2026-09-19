import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'jev-label-cli-'));
const run = (script, args) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });
try {
  const log = join(dir, 'jev-route.jsonl'), events = join(dir, 'events.jsonl'), labels = join(dir, 'labels.jsonl');
  const rows = [
    { intent: 'dev_fix', conf: 0.9, floor: 0.5, flag: 'shadow', session_id: 's', prompt_id: 'p', jev_executor: 'Skill:ork:fix-issue' },
    { intent: 'dev_fix', conf: 0.9, floor: 0.5, flag: 'shadow', session_id: 's' },
    { haiku: 'fix', jev: 'fix', jev_confidence: 0.9, threshold: 0.8, provider: 'shadow' },
  ];
  const original = rows.map(JSON.stringify).join('\n')+'\n';
  writeFileSync(log, original);
  writeFileSync(events, JSON.stringify({ type: 'executor', session_id: 's', prompt_id: 'p', executor: 'Skill:ork:implement', primary_handoff: true }));
  const output = run('scripts/jev-shadow-label.mjs', ['--events', events, log]);
  const parsed = output.trim().split('\n').map(JSON.parse);
  assert.deepEqual(parsed.map((r) => r.outcome), ['wrong', 'unknown', 'unknown']);
  assert.equal(parsed[0].source, `${log}:1`);
  assert.equal(parsed[0].signal, 'alternate_executor');
  assert.match(parsed[0].decision_sha256, /^[a-f0-9]{64}$/);
  assert.equal(parsed[1].signal, 'missing_prompt_id');
  assert.equal(parsed[2].signal, 'unsupported_seam');
  assert.ok(parsed.every((r) => r.kind === 'weak' && !('correct' in r)));
  assert.deepEqual(parsed[0].evidence, [`${events}:1`]);
  assert.equal(readFileSync(log, 'utf8'), original, 'input evidence stays immutable');
  writeFileSync(labels, output);
  const report = run('scripts/jev-shadow-report.mjs', ['--labels', labels, log]);
  assert.match(report, /weak outcomes: correct=0 wrong=1 unknown=1; above-floor wrong=1/);
  assert.match(report, /labeled false-high=0\/0/);
  assert.match(report, /route: rows=2 paired=0/);
  writeFileSync(log, [{ ...rows[0], prompt_id: 'rotated' }, ...rows.slice(1)].map(JSON.stringify).join('\n'));
  const rotated = run('scripts/jev-shadow-report.mjs', ['--labels', labels, log]);
  assert.match(rotated, /weak outcomes: correct=0 wrong=0 unknown=2/);
  assert.match(rotated, /weak snapshot mismatches=1/);

  const map = join(dir, 'map.json');
  writeFileSync(map, JSON.stringify({ ork: { dev_fix: 'Skill:ork:fix-issue' } }));
  writeFileSync(log, JSON.stringify({ ...rows[0], producer: 'ork', jev_executor: undefined }));
  const mapped = JSON.parse(run('scripts/jev-shadow-label.mjs', ['--executor-map', map, '--events', events, log]));
  assert.equal(mapped.outcome, 'wrong');
  assert.match(mapped.executor_map_sha256, /^[a-f0-9]{64}$/);
  writeFileSync(log, JSON.stringify({ ...rows[0], producer: 'hq-ext', jev_executor: undefined }));
  assert.equal(JSON.parse(run('scripts/jev-shadow-label.mjs', ['--executor-map', map, '--events', events, log])).outcome, 'unknown', 'never reuse Ork taxonomy for HQ');

  writeFileSync(log, original+'{broken\n');
  const failure = spawnSync(process.execPath, ['scripts/jev-shadow-label.mjs', log], { encoding: 'utf8' });
  assert.notEqual(failure.status, 0);
  assert.equal(failure.stdout, '', 'no partial labels on malformed evidence');
  assert.match(failure.stderr, /malformed log rows/);
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('PASS: weak-label CLI, immutable inputs, exact attribution gaps, report separation and taxonomy provenance');

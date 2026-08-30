#!/usr/bin/env node
// Verdict probes: drive each decisive hook through the REAL runner
// (plugins/ork/hooks/bin/run-hook.mjs, the same process CC spawns) at its
// hooks.json entry (dispatcher level, the way production reaches it), with a
// fixture built to trip it, and assert the VERDICT, not "did not throw".
//
// Why: #3801. stale-import-detector sat at `ok:true, 2 ms` for months while
// its grep was rejected before it ran; its unit test mocked the shell. A hook
// that computes a verdict and never produces one is invisible to every gate
// this repo had. Each probe here is a fixture that MUST produce the verdict,
// plus a control that MUST NOT, so a probe that cannot fail is itself caught.
//
// Usage: node tests/hooks/verdict-probes/run-probes.mjs [probes.json] [--only <id>]
// Env:   PLUGIN_ROOT (default plugins/ork), PROBES_KEEP=1 keeps scratch dirs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PLUGIN_ROOT = path.resolve(process.env.PLUGIN_ROOT || path.join(ROOT, 'plugins', 'ork'));
const RUNNER = path.join(PLUGIN_ROOT, 'hooks', 'bin', 'run-hook.mjs');
const specFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(HERE, 'probes.json');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;

if (!fs.existsSync(RUNNER)) {
  console.error(`FAIL: runner not found at ${RUNNER}; build the plugin first (npm run build)`);
  process.exit(2);
}

// Same classifier as run-hook.mjs classifyVerdict(); duplicated on purpose so
// this suite does not import a script with top-level side effects. If the two
// drift, the telemetry test in src/hooks/src/__tests__/bin catches the runner
// side and this file's own control probes catch this side.
function classify(result) {
  if (!result || typeof result !== 'object') return 'silent';
  const hso = result.hookSpecificOutput;
  const pd = hso && typeof hso === 'object' ? hso.permissionDecision : undefined;
  if (pd === 'deny' || pd === 'ask' || pd === 'allow' || pd === 'defer') return pd;
  if (result.continue === false) return 'block';
  if (result.decision === 'block') return 'block';
  if (hso && typeof hso === 'object' && (hso.additionalContext || hso.updatedInput)) return 'context';
  if (result.systemMessage || result.additionalContext) return 'context';
  return 'silent';
}

/** Expand a fixture file value: a string, or {repeat, times} for bulk content. */
function materialize(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.repeat === 'string') return value.repeat.repeat(value.times || 1);
  return JSON.stringify(value, null, 2) + '\n';
}

function substitute(obj, dir) {
  if (typeof obj === 'string') return obj.split('$DIR').join(dir);
  // {repeat, times} is bulk content wherever it appears: fixture files AND
  // payload fields. The first cut expanded it only for files, so file-guard
  // received an object as `content`, projected nothing and stayed silent,
  // and the probe read that as the guard's verdict. A harness defect that
  // looks exactly like the dead hook it hunts; hence the control probes.
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && typeof obj.repeat === 'string') return materialize(obj);
  if (Array.isArray(obj)) return obj.map((v) => substitute(v, dir));
  if (obj && typeof obj === 'object') { const o = {}; for (const [k, v] of Object.entries(obj)) o[k] = substitute(v, dir); return o; }
  return obj;
}

function runCase(probe, variant) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-probe.'));
  const real = fs.realpathSync(dir);
  try {
    for (const [rel, value] of Object.entries(variant.files || probe.files || {})) {
      const full = path.join(real, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, materialize(value));
    }
    const payload = substitute({
      session_id: '00000000-0000-4000-8000-000000000000',
      cwd: real,
      permission_mode: 'default',
      hook_event_name: probe.event,
      ...(variant.payload || {}),
    }, real);
    // HOME is unset on Windows; Node drops an undefined env value, and the runner's
    // homedir() falls back to USERPROFILE, so telemetry still lands. Leave as-is.
    const env = { ...process.env, CLAUDE_PROJECT_DIR: real, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, HOME: process.env.HOME };
    for (const k of Object.keys(variant.env || probe.env || {})) env[k] = (variant.env || probe.env)[k];
    for (const k of variant.unsetEnv || probe.unsetEnv || []) delete env[k];
    const t0 = Date.now();
    const r = spawnSync('node', [RUNNER, probe.hook], { input: JSON.stringify(payload), cwd: real, env, encoding: 'utf8', timeout: 20000 });
    const ms = Date.now() - t0;
    const line = String(r.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
    let result = null;
    try { result = line ? JSON.parse(line) : null; } catch { result = null; }
    // #3817: a bundle that exists but cannot be imported exits non-zero with
    // nothing on stdout and a named stderr line; report it as its own verdict
    // rather than the ambiguous `silent` a missing envelope would classify as.
    const stderrText = String(r.stderr || '');
    let verdict = r.status === null ? 'timeout' : classify(result);
    if (result === null && r.status !== null && r.status !== 0 && /exists but failed to load|bundle-error/.test(stderrText)) verdict = 'bundle-error';
    return { verdict, status: r.status, ms, reason: (result && (result.stopReason || result.hookSpecificOutput?.permissionDecisionReason || '')) || '', stderr: String(r.stderr || '').slice(0, 300) };
  } finally {
    if (process.env.PROBES_KEEP !== '1') fs.rmSync(dir, { recursive: true, force: true });
  }
}

const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
let pass = 0, fail = 0, xfail = 0;
const rows = [];
for (const probe of spec.probes) {
  if (ONLY && probe.id !== ONLY) continue;
  const trip = runCase(probe, probe.trip);
  const ctrl = runCase(probe, probe.control);
  const accepts = (expect, v) => [].concat(expect).includes(v);
  const tripOk = accepts(probe.trip.expect, trip.verdict);
  const ctrlOk = accepts(probe.control.expect, ctrl.verdict);
  rows.push({ id: probe.id, hook: probe.hook, trip: trip.verdict, ctrl: ctrl.verdict });
  if (probe.xfail) {
    // A known-dead hook: the trip is expected NOT to fire. It must still be
    // listed so the count of dead hooks is a number, not a feeling; and the
    // day it starts firing, XPASS fails the suite so the marker is removed.
    if (tripOk) { fail++; console.log(`XPASS ${probe.id}: trip=${trip.verdict} now fires; remove the xfail marker (${probe.xfail})`); }
    else { xfail++; console.log(`XFAIL ${probe.id}: trip=${trip.verdict} (known dead: ${probe.xfail})`); }
    continue;
  }
  if (tripOk && ctrlOk) { pass++; console.log(`PASS ${probe.id}: trip=${trip.verdict} control=${ctrl.verdict} (${trip.ms}/${ctrl.ms} ms)`); }
  else {
    fail++;
    console.log(`FAIL ${probe.id} [${probe.hook}]: trip=${trip.verdict} (expected ${probe.trip.expect}), control=${ctrl.verdict} (expected ${probe.control.expect})`);
    if (!tripOk) console.log(`     trip reason: ${trip.reason.slice(0, 160).replace(/\n/g, ' ')}${trip.stderr ? '\n     stderr: ' + trip.stderr.replace(/\n/g, ' ') : ''}`);
    if (probe.note) console.log(`     note: ${probe.note}`);
  }
}
console.log(`\nverdict probes: ${pass} passed, ${fail} failed, ${xfail} known-dead (${rows.length} probes)`);
if (rows.length === 0) { console.log('FAIL: no probes ran'); process.exit(2); }
process.exit(fail ? 1 : 0);

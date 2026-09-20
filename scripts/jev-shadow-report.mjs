#!/usr/bin/env node
/** Offline shadow review. Agreement is not accuracy; correctness needs labels. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const probability = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
const pick = (v) => typeof v === 'string' && v.length > 0 ? v : null;
const share = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : 'n/a';

const ROUTE_LABELS = new Set([
  'dev_fix', 'dev_build', 'dev_review', 'dev_verify', 'dev_design',
  'ops_brief', 'ops_comms', 'ops_client', 'ops_deploy', 'ops_content',
  'ops_commerce', 'ops_observability', 'ops_deps', 'ops_security_infra',
  'research', 'visual', 'session_admin', 'continuation', 'ambiguous',
]);
const CATEGORY_LABELS = new Set(['bugfix', 'feature', 'docs', 'refactor', 'infra', 'perf', 'design', 'testing']);
// src/skills/expect/scripts/jev_shadow.py: META_ACTIONS plus build_candidates().
const EXPECT_ACTION = /^(?:done|wait|scroll|press_enter|(?:click|fill|select):@e\d+)$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** Recursively sort object keys. Arrays retain their recorded order. */
export const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;

/** Immutable label binding: SHA-256 of the complete raw log row after canonical key ordering. */
export const decisionSha256 = (row) => createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');

function validLabelValue(seam, value) {
  if (!pick(value)) return false;
  if (seam === 'route') return ROUTE_LABELS.has(value);
  if (seam === 'category') return CATEGORY_LABELS.has(value);
  return EXPECT_ACTION.test(value);
}

function adjudication(row, seam, label) {
  const decisionHash = decisionSha256(row);
  if (label === undefined || label === null || (typeof label === 'object' && !Array.isArray(label) && Object.keys(label).length === 0)) {
    return { decisionHash, incumbent: null, correct: null, labelMismatch: false, invalidLabel: false };
  }
  if (typeof label !== 'object' || Array.isArray(label) || Object.hasOwn(label, 'kind') ||
      !SHA256.test(label.decision_sha256) ||
      (!Object.hasOwn(label, 'incumbent') && !Object.hasOwn(label, 'correct')) ||
      (Object.hasOwn(label, 'incumbent') && !validLabelValue(seam, label.incumbent)) ||
      (Object.hasOwn(label, 'correct') && !validLabelValue(seam, label.correct))) {
    return { decisionHash, incumbent: null, correct: null, labelMismatch: false, invalidLabel: true };
  }
  if (label.decision_sha256 !== decisionHash) {
    return { decisionHash, incumbent: null, correct: null, labelMismatch: true, invalidLabel: false };
  }
  return {
    decisionHash,
    incumbent: pick(label.incumbent),
    correct: pick(label.correct),
    labelMismatch: false,
    invalidLabel: false,
  };
}

/**
 * Validate a row that claims the six-field shadow contract. Historical rows
 * without `jev_pick` remain readable through normalize(). Structured
 * incumbent failures are allowed, but never compared as choices.
 */
export function validateLegacyShadow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || !('jev_pick' in row)) return [];
  const errors = [];
  const required = ['jev_pick', 'jev_confidence', 'incumbent_pick', 'agree', 'floor', 'decided_by'];
  for (const key of required) if (!(key in row)) errors.push(`missing:${key}`);
  if (!('jev_pick' in row)) return errors;

  const validChoice = (value) => value === null || pick(value) !== null;
  const validProbability = (value) => probability(value) !== null || value === null;
  const unknownReason = row.unknown_reason && typeof row.unknown_reason === 'object' && !Array.isArray(row.unknown_reason)
    ? row.unknown_reason : null;
  const hasUnknownReason = (key) => unknownReason !== null && pick(unknownReason[key]) !== null;
  if (!validChoice(row.jev_pick)) errors.push('invalid:jev_pick');
  if (row.jev_pick === null && row.schema_version === 1 && !hasUnknownReason('jev_pick')) errors.push('null_jev_without_reason');
  if (!validProbability(row.jev_confidence)) errors.push('invalid:jev_confidence');
  if (row.jev_confidence === null && row.schema_version === 1 && !hasUnknownReason('jev_confidence')) errors.push('null_confidence_without_reason');
  if (!validProbability(row.floor) || (row.floor === null && !(row.schema_version === 1 && hasUnknownReason('floor')))) errors.push('invalid:floor');
  if (typeof row.decided_by !== 'string' || row.decided_by.length === 0) errors.push('invalid:decided_by');
  if (typeof row.agree !== 'boolean' && row.agree !== null) errors.push('invalid:agree');

  const incumbentIsChoice = pick(row.incumbent_pick) !== null;
  const incumbentIsStructured = row.incumbent_pick !== null
    && typeof row.incumbent_pick === 'object' && !Array.isArray(row.incumbent_pick);
  if (!incumbentIsChoice && !incumbentIsStructured && row.incumbent_pick !== null) {
    errors.push('invalid:incumbent_pick');
  }
  if (row.incumbent_pick === null && !pick(row.incumbent_pick_reason) && !hasUnknownReason('incumbent_pick')) {
    errors.push('null_incumbent_without_reason');
  }
  if (!incumbentIsChoice && row.agree !== null) {
    errors.push('non_choice_incumbent_requires_null_agree');
  }
  if (pick(row.jev_pick) === null && row.agree !== null) {
    errors.push('non_choice_jev_requires_null_agree');
  }
  if (pick(row.jev_pick) !== null && incumbentIsChoice) {
    const expected = row.jev_pick === row.incumbent_pick;
    if (row.agree !== expected) errors.push('inconsistent:agree');
  }
  return errors;
}

export function normalize(row, source, label = {}) {
  if (!row || typeof row !== 'object' || row.phase === 'invoked') return null;
  let seam, jev, incumbent, confidence, floor, mode;
  const canonicalRow = ['route', 'category', 'expect'].includes(row.seam) && 'jev_pick' in row;
  if (row.phase === 'handoff' && pick(row.router) && pick(row.handoff_to)) {
    seam = 'route'; jev = null; incumbent = null; confidence = null; floor = null;
    mode = row.mode ?? 'telemetry';
  } else if (canonicalRow) {
    seam = row.seam; jev = pick(row.jev_pick); incumbent = pick(row.incumbent_pick);
    confidence = probability(row.jev_confidence); floor = probability(row.floor);
    mode = row.mode ?? row.flag ?? row.provider;
  } else if ('intent' in row && 'conf' in row) {
    seam = 'route'; jev = pick(row.intent); incumbent = pick(row.incumbent_intent);
    confidence = probability(row.conf); floor = probability(row.floor); mode = row.flag;
  } else if ('haiku' in row && 'jev' in row) {
    seam = 'category'; jev = pick(row.jev); incumbent = pick(row.haiku);
    confidence = probability(row.jev_confidence); floor = probability(row.threshold); mode = row.provider;
  } else if ('step_id' in row && ('model_action_key' in row || 'agree' in row)) {
    seam = 'expect'; jev = pick(row.jev_action); incumbent = pick(row.model_action_key);
    confidence = probability(row.jev_confidence); floor = probability(row.floor); mode = row.mode ?? 'shadow';
  } else return null;
  const labelResult = adjudication(row, seam, label);
  incumbent = labelResult.incumbent ?? incumbent;
  const correct = labelResult.correct;
  const paired = jev !== null && incumbent !== null && (!canonicalRow || typeof row.agree === 'boolean' || labelResult.incumbent !== null);
  const agree = paired ? (canonicalRow && labelResult.incumbent === null ? row.agree : jev === incumbent) : null;
  const above = confidence !== null && floor !== null && confidence >= floor;
  return { source, seam, jev, ...labelResult, incumbent, confidence, floor, mode, correct,
    sessionId: pick(row.session_id), promptId: pick(row.prompt_id),
    router: pick(row.router), handoffTo: pick(row.handoff_to),
    decisionId: pick(row.decision_id), phase: pick(row.phase), decidedBy: pick(row.decided_by),
    error: pick(row.error), paired, agree,
    highDisagreement: agree === false && above,
    below: confidence !== null && floor !== null && confidence < floor,
    falseHigh: correct !== null && jev !== null && above && jev !== correct,
    labeledHigh: correct !== null && jev !== null && above };
}

export function summarize(rows) {
  return ['route', 'expect', 'category'].map((seam) => {
    const samples = rows.filter((r) => r.seam === seam);
    const count = (fn) => samples.filter(fn).length;
    return { seam, rows: samples.length, paired: count((r) => r.paired),
      agreements: count((r) => r.agree === true), highDisagreements: count((r) => r.highDisagreement),
      highPaired: count((r) => r.paired && r.confidence !== null && r.floor !== null && r.confidence >= r.floor),
      belowFloor: count((r) => r.below), errors: count((r) => r.error !== null),
      labeledHigh: count((r) => r.labeledHigh), falseHigh: count((r) => r.falseHigh),
      unknownFloor: count((r) => r.floor === null),
      bands: [[0, 0.5], [0.5, 0.8], [0.8, 0.9], [0.9, 1]].map(([lo, hi]) => {
        const band = samples.filter((r) => r.confidence !== null && r.confidence >= lo && (hi === 1 ? r.confidence <= hi : r.confidence < hi));
        return { band: `[${lo},${hi}${hi === 1 ? ']' : ')'}`, rows: band.length,
          paired: band.filter((r) => r.paired).length, agreements: band.filter((r) => r.agree === true).length };
      }),
      examples: samples.filter((r) => r.highDisagreement).sort((a, b) => b.confidence - a.confidence).slice(0, 5),
      fallbacks: samples.filter((r) => r.error || r.below).slice(0, 3) };
  });
}

function files(path) {
  if (!statSync(path).isDirectory()) return [resolve(path)];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) => {
    const next = resolve(path, e.name);
    if (e.isDirectory()) return files(next);
    return /^(jev-route\.jsonl|session-identity\.shadow\.json|.*\.jsonl)$/.test(e.name) ? [next] : [];
  });
}

export function readRows(paths, labels = new Map()) {
  const rows = [];
  let malformed = 0, ignored = 0, invalidLabels = 0, labelMismatches = 0;
  for (const file of new Set(paths.flatMap(files))) {
    const text = readFileSync(file, 'utf8');
    // Category snapshots are a single JSON object, optionally pretty printed.
    const lines = file.endsWith('.json') ? [text] : text.split('\n');
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const source = `${file}:${index + 1}`;
      try {
        const json = line.startsWith('JEV_SHADOW|') ? line.slice(line.indexOf('|', 11) + 1) : line;
        const row = normalize(JSON.parse(json), source, labels.get(source));
        if (row) {
          rows.push(row);
          if (row.invalidLabel) invalidLabels++;
          if (row.labelMismatch) labelMismatches++;
        } else ignored++;
      } catch { malformed++; }
    });
  }
  // A shared runtime session + prompt identifies one decision across routers
  // and files. Historical rows without both IDs retain file-local revision keys.
  const decisions = new Map();
  const retained = [];
  let superseded = 0;
  for (const row of rows) {
    if (row.seam !== 'route') { retained.push(row); continue; }
    const key = row.sessionId && row.promptId
      ? JSON.stringify(['prompt', row.sessionId, row.promptId])
      : row.decisionId ? JSON.stringify(['legacy', row.source.replace(/:\d+$/, ''), row.decisionId]) : null;
    if (key === null) { retained.push(row); continue; }
    const group = decisions.get(key) ?? [];
    group.push(row);
    decisions.set(key, group);
  }
  for (const group of decisions.values()) {
    superseded += group.length - 1;
    const targets = new Set(group.map((row) => row.handoffTo).filter(Boolean));
    const candidates = group.filter((row) => !row.handoffTo && (!targets.size || targets.has(row.router)));
    const chosen = candidates.find((row) => row.phase === 'paired') ?? candidates[0];
    // A handoff is not a terminal comparison. Until its target records a row,
    // retain one unpaired prompt rather than count the upstream pick as final.
    retained.push(chosen ?? { ...group[0], paired: false, agree: null,
      highDisagreement: false, falseHigh: false, labeledHigh: false });
  }
  return { rows: retained, malformed, ignored, superseded, invalidLabels, labelMismatches };
}

export function main(args) {
  let labels = new Map(), allModes = false, confidentWrong = false;
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--labels') {
      const path = args[++i];
      if (!path) throw new Error('Missing labels file');
      const entries = readFileSync(path, 'utf8').split('\n').filter((s) => s.trim()).map((s) => {
        const row = JSON.parse(s);
        if (!pick(row.source) || Object.hasOwn(row, 'kind') || !SHA256.test(row.decision_sha256) ||
            (!Object.hasOwn(row, 'incumbent') && !Object.hasOwn(row, 'correct'))) throw new Error('Invalid adjudicated label');
        return [row.source, row];
      });
      labels = new Map(entries);
      if (labels.size !== entries.length) throw new Error('Duplicate label source');
    } else if (args[i] === '--all-modes') allModes = true;
    else if (args[i] === '--confident-wrong') confidentWrong = true;
    else if (args[i].startsWith('--')) throw new Error(`Unknown option: ${args[i]}`);
    else paths.push(args[i]);
  }
  if (!paths.length) throw new Error('Usage: node scripts/jev-shadow-report.mjs [--labels labels.jsonl] [--all-modes] FILE_OR_DIRECTORY ...');
  const input = readRows(paths, labels);
  const rows = allModes ? input.rows : input.rows.filter((r) => r.mode === 'shadow');
  if (confidentWrong) {
    for (const r of rows.filter((r) => r.highDisagreement)) {
      console.log(JSON.stringify({ seam: r.seam, source: r.source, session_id: r.sessionId,
        prompt_id: r.promptId, router: r.router, handoff_to: r.handoffTo, jev_pick: r.jev,
        jev_confidence: r.confidence, incumbent_pick: r.incumbent, agree: r.agree,
        floor: r.floor, decided_by: r.decidedBy, bucket: 'confident-wrong', outcome_label: r.correct,
        review_status: r.correct === null ? 'awaiting_adjudication' : 'labeled' }));
    }
    return;
  }
  console.log(`Jev ${allModes ? 'all-mode' : 'shadow'} report: ${rows.length} rows; malformed=${input.malformed}; ignored=${input.ignored}; invalid_labels=${input.invalidLabels}; label_mismatches=${input.labelMismatches}; excluded_modes=${input.rows.length - rows.length}; superseded=${input.superseded}`);
  console.log('Agreement is not accuracy. High-confidence disagreements need outcome labels before promotion.');
  for (const s of summarize(rows)) {
    console.log(`\n${s.seam}: rows=${s.rows} paired=${s.paired} unpaired=${s.rows - s.paired} agreement=${s.agreements}/${s.paired} (${share(s.agreements, s.paired)})`);
    console.log(`  high-confidence disagreements=${s.highDisagreements}; share_all=${share(s.highDisagreements, s.rows)}; share_high_paired=${share(s.highDisagreements, s.highPaired)}; below_floor=${s.belowFloor}; errors=${s.errors}; unknown_floor=${s.unknownFloor}`);
    console.log(`  labeled false-high=${s.falseHigh}/${s.labeledHigh} (${share(s.falseHigh, s.labeledHigh)})`);
    for (const b of s.bands) console.log(`  confidence ${b.band}: rows=${b.rows} agreement=${b.agreements}/${b.paired} (${share(b.agreements, b.paired)})`);
    for (const r of s.examples) console.log(`  disagreement ${JSON.stringify({ source: r.source, incumbent: r.incumbent, jev: r.jev, confidence: r.confidence, floor: r.floor, correct: r.correct })}`);
    for (const r of s.fallbacks) console.log(`  fallback ${JSON.stringify({ source: r.source, incumbent: r.incumbent, jev: r.jev, confidence: r.confidence, floor: r.floor, error: r.error })}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

#!/usr/bin/env node
/** Offline shadow review. Agreement is not accuracy; correctness needs labels. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const probability = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
const pick = (v) => typeof v === 'string' && v.length > 0 ? v : null;
const share = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : 'n/a';

// Sort object keys recursively so serialization order cannot invalidate evidence.
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;

export function normalize(row, source, label = {}) {
  if (!row || typeof row !== 'object') return null;
  let seam, jev, incumbent, confidence, floor, mode;
  if ('intent' in row && 'conf' in row) {
    seam = 'route'; jev = pick(row.intent); incumbent = pick(row.incumbent_intent);
    confidence = probability(row.conf); floor = probability(row.floor); mode = row.flag;
  } else if ('haiku' in row && 'jev' in row) {
    seam = 'category'; jev = pick(row.jev); incumbent = pick(row.haiku);
    confidence = probability(row.jev_confidence); floor = probability(row.threshold); mode = row.provider;
  } else if ('step_id' in row && ('model_action_key' in row || 'agree' in row)) {
    seam = 'expect'; jev = pick(row.jev_action); incumbent = pick(row.model_action_key);
    confidence = probability(row.jev_confidence); floor = probability(row.floor); mode = row.mode ?? 'shadow';
  } else return null;
  const identity = { sessionId: pick(row.session_id), promptId: pick(row.prompt_id),
    jevExecutor: pick(row.jev_executor), producer: pick(row.producer) };
  const decisionHash = createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');
  if (label.kind !== 'weak') incumbent = pick(label.incumbent) ?? incumbent;
  // Weak outcome proxies must never enter adjudicated precision counts.
  const weakMismatch = label.kind === 'weak' && label.decision_sha256 !== decisionHash;
  const weak = label.kind === 'weak' && ['correct', 'wrong', 'unknown'].includes(label.outcome) ? (weakMismatch ? 'unknown' : label.outcome) : null;
  const correct = label.kind === 'weak' ? null : pick(label.correct);
  const paired = jev !== null && incumbent !== null;
  const above = confidence !== null && floor !== null && confidence >= floor;
  return { source, seam, jev, incumbent, confidence, floor, mode, correct, weak,
    ...identity, decisionHash, weakMismatch,
    error: pick(row.error), paired, agree: paired ? jev === incumbent : null,
    highDisagreement: paired && above && jev !== incumbent,
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
      weak: Object.fromEntries(['correct', 'wrong', 'unknown'].map((value) => [value, count((r) => r.weak === value)])),
      weakHighWrong: count((r) => r.weak === 'wrong' && r.confidence !== null && r.floor !== null && r.confidence >= r.floor),
      weakMismatches: count((r) => r.weakMismatch),
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
  let malformed = 0, ignored = 0;
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
        if (row) rows.push(row); else ignored++;
      } catch { malformed++; }
    });
  }
  return { rows, malformed, ignored };
}

export function main(args) {
  let labels = new Map(), allModes = false;
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--labels') {
      const path = args[++i];
      if (!path) throw new Error('Missing labels file');
      const entries = readFileSync(path, 'utf8').split('\n').filter((s) => s.trim()).map((s) => {
        const row = JSON.parse(s);
        const validWeak = row.kind === 'weak' && ['correct', 'wrong', 'unknown'].includes(row.outcome) && pick(row.signal);
        if (!pick(row.source) || (row.kind === 'weak' ? !validWeak : !pick(row.incumbent) && !pick(row.correct))) throw new Error('Invalid label');
        return [row.source, row];
      });
      labels = new Map(entries);
      if (labels.size !== entries.length) throw new Error('Duplicate label source; adjudicated and weak sidecars must be reported separately');
    } else if (args[i] === '--all-modes') allModes = true;
    else if (args[i].startsWith('--')) throw new Error(`Unknown option: ${args[i]}`);
    else paths.push(args[i]);
  }
  if (!paths.length) throw new Error('Usage: node scripts/jev-shadow-report.mjs [--labels labels.jsonl] [--all-modes] FILE_OR_DIRECTORY ...');
  const input = readRows(paths, labels);
  const rows = allModes ? input.rows : input.rows.filter((r) => r.mode === 'shadow');
  console.log(`Jev ${allModes ? 'all-mode' : 'shadow'} report: ${rows.length} rows; malformed=${input.malformed}; ignored=${input.ignored}; excluded_modes=${input.rows.length - rows.length}`);
  console.log('Agreement is not accuracy. High-confidence disagreements need outcome labels before promotion.');
  for (const s of summarize(rows)) {
    console.log(`\n${s.seam}: rows=${s.rows} paired=${s.paired} unpaired=${s.rows - s.paired} agreement=${s.agreements}/${s.paired} (${share(s.agreements, s.paired)})`);
    console.log(`  high-confidence disagreements=${s.highDisagreements}; share_all=${share(s.highDisagreements, s.rows)}; share_high_paired=${share(s.highDisagreements, s.highPaired)}; below_floor=${s.belowFloor}; errors=${s.errors}; unknown_floor=${s.unknownFloor}`);
    console.log(`  labeled false-high=${s.falseHigh}/${s.labeledHigh} (${share(s.falseHigh, s.labeledHigh)})`);
    console.log(`  weak outcomes: correct=${s.weak.correct} wrong=${s.weak.wrong} unknown=${s.weak.unknown}; above-floor wrong=${s.weakHighWrong} (proxies, excluded from adjudicated precision)`);
    if (s.weakMismatches) console.log(`  weak snapshot mismatches=${s.weakMismatches} (treated as unknown)`);
    for (const b of s.bands) console.log(`  confidence ${b.band}: rows=${b.rows} agreement=${b.agreements}/${b.paired} (${share(b.agreements, b.paired)})`);
    for (const r of s.examples) console.log(`  disagreement ${JSON.stringify({ source: r.source, incumbent: r.incumbent, jev: r.jev, confidence: r.confidence, floor: r.floor, correct: r.correct })}`);
    for (const r of s.fallbacks) console.log(`  fallback ${JSON.stringify({ source: r.source, incumbent: r.incumbent, jev: r.jev, confidence: r.confidence, floor: r.floor, error: r.error })}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

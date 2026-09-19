#!/usr/bin/env node
/** Read explicit local snapshots only. No inference, labels, or promotion. */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { normalize, validateLegacyShadow } from './jev-shadow-report.mjs';

const string = (v) => typeof v === 'string' && v.length > 0 ? v : null;
const probability = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
export const decisionHash = (row) => createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const contract = ['jev_pick', 'jev_confidence', 'incumbent_pick', 'agree', 'floor', 'decided_by'];
const harnesses = new Set(['claude-code', 'codex', 'cursor', 'devin', 'pi', 'platform']);

function project(raw, source, spec) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.phase === 'invoked') return null;
  const n = normalize(raw, source);
  // Auxiliary Noul answers intentionally have no Choice confidence adapter.
  const auxiliary = string(raw.surface);
  const generic = string(raw.seam) && 'jev_pick' in raw;
  if (!n && !auxiliary && !generic) return null;
  const jev = n?.jev ?? (generic ? string(raw.jev_pick) : null);
  const incumbent = n?.incumbent ?? (generic ? string(raw.incumbent_pick) : null);
  const agree = n ? n.agree : generic && jev && incumbent && typeof raw.agree === 'boolean' ? raw.agree : null;
  const missing = contract.filter((k) => !(k in raw));
  const contract_errors = validateLegacyShadow(raw);
  return { harness: spec.harness, namespace: spec.namespace, producer: spec.producer,
    source, decision_sha256: decisionHash(raw), seam: n?.seam ?? raw.seam ?? `aux:${auxiliary}`,
    session_id: string(raw.session_id), prompt_id: string(raw.prompt_id), router: string(raw.router),
    handoff_to: string(raw.handoff_to), decision_id: string(raw.decision_id), phase: string(raw.phase),
    mode: n?.mode ?? raw.mode ?? raw.flag ?? null, jev_pick: jev,
    jev_confidence: n ? n.confidence : generic ? probability(raw.jev_confidence) : null,
    incumbent_pick: incumbent ?? (raw.incumbent_pick && typeof raw.incumbent_pick === 'object'
      ? raw.incumbent_pick : null),
    incumbent_pick_reason: string(raw.incumbent_pick_reason), agree,
    floor: n ? n.floor : generic ? probability(raw.floor) : null,
    decided_by: string(raw.decided_by), missing_contract: missing, contract_errors,
    join_status: 'unjoined', outcome_label: null, review_status: 'awaiting_adjudication' };
}

/** Namespace denotes one host/tenant. Different harness sessions never merge. */
function join(rows) {
  const groups = new Map(), decisions = [];
  for (const row of rows) {
    if (row.seam !== 'route' || !row.session_id || !row.prompt_id) {
      decisions.push({ ...row, join_status: row.seam === 'route' ? 'missing_identity' : 'not_applicable' });
      continue;
    }
    const key = JSON.stringify([row.namespace, row.harness, row.session_id, row.prompt_id]);
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  for (const group of groups.values()) {
    const targets = new Set(group.map((r) => r.handoff_to).filter(Boolean));
    let candidates = group.filter((r) => !r.handoff_to && r.phase !== 'pending'
      && (!targets.size || targets.has(r.router)));
    const paired = candidates.filter((r) => r.phase === 'paired');
    if (paired.length) candidates = paired;
    // Repeated identical records may be replayed; conflicting terminals stay unknown.
    const unique = [...new Map(candidates.map((r) => [r.decision_sha256, r])).values()];
    const resolved = unique.length === 1 && targets.size <= 1;
    const chosen = resolved ? unique[0] : group[0];
    decisions.push({ ...chosen, agree: resolved ? chosen.agree : null,
      join_status: resolved ? 'resolved' : candidates.length ? 'ambiguous' : 'awaiting_terminal',
      lineage: group.map((r) => ({ source: r.source, decision_sha256: r.decision_sha256, router: r.router })) });
  }
  return decisions;
}

export function collect(manifest, base = process.cwd()) {
  if (manifest.version !== 1 || !Array.isArray(manifest.sources)) throw new Error('Expected manifest version 1 and sources array');
  const rows = [], files = [], inventory = [], seen = new Map();
  let malformed = 0, ignored = 0;
  for (const spec of manifest.sources) {
    if (!harnesses.has(spec.harness) || !string(spec.namespace) || !string(spec.producer)
      || !string(spec.seam) || !Array.isArray(spec.files) || spec.files.some((p) => !string(p))) {
      throw new Error('Each source requires harness, namespace, producer, seam, and explicit files');
    }
    const start = rows.length;
    for (const path of spec.files) {
      const file = realpathSync(resolve(base, path));
      const ownership = JSON.stringify([spec.namespace, spec.harness, spec.producer, spec.seam]);
      if (seen.has(file)) {
        if (seen.get(file) !== ownership) throw new Error(`Conflicting provenance: ${file}`);
        continue;
      }
      seen.set(file, ownership);
      if (!statSync(file).isFile() || statSync(file).size > 64 * 1024 * 1024) throw new Error(`Expected file at most 64 MiB: ${file}`);
      const bytes = readFileSync(file);
      files.push({ path: file, bytes: bytes.length, sha256: digest(bytes), harness: spec.harness, producer: spec.producer });
      const lines = file.endsWith('.json') ? [bytes.toString('utf8')] : bytes.toString('utf8').split('\n');
      lines.forEach((line, index) => {
        if (!line.trim()) return;
        let raw;
        try {
          const value = line.startsWith('JEV_SHADOW|') ? line.slice(line.indexOf('|', 11) + 1) : line;
          raw = JSON.parse(value);
        } catch { malformed++; return; }
        const row = project(raw, `${file}:${index + 1}`, spec);
        if (row) {
          if (spec.seam !== '*' && row.seam !== spec.seam) throw new Error(`Unexpected seam at ${row.source}`);
          rows.push(row);
        } else ignored++;
      });
    }
    inventory.push({ harness: spec.harness, namespace: spec.namespace, producer: spec.producer,
      seam: spec.seam, observed_rows: rows.length - start, files_declared: spec.files.length });
  }
  const decisions = join(rows);
  const confident_wrong = decisions.filter((r) => !r.contract_errors.length && r.mode === 'shadow' && r.agree === false
    && r.jev_confidence !== null && r.floor !== null && r.jev_confidence >= r.floor)
    .map((r) => ({ ...r, bucket: 'confident-wrong' }));
  const summary = [...new Set(decisions.map((r) => JSON.stringify([r.harness, r.seam])))].map((key) => {
    const [harness, seam] = JSON.parse(key), samples = decisions.filter((r) => r.harness === harness && r.seam === seam);
    return { harness, seam, decisions: samples.length, paired: samples.filter((r) => typeof r.agree === 'boolean').length,
      missing_identity: samples.filter((r) => !r.prompt_id || !r.session_id).length,
      confident_wrong: confident_wrong.filter((r) => r.harness === harness && r.seam === seam).length };
  });
  const invalid_contracts = rows.filter((r) => r.contract_errors.length).length;
  return { version: 1, typesafe_credits: 0, complete: malformed === 0 && invalid_contracts === 0, malformed, ignored, invalid_contracts,
    warning: 'Agreement is not accuracy. No rows does not prove a harness is unwired. Inputs are explicit local snapshots.',
    inventory, files, summary, rows, decisions, confident_wrong };
}

export function main(args) {
  if (args.length !== 1) throw new Error('Usage: node scripts/jev-loop-report.mjs MANIFEST.json');
  const file = resolve(args[0]);
  const report = collect(JSON.parse(readFileSync(file, 'utf8')), dirname(file));
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

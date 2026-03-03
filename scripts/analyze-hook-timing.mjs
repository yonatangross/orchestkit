#!/usr/bin/env node
/**
 * analyze-hook-timing.mjs
 *
 * Reads ~/.claude/analytics/hook-timing.jsonl, groups entries by hook name,
 * and computes P50/P95/P99 for duration_ms and the pipeline stage fields
 * (t_bundle_ms, t_stdin_ms, t_exec_ms, t_track_ms).
 *
 * Usage:
 *   node scripts/analyze-hook-timing.mjs
 *   node scripts/analyze-hook-timing.mjs --hook pretool/bash/dangerous-command-blocker
 *   node scripts/analyze-hook-timing.mjs --top 10
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let filterHook = null;
let topN = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--hook' && args[i + 1]) {
    filterHook = args[++i];
  } else if (args[i] === '--top' && args[i + 1]) {
    topN = parseInt(args[++i], 10);
  }
}

// ---------------------------------------------------------------------------
// Load JSONL
// ---------------------------------------------------------------------------

const timingPath = join(homedir(), '.claude', 'analytics', 'hook-timing.jsonl');

if (!existsSync(timingPath)) {
  console.error(`No hook-timing.jsonl found at ${timingPath}`);
  console.error('Run some hooks first to generate timing data.');
  process.exit(1);
}

const lines = readFileSync(timingPath, 'utf-8')
  .split('\n')
  .filter(Boolean);

if (lines.length === 0) {
  console.error('hook-timing.jsonl is empty.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse and group
// ---------------------------------------------------------------------------

/** @type {Map<string, Array<Record<string,number|string|boolean>>>} */
const byHook = new Map();

for (const line of lines) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue; // skip malformed lines
  }

  const name = entry.hook;
  if (!name) continue;
  if (filterHook && name !== filterHook) continue;

  if (!byHook.has(name)) byHook.set(name, []);
  byHook.get(name).push(entry);
}

if (byHook.size === 0) {
  console.error(filterHook
    ? `No entries found for hook "${filterHook}".`
    : 'No valid entries found in hook-timing.jsonl.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

/**
 * Compute a percentile value from a sorted numeric array.
 * @param {number[]} sorted - Pre-sorted ascending array
 * @param {number} p - Percentile 0-100
 * @returns {number}
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Extract and sort a numeric field from a list of entries.
 * @param {Array<Record<string,any>>} entries
 * @param {string} field
 * @returns {number[]}
 */
function extractSorted(entries, field) {
  return entries
    .map(e => (typeof e[field] === 'number' ? e[field] : NaN))
    .filter(v => !isNaN(v))
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Compute stats per hook
// ---------------------------------------------------------------------------

const FIELDS = ['duration_ms', 't_bundle_ms', 't_stdin_ms', 't_exec_ms', 't_track_ms'];

/**
 * @typedef {{ p50: number, p95: number, p99: number, n: number }} Stats
 * @typedef {Record<string, Stats>} HookStats
 */

/** @type {Array<{ name: string, n: number, fields: Record<string, Stats> }>} */
const rows = [];

for (const [name, entries] of byHook) {
  const fieldStats = {};
  for (const field of FIELDS) {
    const sorted = extractSorted(entries, field);
    fieldStats[field] = {
      n: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }
  rows.push({ name, n: entries.length, fields: fieldStats });
}

// Sort by median duration descending (slowest hooks first)
rows.sort((a, b) => (b.fields.duration_ms.p50 || 0) - (a.fields.duration_ms.p50 || 0));

const displayRows = topN ? rows.slice(0, topN) : rows;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a millisecond value to a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function fmtMs(ms) {
  if (isNaN(ms)) return '   n/a';
  return ms.toFixed(2).padStart(7);
}

const COL_HOOK = 52;
const COL_N = 6;
const COL_MS = 8; // "1234.56" + space

function padR(str, len) {
  return String(str).padEnd(len);
}

function padL(str, len) {
  return String(str).padStart(len);
}

// ---------------------------------------------------------------------------
// Render table
// ---------------------------------------------------------------------------

const separator = '-'.repeat(COL_HOOK + 1 + COL_N + 1 + (COL_MS * 3) * FIELDS.length + 4);

console.log('');
console.log('OrchestKit Hook Pipeline Timing Report');
console.log(`Source: ${timingPath}`);
console.log(`Entries: ${lines.length} total, ${byHook.size} distinct hooks`);
if (filterHook) console.log(`Filter:  ${filterHook}`);
console.log('');

// Header row 1 — field group labels
const groupHeader = [
  padR('', COL_HOOK + 1 + COL_N + 1),
  ...FIELDS.map(f => padL(f, COL_MS * 3)),
].join(' ');
console.log(groupHeader);

// Header row 2 — p50/p95/p99 per field
const subHeader = [
  padR('hook', COL_HOOK),
  padL('n', COL_N),
  ...FIELDS.flatMap(() => ['p50 (ms)', 'p95 (ms)', 'p99 (ms)'].map(h => padL(h, COL_MS))),
].join(' ');
console.log(subHeader);
console.log(separator);

for (const row of displayRows) {
  const cells = [
    padR(row.name.length > COL_HOOK ? row.name.slice(0, COL_HOOK - 1) + '…' : row.name, COL_HOOK),
    padL(row.n, COL_N),
  ];
  for (const field of FIELDS) {
    const s = row.fields[field];
    if (s.n === 0) {
      cells.push(padL('n/a', COL_MS), padL('n/a', COL_MS), padL('n/a', COL_MS));
    } else {
      cells.push(
        padL(fmtMs(s.p50), COL_MS),
        padL(fmtMs(s.p95), COL_MS),
        padL(fmtMs(s.p99), COL_MS),
      );
    }
  }
  console.log(cells.join(' '));
}

console.log(separator);
console.log('');

// ---------------------------------------------------------------------------
// Summary: slowest stage per hook
// ---------------------------------------------------------------------------

console.log('Slowest pipeline stage per hook (by P95):');
console.log('');

const stageFields = ['t_bundle_ms', 't_stdin_ms', 't_exec_ms', 't_track_ms'];
const stageLabels = {
  t_bundle_ms: 'bundle-import',
  t_stdin_ms: 'stdin-parse',
  t_exec_ms: 'hook-exec',
  t_track_ms: 'tracking',
};

for (const row of displayRows) {
  let maxField = null;
  let maxP95 = -1;
  for (const f of stageFields) {
    const p95 = row.fields[f].p95;
    if (!isNaN(p95) && p95 > maxP95) {
      maxP95 = p95;
      maxField = f;
    }
  }
  if (maxField) {
    console.log(`  ${padR(row.name, COL_HOOK)}  bottleneck: ${stageLabels[maxField]} (p95=${maxP95.toFixed(2)}ms)`);
  }
}

console.log('');

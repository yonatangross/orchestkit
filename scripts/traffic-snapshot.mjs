#!/usr/bin/env node
// traffic-snapshot: append one JSONL row of weekly GitHub traffic for this
// repository to docs/traffic/snapshots.jsonl (#4071).
//
// GitHub exposes repository traffic (views, clones, popular paths, referrers)
// through a rolling 14-day window; after 14 days the numbers are gone. This
// script persists one row per measured week so the history outlives the
// window. It runs weekly from .github/workflows/traffic-snapshot.yml, which
// opens a PR carrying the new row instead of pushing to main.
//
// Fail-closed contract (#4071): the row is written only after ALL four
// endpoint reads succeeded and validated. Any failed read (non-zero gh exit,
// non-2xx response, unparseable body, missing or non-numeric required
// fields) aborts the run with exit 1 and writes NOTHING. An empty
// measurement window (zero daily buckets inside the week) is refused for the
// same reason: an all-zero row is indistinguishable from a traffic collapse.
//
// Week semantics: the run is intended for Monday 06:00 UTC and measures the
// PREVIOUS full week, [previous Monday 00:00 UTC, current Monday 00:00 UTC).
// The row's "week" key is the ISO date of that previous Monday. Popular
// paths and referrers come from GitHub with a trailing 14-day window (the
// API has no weekly variant), so the row labels them window_days: 14.
//
// Idempotency: if the output file already contains a row with the same
// "week" key, the run exits 0 without calling the API and without writing,
// so a manual re-dispatch cannot duplicate a week.
//
// Usage:
//   node scripts/traffic-snapshot.mjs [--repo OWNER/NAME] --out PATH [--now ISO-8601]
//     --repo  repository to read traffic for; default yonatangross/orchestkit
//     --now   pin the clock (UTC ISO-8601); used by tests for determinism
//
// Exit codes:
//   0  row written, or week already recorded (skip)
//   1  fail-closed abort; nothing was written

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_REPO = 'yonatangross/orchestkit';
const DAY_MS = 24 * 60 * 60 * 1000;

function die(msg) {
  console.error(`traffic-snapshot: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { repo: DEFAULT_REPO, out: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const takesValue = (name) => {
      const v = argv[i + 1];
      if (v === undefined) die(`flag ${name} needs a value`);
      i += 1;
      return v;
    };
    if (flag === '--repo') args.repo = takesValue(flag);
    else if (flag === '--out') args.out = takesValue(flag);
    else if (flag === '--now') args.now = takesValue(flag);
    else die(`unknown flag: ${flag}`);
  }
  if (!args.out) die('--out PATH is required');
  return args;
}

// --- gh reads ------------------------------------------------------------------
// Any throw, non-2xx response, or unparseable body is fatal: the caller aborts
// before writing anything.

function ghApiRaw(endpoint) {
  try {
    return execFileSync('gh', ['api', endpoint], { encoding: 'utf8' });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    die(`gh api ${endpoint} failed: ${detail}`);
  }
}

function ghApiJson(endpoint, label) {
  const raw = ghApiRaw(endpoint);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    die(`${label}: response body is not valid JSON`);
  }
  return body;
}

function requireNonNegativeInt(value, label) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    die(`${label}: expected a non-negative integer, got ${JSON.stringify(value)}`);
  }
  return value;
}

// Reads {count, uniques, <arrayKey>: [{timestamp, count, uniques}, ...]}.
function readDaily(endpoint, label, arrayKey) {
  const body = ghApiJson(endpoint, label);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    die(`${label}: expected a JSON object`);
  }
  requireNonNegativeInt(body.count, `${label}.count`);
  requireNonNegativeInt(body.uniques, `${label}.uniques`);
  if (!Array.isArray(body[arrayKey])) {
    die(`${label}: expected a "${arrayKey}" array`);
  }
  const buckets = body[arrayKey].map((b, idx) => {
    if (b === null || typeof b !== 'object') die(`${label}.${arrayKey}[${idx}]: expected an object`);
    if (typeof b.timestamp !== 'string') die(`${label}.${arrayKey}[${idx}].timestamp: expected a string`);
    const ts = new Date(b.timestamp);
    if (Number.isNaN(ts.getTime())) {
      die(`${label}.${arrayKey}[${idx}].timestamp: not a parseable timestamp`);
    }
    return {
      timestamp: ts,
      count: requireNonNegativeInt(b.count, `${label}.${arrayKey}[${idx}].count`),
      uniques: requireNonNegativeInt(b.uniques, `${label}.${arrayKey}[${idx}].uniques`),
    };
  });
  return { count: body.count, uniques: body.uniques, buckets };
}

// Reads an array of {key, count, uniques} items (popular paths or referrers).
// GitHub caps both lists at 10 items; the full list is kept as returned.
function readItems(endpoint, label, keyField, titleField) {
  const body = ghApiJson(endpoint, label);
  if (!Array.isArray(body)) die(`${label}: expected a JSON array`);
  return body.map((item, idx) => {
    if (item === null || typeof item !== 'object') die(`${label}[${idx}]: expected an object`);
    if (typeof item[keyField] !== 'string' || item[keyField] === '') {
      die(`${label}[${idx}].${keyField}: expected a non-empty string`);
    }
    if (titleField !== null && item[titleField] !== null && item[titleField] !== undefined
        && typeof item[titleField] !== 'string') {
      die(`${label}[${idx}].${titleField}: expected a string or null`);
    }
    const out = {
      [keyField]: item[keyField],
      count: requireNonNegativeInt(item.count, `${label}[${idx}].count`),
      uniques: requireNonNegativeInt(item.uniques, `${label}[${idx}].uniques`),
    };
    if (titleField !== null) out[titleField] = item[titleField] ?? '';
    return out;
  });
}

// --- week window ----------------------------------------------------------------
// [previous Monday 00:00 UTC, current Monday 00:00 UTC); the row's week key
// is the ISO date of the previous Monday.

function mondayOf(d) {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day - dow * DAY_MS);
}

function weekWindow(now) {
  const thisMonday = mondayOf(now);
  const start = new Date(thisMonday.getTime() - 7 * DAY_MS);
  return { start, end: thisMonday, weekKey: start.toISOString().slice(0, 10) };
}

// Aggregates the buckets that fall inside the window into the row shape.
function aggregate(buckets, win, label) {
  const kept = buckets
    .filter((b) => b.timestamp >= win.start && b.timestamp < win.end)
    .sort((a, b) => a.timestamp - b.timestamp);
  const days = kept.map((b) => ({
    date: b.timestamp.toISOString().slice(0, 10),
    count: b.count,
    uniques: b.uniques,
  }));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const uniques = days.reduce((sum, d) => sum + d.uniques, 0);
  if (days.length === 0) {
    die(`${label}: zero daily buckets inside the measured week [${win.weekKey}, ${win.end.toISOString().slice(0, 10)}); refusing to write an empty row`);
  }
  return { total, uniques, days_observed: days.length, days };
}

// --- idempotency -----------------------------------------------------------------
// One JSONL row per week: if a row with this week key already exists, skip.

function existingWeeks(outPath) {
  if (!existsSync(outPath)) return new Set();
  const weeks = new Set();
  for (const line of readFileSync(outPath, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      die(`${outPath}: existing file has a line that is not valid JSON; refusing to append to a corrupted ledger`);
    }
    if (row !== null && typeof row === 'object' && typeof row.week === 'string') {
      weeks.add(row.week);
    }
  }
  return weeks;
}

function emitGitHubOutput(key, value) {
  const ghOut = process.env.GITHUB_OUTPUT;
  if (!ghOut) return;
  appendFileSync(ghOut, `${key}=${value}\n`);
}

// --- main -------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));

let now = new Date();
if (args.now !== null) {
  now = new Date(args.now);
  if (Number.isNaN(now.getTime())) die(`--now: not a parseable ISO-8601 timestamp: ${args.now}`);
}

const win = weekWindow(now);

if (existingWeeks(args.out).has(win.weekKey)) {
  console.log(`traffic-snapshot: week ${win.weekKey} already recorded in ${args.out}; skipping (no API calls made)`);
  emitGitHubOutput('row', 'skipped');
  emitGitHubOutput('week', win.weekKey);
  process.exit(0);
}

const base = `repos/${args.repo}/traffic`;
const views = readDaily(`${base}/views`, 'traffic/views', 'views');
const clones = readDaily(`${base}/clones`, 'traffic/clones', 'clones');
const popularPaths = readItems(`${base}/popular/paths`, 'traffic/popular/paths', 'path', 'title');
const referrers = readItems(`${base}/popular/referrers`, 'traffic/popular/referrers', 'referrer', null);

const row = {
  week: win.weekKey,
  generated_at: now.toISOString(),
  source: 'github-traffic-api',
  views: aggregate(views.buckets, win, 'traffic/views'),
  clones: aggregate(clones.buckets, win, 'traffic/clones'),
  popular_paths: { window_days: 14, items: popularPaths },
  referrers: { window_days: 14, items: referrers },
};

mkdirSync(path.dirname(args.out), { recursive: true });
appendFileSync(args.out, `${JSON.stringify(row)}\n`);

console.log(`traffic-snapshot: wrote row for week ${win.weekKey} (${args.out}): views ${row.views.total}/${row.views.uniques}, clones ${row.clones.total}/${row.clones.uniques}`);
emitGitHubOutput('row', 'written');
emitGitHubOutput('week', win.weekKey);

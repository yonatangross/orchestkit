#!/usr/bin/env node
/**
 * Deterministic activation collector for #3922.
 *
 * Catalog files belong to the installed plugin or source checkout. Telemetry
 * belongs to consumer roots and is never inferred from the catalog location.
 * `pretool` records attempts, `start` records starts, and agent-usage records
 * stop/completion events. The streams have no stable common event id, so the
 * collector reports their counts separately and never invents unique spawns.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG_ROOT = path.resolve(HERE, '../../../agents');
const DEFAULT_NAMESPACE = 'ork';
const BUILTIN = new Set(['Explore', 'general-purpose', 'Plan', 'workflow-subagent', 'statusline-setup']);

function usage() {
  return [
    'Usage: run-activation-audit.sh [--json] [--catalog-root DIR] [--namespace PREFIX]',
    '       --telemetry-root CONSUMER_ROOT [--telemetry-root CONSUMER_ROOT ...]',
    '       [--stop-feed FILE ...] [--days N] [--end UTC_ISO8601]',
    '',
    'The default window is 30 days ending now in UTC. --end fixes the UTC end',
    'for replay. Telemetry roots are consumer projects containing',
    '.claude/logs/subagent-spawns.jsonl. Stop feeds are explicit',
    'agent-usage.jsonl paths and are reported separately from starts.',
  ].join('\n');
}

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { json: false, catalogRoot: DEFAULT_CATALOG_ROOT, namespace: DEFAULT_NAMESPACE, telemetryRoots: [], stopFeeds: [], days: 30, end: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (!['--catalog-root', '--namespace', '--telemetry-root', '--stop-feed', '--days', '--end'].includes(arg)) {
      fail(`unknown option: ${arg}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`missing value for ${arg}`);
    if (arg === '--catalog-root') options.catalogRoot = path.resolve(value);
    if (arg === '--namespace') {
      if (!/^[a-z][a-z0-9-]*$/.test(value)) fail('--namespace must be a lowercase plugin prefix without a colon');
      options.namespace = value;
    }
    if (arg === '--telemetry-root') options.telemetryRoots.push(path.resolve(value));
    if (arg === '--stop-feed') options.stopFeeds.push(path.resolve(value));
    if (arg === '--days') {
      if (!/^[1-9]\d*$/.test(value)) fail('--days must be a positive integer');
      options.days = Number(value);
    }
    if (arg === '--end') {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
        fail('--end must be an ISO-8601 UTC timestamp ending in Z');
      }
      options.end = value;
    }
  }
  return options;
}

function readCatalog(catalogRoot) {
  try {
    return fs.readdirSync(catalogRoot)
      .filter((name) => name.endsWith('.md') && !/^(README|INDEX|CONTRIBUTING)\.md$/i.test(name))
      .map((name) => name.replace(/\.md$/, ''))
      .sort();
  } catch (error) {
    fail(`catalog unreadable at ${catalogRoot}: ${error.code || error.message}`);
  }
}

function canonicalInputPath(input) {
  try {
    return fs.realpathSync(input);
  } catch {
    return path.resolve(input);
  }
}

function uniqueInputPaths(inputs) {
  const seen = new Set();
  return inputs.map(canonicalInputPath).filter((input) => {
    if (seen.has(input)) return false;
    seen.add(input);
    return true;
  });
}

function readJsonl(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return { file, state: 'empty', rows: [], malformed: 0 };
    const rows = [];
    let malformed = 0;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (!row || typeof row !== 'object' || Array.isArray(row)) malformed += 1;
        else rows.push(row);
      } catch {
        malformed += 1;
      }
    }
    return { file, state: 'ok', rows, malformed };
  } catch (error) {
    if (error.code === 'ENOENT') return { file, state: 'missing', rows: [], malformed: 0 };
    return { file, state: 'unreadable', rows: [], malformed: 0, error: error.code || error.message };
  }
}

function timestamp(row) {
  const value = row.timestamp ?? row.ts;
  if (typeof value !== 'string') return null;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
}

function normalise(name, namespace) {
  return typeof name === 'string' ? name.replace(new RegExp(`^${namespace}:`), '') : '';
}

function rawType(row) {
  return row.subagent_type ?? row.agent ?? row.agent_type ?? '';
}

function classify(name, catalog, namespace) {
  const raw = typeof name === 'string' ? name : '';
  const normal = normalise(raw, namespace);
  if (!normal) return 'unknown';
  if (raw === 'general-purpose' || normal === 'general-purpose') return 'general_purpose';
  if (BUILTIN.has(raw) || BUILTIN.has(normal)) return 'generic';
  if (catalog.has(normal)) return 'ork';
  return 'other';
}

function windowRows(feeds, start, end) {
  const rows = [];
  let malformed = 0;
  let outsideWindow = 0;
  for (const feed of feeds) {
    malformed += feed.malformed;
    for (const row of feed.rows) {
      const millis = timestamp(row);
      if (millis === null) {
        malformed += 1;
        continue;
      }
      if (millis < start || millis > end) {
        outsideWindow += 1;
        continue;
      }
      rows.push(row);
    }
  }
  return { rows, malformed, outsideWindow };
}

function feedCoverage(feeds, windowed, required) {
  const missing = feeds.filter((feed) => feed.state === 'missing' || feed.state === 'unreadable').map((feed) => feed.file);
  const empty = feeds.filter((feed) => feed.state === 'empty').map((feed) => feed.file);
  const activeRows = windowed.rows.length;
  let state = 'observed';
  if (!required || missing.length > 0) state = activeRows > 0 ? 'partial' : 'missing';
  else if (windowed.malformed > 0) state = 'partial';
  else if (empty.length > 0 || activeRows === 0) state = activeRows > 0 ? 'partial' : 'empty';
  return {
    required,
    state,
    estate_complete: false,
    estate_complete_note: 'A local feed is an observation, not proof of estate-wide coverage.',
    files: feeds.map(({ file, state, error }) => ({ file, state, ...(error ? { error } : {}) })),
    missing,
    empty,
    malformed_rows: windowed.malformed,
    outside_window_rows: windowed.outsideWindow,
    in_window_rows: activeRows,
  };
}

function catalogSkillRefs(catalog, catalogRoot, namespace) {
  const skillsRoot = path.resolve(catalogRoot, '../skills');
  const refs = Object.fromEntries([...catalog].map((name) => [name, 0]));
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name === 'SKILL.md') {
        let text = '';
        try { text = fs.readFileSync(next, 'utf8'); } catch { continue; }
        for (const name of catalog) if (text.includes(`${namespace}:${name}`)) refs[name] += 1;
      }
    }
  }
  walk(skillsRoot);
  return refs;
}

function collect(options) {
  const endIso = options.end ?? new Date().toISOString();
  const end = Date.parse(endIso);
  const start = end - options.days * 24 * 60 * 60 * 1000;
  const catalogNames = readCatalog(options.catalogRoot);
  const catalog = new Set(catalogNames);
  const telemetryRoots = uniqueInputPaths(options.telemetryRoots);
  const stopFeedPaths = uniqueInputPaths(options.stopFeeds);
  const spawnFeeds = telemetryRoots.map((root) => readJsonl(path.join(root, '.claude', 'logs', 'subagent-spawns.jsonl')));
  const stopFeeds = stopFeedPaths.map(readJsonl);
  const spawnWindow = windowRows(spawnFeeds, start, end);
  const stopWindow = windowRows(stopFeeds, start, end);
  const spawnCoverage = feedCoverage(spawnFeeds, spawnWindow, telemetryRoots.length > 0);
  const stopCoverage = feedCoverage(stopFeeds, stopWindow, stopFeedPaths.length > 0);

  const perSession = new Map();
  for (const row of spawnWindow.rows) {
    const session = typeof row.session_id === 'string' ? row.session_id : null;
    const name = normalise(rawType(row), options.namespace);
    if (!session) continue;
    if (!perSession.has(session)) perSession.set(session, new Set());
    if (catalog.has(name)) perSession.get(session).add(name);
  }
  const excludedSessions = new Set([...perSession].filter(([session, names]) => /^test-/i.test(session) || names.size > 20).map(([session]) => session));
  const spawnRows = spawnWindow.rows.filter((row) => !excludedSessions.has(row.session_id));

  const attempted = Object.fromEntries(catalogNames.map((name) => [name, 0]));
  const started = Object.fromEntries(catalogNames.map((name) => [name, 0]));
  const completed = Object.fromEntries(catalogNames.map((name) => [name, 0]));
  const totals = { attempted: 0, started: 0, completed: 0, catalog_completed: 0, unattributed_completed: 0, phantom_completed_excluded: 0, unattributed: 0, generic: 0, catalog: 0, ork: 0, general_purpose: 0, other: 0, unknown: 0 };
  let resolvedNamedStarts = 0;
  let ambiguousNamedStarts = 0;
  const intentBySessionAndName = new Map();
  const orderedSpawnRows = spawnRows.map((row, index) => ({ row, index })).sort((a, b) => timestamp(a.row) - timestamp(b.row) || a.index - b.index);
  for (const { row } of orderedSpawnRows) {
    if (row.source === 'pretool') {
      totals.attempted += 1;
      const type = rawType(row);
      if (classify(type, catalog, options.namespace) === 'ork') attempted[normalise(type, options.namespace)] += 1;
      if (typeof row.session_id === 'string' && typeof row.agent_name === 'string' && type && type !== row.agent_name) {
        const key = `${row.session_id}\u0000${row.agent_name}`;
        if (!intentBySessionAndName.has(key)) intentBySessionAndName.set(key, new Set());
        intentBySessionAndName.get(key).add(type);
      }
      continue;
    }
    if (row.source !== 'start') {
      totals.unattributed += 1;
      continue;
    }
    totals.started += 1;
    let type = rawType(row);
    const session = typeof row.session_id === 'string' ? row.session_id : '';
    const key = `${session}\u0000${type}`;
    if (session && intentBySessionAndName.has(key)) {
      const candidates = intentBySessionAndName.get(key);
      if (candidates.size === 1) {
        type = [...candidates][0];
        resolvedNamedStarts += 1;
      } else {
        ambiguousNamedStarts += 1;
      }
    }
    const bucket = classify(type, catalog, options.namespace);
    if (bucket === 'ork') {
      totals.catalog += 1;
      totals.ork += 1;
      started[normalise(type, options.namespace)] += 1;
    } else if (bucket === 'generic') totals.generic += 1;
    else if (bucket === 'general_purpose') totals.general_purpose += 1;
    else if (bucket === 'other') totals.other += 1;
    else totals.unknown += 1;
  }
  for (const row of stopWindow.rows) {
    if (row.phantom === true) {
      totals.phantom_completed_excluded += 1;
      continue;
    }
    totals.completed += 1;
    const name = normalise(rawType(row), options.namespace);
    if (!catalog.has(name)) {
      totals.unattributed_completed += 1;
      continue;
    }
    totals.catalog_completed += 1;
    completed[name] += 1;
  }

  const refs = catalogSkillRefs(catalog, options.catalogRoot, options.namespace);
  const agents = catalogNames.map((name) => ({ name, attempted: attempted[name], started: started[name], fires: started[name], completed: completed[name], skillRefs: refs[name] }));
  const observedStarts = spawnCoverage.state === 'observed';
  const zeroStarted = observedStarts ? agents.filter((agent) => agent.started === 0).map((agent) => agent.name) : [];
  const top5 = Object.values(started).sort((a, b) => b - a).slice(0, 5).reduce((sum, count) => sum + count, 0);
  const addressable = totals.catalog + totals.general_purpose;
  return {
    schema_version: 1,
    window: { start: new Date(start).toISOString(), end: new Date(end).toISOString(), days: options.days },
    catalog: { root: options.catalogRoot, namespace: options.namespace, agents: catalogNames.length },
    coverage: { spawn: spawnCoverage, stop: stopCoverage },
    totals,
    unique_spawns: null,
    unique_spawns_note: 'No stable identifier joins intent, start, and stop streams; event counts are reported separately.',
    excluded: { sessions: [...excludedSessions], rows: spawnWindow.rows.length - spawnRows.length },
    resolved_named_starts: resolvedNamedStarts,
    ambiguous_named_starts: ambiguousNamedStarts,
    addressable: { share_pct: addressable ? Math.round((totals.catalog / addressable) * 1000) / 10 : 0, ratio: totals.general_purpose ? Math.round((totals.catalog / totals.general_purpose) * 100) / 100 : null },
    agents,
    observed_zero_starts: observedStarts
      ? { available: true, estate_complete: false, names: zeroStarted }
      : { available: false, reason: 'Spawn telemetry coverage is missing, empty, or partial.', names: [] },
    conc_top5_pct: totals.ork ? Math.round((top5 / totals.ork) * 100) : 0,
  };
}

function render(report) {
  const coverage = report.coverage.spawn;
  const lines = [
    '',
    `ACTIVATION EVENTS (${report.window.start.slice(0, 10)} to ${report.window.end.slice(0, 10)} UTC)`,
    `  attempted ${report.totals.attempted} | started ${report.totals.started} | completed ${report.totals.completed} (catalog ${report.totals.catalog_completed}, unattributed ${report.totals.unattributed_completed}, phantom excluded ${report.totals.phantom_completed_excluded}) | unattributed starts ${report.totals.unattributed}`,
    `  start coverage: ${coverage.state}; roots=${coverage.files.length}, missing=${coverage.missing.length}, empty=${coverage.empty.length}, malformed=${coverage.malformed_rows}, outside-window=${coverage.outside_window_rows}`,
    `  unique spawns: unavailable (${report.unique_spawns_note})`,
    `  catalog starts ${report.totals.catalog} | general-purpose starts ${report.totals.general_purpose} | generic starts ${report.totals.generic} | other starts ${report.totals.other}`,
  ];
  if (report.resolved_named_starts || report.ambiguous_named_starts) lines.push(`  named starts: resolved ${report.resolved_named_starts}, ambiguous ${report.ambiguous_named_starts} (session plus name)`);
  if (!report.observed_zero_starts.available) lines.push('  observed zero starts: unavailable because spawn coverage is missing, empty, or partial.');
  else lines.push(`  started: ${report.agents.filter((agent) => agent.started > 0).length}/${report.agents.length} | observed zero starts: ${report.observed_zero_starts.names.length} (not an estate claim) | top-5=${report.conc_top5_pct}% of catalog starts`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

const options = parseArgs(process.argv.slice(2));
const report = collect(options);
if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else render(report);

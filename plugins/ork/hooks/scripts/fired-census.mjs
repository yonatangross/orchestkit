#!/usr/bin/env node

/**
 * Hook Fired-Census — the runtime half of the reachability story.
 *
 * validate-registry.mjs answers "is this hook WIRED?" (a static graph question).
 * It CANNOT answer "does this hook FIRE?" — and that gap is where the bugs live:
 *
 *   #2886  team-size-gate was WIRED and REACHABLE, and fired ZERO times
 *          (guarded tool_name 'Task'; the matcher sends 'Agent')
 *   #959   3 telemetry streams: wired, silent for 4 months
 *   the class: an `if:` that never matches, a matcher for a tool you never use,
 *              a guard on a field CC stopped sending, an early-return on every input
 *
 * None of those are catchable statically. They are only visible at runtime.
 *
 * THE DATA ALREADY EXISTS. run-hook.mjs has always appended one record per
 * invocation to ~/.claude/analytics/hook-timing.jsonl (fire-and-forget, after
 * stdout, hook id + duration + ok + hashed project id — no args, no content).
 * Nothing ever read it back against the registry. This script is that reader.
 *
 * Zero hot-path cost: this is an offline report. It adds NOTHING to run-hook.mjs.
 *
 * Output classes per registered hook:
 *   ALIVE     fired within the window
 *   IDLE      fired before the window but not inside it (rare events are normal)
 *   NEVER     reachable, and NOT ONE record in the entire census
 *             -> the #2886 class lives here. Advisory only; see the caveat.
 *
 * THE CAVEAT THAT MAKES THIS HONEST: the census is written by the INSTALLED
 * plugin (whatever `claude plugin` has cached), across EVERY project you run,
 * while the closure is computed from THIS working tree. So NEVER means
 * "no invocation observed from the installed build in the projects you use"
 * — NOT "this code is dead". A hook that is brand new here, or lives on a
 * genuinely rare event (WorktreeRemove), is correctly NEVER and correctly fine.
 * The report prints the installed-vs-tree version skew so the number can be
 * read in context instead of being mistaken for a verdict.
 *
 * ADVISORY ONLY — exits 0 always (unless --strict). Never auto-delete on this
 * signal; pair it with the guard/matcher read that only a human (or an agent
 * told to be adversarial) can do.
 *
 * Usage:
 *   node scripts/fired-census.mjs                # 7-day window, table
 *   node scripts/fired-census.mjs --days 30
 *   node scripts/fired-census.mjs --json
 *   node scripts/fired-census.mjs --strict       # exit 1 if any NEVER (opt-in)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hooksRoot = join(__dirname, '..');
const repoRoot = join(hooksRoot, '..', '..');
const CENSUS_PATH = join(homedir(), '.claude', 'analytics', 'hook-timing.jsonl');

/**
 * Events that legitimately idle for weeks. A hook here showing NEVER is weak
 * evidence of nothing — it usually means the event just hasn't happened.
 */
const RARE_EVENTS = new Set([
  'WorktreeCreate', 'WorktreeRemove', 'PreCompact', 'PostCompact',
  'StopFailure', 'PostToolUseFailure', 'PermissionDenied',
  'Elicitation', 'ElicitationResult', 'Setup', 'ConfigChange',
  'CwdChanged', 'FileChanged', 'TeammateIdle', 'TaskCreated', 'TaskCompleted',
  'InstructionsLoaded', 'UserPromptExpansion', 'PostToolBatch',
]);

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const strict = args.includes('--strict');
const daysIdx = args.indexOf('--days');
const WINDOW_DAYS = daysIdx !== -1 && args[daysIdx + 1] ? Number(args[daysIdx + 1]) : 7;

// ---------------------------------------------------------------------------
// Registry closure — same seeds/fan-out logic validate-registry.mjs asserts on.
// Duplicated deliberately: this script must keep working if the validator's
// internals change shape, and a wrong closure here is advisory noise, not a
// broken CI gate.
// ---------------------------------------------------------------------------

function idFromHookObj(hook) {
  if (Array.isArray(hook.args)) {
    const i = hook.args.findIndex(a => typeof a === 'string' && a.includes('run-hook.mjs'));
    if (i !== -1 && typeof hook.args[i + 1] === 'string') return hook.args[i + 1].trim();
  }
  if (typeof hook.command === 'string') {
    const m = hook.command.match(/run-hook\.mjs\s+([\w/.-]+)/);
    if (m) return m[1].trim();
  }
  return null;
}

function parseHooksJson() {
  const data = JSON.parse(readFileSync(join(hooksRoot, 'hooks.json'), 'utf-8'));
  const ids = new Map(); // id -> event
  for (const [event, groups] of Object.entries(data.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        const id = idFromHookObj(hook);
        if (id && !ids.has(id)) ids.set(id, event);
      }
    }
  }
  return ids;
}

function parseEntryFiles() {
  const entriesDir = join(hooksRoot, 'src', 'entries');
  const registered = new Set();
  for (const file of readdirSync(entriesDir).filter(f => f.endsWith('.ts'))) {
    const content = readFileSync(join(entriesDir, file), 'utf-8');
    const block = content.match(/export\s+const\s+hooks\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\n\};/);
    if (!block) continue;
    const keyRegex = /['"]([\w/.-]+)['"]\s*:/g;
    let m;
    while ((m = keyRegex.exec(block[1])) !== null) registered.add(m[1]);
  }
  return registered;
}

function markdownHookRefs(files) {
  const ids = new Set();
  const re = /run-hook\.mjs\s+([\w/.-]+)/g;
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    let m;
    while ((m = re.exec(content)) !== null) ids.add(m[1]);
  }
  return ids;
}

function agentFiles() {
  const dir = join(repoRoot, 'src', 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').map(f => join(dir, f));
}

function skillFiles() {
  const dir = join(repoRoot, 'src', 'skills');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(dir, d.name, 'SKILL.md');
    if (existsSync(p)) out.push(p);
  }
  return out;
}

/**
 * Transitive dispatcher fan-out.
 *
 * Returns { reachable, viaFanout }. The split matters enormously here:
 * run-hook.mjs records the hook id it was INVOKED with — i.e. the dispatcher.
 * Its children run in-process via ordinary imports and never touch the runner,
 * so a fan-out child is STRUCTURALLY INCAPABLE of appearing in the census.
 * Reporting those as "never fired" would be a guaranteed false positive, so
 * they are tracked separately and never accused.
 */
function dispatcherFanout(seeds, registered) {
  const reachable = new Set(seeds);
  const viaFanout = new Set();
  const queue = [...seeds].filter(id => id.includes('dispatcher'));
  const seen = new Set();
  while (queue.length > 0) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const file = join(hooksRoot, 'src', `${id}.ts`);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    const importRe = /from\s+['"](\.\.?\/[\w/.-]+)\.js['"]/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
      const resolved = normalize(join(dirname(id), m[1])).split(sep).join('/');
      if (registered.has(resolved) && !reachable.has(resolved)) {
        reachable.add(resolved);
        // Only a child NOT independently dispatched is census-invisible.
        if (!seeds.has(resolved)) viaFanout.add(resolved);
        if (resolved.includes('dispatcher')) queue.push(resolved);
      }
    }
  }
  return { reachable, viaFanout };
}

// ---------------------------------------------------------------------------
// Census — streamed line-by-line: the file is unbounded and long-lived
// (1.4MB / 7k records after 4 months). Never read it whole into memory.
// ---------------------------------------------------------------------------

async function readCensus(cutoffMs) {
  const stats = new Map(); // hook -> { total, inWindow, lastSeen, okFails }
  if (!existsSync(CENSUS_PATH)) return { stats, present: false, lines: 0, bad: 0 };
  let lines = 0;
  let bad = 0;
  const rl = createInterface({ input: createReadStream(CENSUS_PATH, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    lines++;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      bad++;
      continue;
    }
    const hook = rec.hook;
    if (typeof hook !== 'string') { bad++; continue; }
    const t = Date.parse(rec.ts ?? '');
    const cur = stats.get(hook) ?? { total: 0, inWindow: 0, lastSeen: null, failures: 0 };
    cur.total++;
    if (rec.ok === false) cur.failures++;
    if (!Number.isNaN(t)) {
      if (cur.lastSeen === null || t > cur.lastSeen) cur.lastSeen = t;
      if (t >= cutoffMs) cur.inWindow++;
    }
    stats.set(hook, cur);
  }
  return { stats, present: true, lines, bad };
}

// ---------------------------------------------------------------------------

function classify(s, censusPresent, isFanoutChild) {
  if (s?.inWindow > 0) return 'ALIVE';
  if (s?.total > 0) return 'IDLE';
  // A dispatcher child runs in-process and never passes through run-hook.mjs,
  // so it CANNOT be observed. Absence is not evidence — say so explicitly.
  if (isFanoutChild) return 'UNOBSERVABLE';
  if (!censusPresent) return 'NEVER';
  return 'NEVER';
}

/**
 * Read the installed plugin versions that actually wrote the census. The
 * closure comes from this working tree; the census comes from whatever build
 * CC has cached. Reporting the skew is what keeps NEVER honest.
 */
function installedVersions() {
  const cacheDir = join(homedir(), '.claude', 'plugins', 'cache', 'orchestkit', 'ork');
  if (!existsSync(cacheDir)) return [];
  try {
    return readdirSync(cacheDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^\d+\.\d+\.\d+/.test(e.name))
      .map(e => e.name)
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
        return 0;
      });
  } catch {
    return [];
  }
}

/** This tree's version, for the skew line. */
function treeVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function daysAgo(ms, now) {
  if (ms === null) return null;
  return Math.floor((now - ms) / 86400000);
}

async function main() {
  const now = Date.now();
  const cutoff = now - WINDOW_DAYS * 86400000;

  const directIds = parseHooksJson();
  const registered = parseEntryFiles();
  const agentIds = markdownHookRefs(agentFiles());
  const skillIds = markdownHookRefs(skillFiles());
  const seeds = new Set([...directIds.keys(), ...agentIds, ...skillIds]);
  const { reachable: closure, viaFanout } = dispatcherFanout(seeds, registered);

  const { stats, present, lines, bad } = await readCensus(cutoff);

  const rows = [];
  for (const id of [...closure].sort()) {
    const s = stats.get(id);
    rows.push({
      hook: id,
      event: directIds.get(id) ?? (agentIds.has(id) ? 'agent-scoped' : skillIds.has(id) ? 'skill-scoped' : 'fan-out'),
      observable: !viaFanout.has(id),
      status: classify(s, present, viaFanout.has(id)),
      fires_window: s?.inWindow ?? 0,
      fires_total: s?.total ?? 0,
      failures: s?.failures ?? 0,
      last_seen_days: daysAgo(s?.lastSeen ?? null, now),
    });
  }

  // Hooks that fired but are NOT in the current closure — the installed plugin
  // is a different (usually older) build than this working tree, so this is
  // informational, not an error. It is also how you spot a hook that WAS live
  // and got removed: it shows up here with real fire counts.
  const ghostFires = [...stats.keys()].filter(h => !closure.has(h)).sort();

  const never = rows.filter(r => r.status === 'NEVER');
  const unobservable = rows.filter(r => r.status === 'UNOBSERVABLE');
  const idle = rows.filter(r => r.status === 'IDLE');
  const alive = rows.filter(r => r.status === 'ALIVE');
  const installed = installedVersions();
  const tree = treeVersion();
  const skewed = installed.length > 0 && !installed.includes(tree);

  if (asJson) {
    console.log(JSON.stringify({
      window_days: WINDOW_DAYS,
      census: { path: CENSUS_PATH, present, records: lines, unparseable: bad },
      versions: { tree, installed, skewed },
      totals: { reachable: rows.length, alive: alive.length, idle: idle.length, never: never.length, unobservable: unobservable.length },
      rows,
      fired_but_not_in_closure: ghostFires,
    }, null, 2));
    process.exit(strict && never.length > 0 ? 1 : 0);
  }

  console.log('Hook Fired-Census (runtime reachability)');
  console.log('========================================');
  if (!present) {
    console.log(`census: ABSENT at ${CENSUS_PATH}`);
    console.log('Nothing has been recorded yet — run some sessions with the installed plugin first.');
    process.exit(0);
  }
  console.log(`census      : ${CENSUS_PATH}`);
  console.log(`records     : ${lines}${bad ? ` (${bad} unparseable)` : ''}`);
  console.log(`window      : last ${WINDOW_DAYS} day(s)`);
  console.log(`reachable   : ${rows.length} hooks (hooks.json + frontmatter + dispatcher fan-out)`);
  console.log(`tree version: ${tree}`);
  console.log(`installed   : ${installed.length ? installed.join(', ') : '(none found)'}${skewed ? '   <-- SKEW' : ''}`);
  console.log('');
  console.log(`  ALIVE  ${String(alive.length).padStart(3)}  fired in the window`);
  console.log(`  IDLE   ${String(idle.length).padStart(3)}  fired earlier, not in the window`);
  console.log(`  NEVER  ${String(never.length).padStart(3)}  dispatched directly, yet no record in the entire census`);
  console.log(`  N/A    ${String(unobservable.length).padStart(3)}  UNOBSERVABLE — dispatcher children run in-process and never`);
  console.log(`              reach run-hook.mjs, so the census cannot see them`);
  console.log('');

  if (skewed) {
    console.log(`!! VERSION SKEW: this tree is ${tree}; the census was written by ${installed.join('/')}.`);
    console.log(`   Hooks added after ${installed[installed.length - 1]} CANNOT appear — they were never`);
    console.log(`   installed. Read NEVER as "not observed from the installed build", not "dead".`);
    console.log('');
  }

  if (never.length > 0) {
    // 176 undifferentiated rows is noise nobody acts on. Split "explainable"
    // from "suspicious" so the list that survives is short enough to READ.
    const suspicious = never.filter(r => !RARE_EVENTS.has(r.event) && !r.event.endsWith('-scoped') && r.event !== 'fan-out');
    const explainable = never.filter(r => RARE_EVENTS.has(r.event) || r.event.endsWith('-scoped') || r.event === 'fan-out');

    console.log(`NEVER — reachable, zero observed invocations (${never.length} total):`);
    console.log('');
    console.log(`  ${explainable.length} EXPLAINABLE — rare events + agent/skill-scoped hooks that only fire`);
    console.log(`     inside a specific agent or skill. Absence here is weak evidence.`);
    console.log('');
    if (suspicious.length > 0) {
      console.log(`  ${suspicious.length} WORTH A LOOK — on common events, yet never observed:`);
      const byEvent = new Map();
      for (const r of suspicious) {
        if (!byEvent.has(r.event)) byEvent.set(r.event, []);
        byEvent.get(r.event).push(r.hook);
      }
      for (const [event, hooks] of [...byEvent].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`     [${event}] ${hooks.length}`);
        for (const h of hooks.slice(0, 6)) console.log(`        ${h}`);
        if (hooks.length > 6) console.log(`        ... +${hooks.length - 6} more`);
      }
      console.log('');
    }
    console.log('  ADVISORY, NOT A VERDICT. Innocent explanations, check them first:');
    if (skewed) console.log('    1. VERSION SKEW (above) — most of this list is just "not installed yet"');
    console.log(`    ${skewed ? 2 : 1}. a genuinely rare event (WorktreeRemove, PreCompact, StopFailure)`);
    console.log(`    ${skewed ? 3 : 2}. an \`if:\` gate that legitimately rarely matches`);
    console.log(`    ${skewed ? 4 : 3}. a hook scoped to an agent/skill you rarely invoke`);
    console.log('  The guilty case — a guard that can NEVER match (the #2886 class) — looks');
    console.log('  identical from here. Read the guard before concluding. Never auto-delete.');
    console.log('');
    console.log('  TIP: the signal sharpens once the installed build matches this tree and');
    console.log('       a few days of sessions accumulate. Re-run with --days 30.');
    console.log('');
  }

  if (idle.length > 0) {
    console.log('IDLE — last fired outside the window:');
    for (const r of idle.sort((a, b) => (a.last_seen_days ?? 0) - (b.last_seen_days ?? 0))) {
      console.log(`  ${String(r.last_seen_days).padStart(4)}d ago  ${r.hook}  (${r.fires_total} lifetime)`);
    }
    console.log('');
  }

  if (ghostFires.length > 0) {
    console.log(`FIRED BUT NOT IN THIS TREE'S CLOSURE (${ghostFires.length}) — the census reflects the`);
    console.log(`INSTALLED plugin, which may be an older build than this checkout:`);
    for (const h of ghostFires) {
      const s = stats.get(h);
      console.log(`  ${h}  (${s.total} lifetime, last ${daysAgo(s.lastSeen, now)}d ago)`);
    }
    console.log('');
  }

  const top = alive.sort((a, b) => b.fires_window - a.fires_window).slice(0, 10);
  if (top.length > 0) {
    console.log(`Top ${top.length} by fires in window:`);
    for (const r of top) console.log(`  ${String(r.fires_window).padStart(5)}  ${r.hook}`);
    console.log('');
  }

  if (strict && never.length > 0) {
    console.log(`Result: FAIL (--strict: ${never.length} NEVER-fired hook(s))`);
    process.exit(1);
  }
  console.log(`Result: ADVISORY (${alive.length} alive, ${idle.length} idle, ${never.length} never) — exits 0 by design`);
  process.exit(0);
}

main().catch(err => {
  // Never let a report break anything.
  console.error(`fired-census: ${err.message}`);
  process.exit(0);
});

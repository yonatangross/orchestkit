#!/usr/bin/env node
/**
 * platform-release-watch.mjs -- Pull the Claude Platform release notes, snapshot
 * new dated entries, emit a gap report. Sibling of cc-release-watch.mjs.
 *
 * Pure Node, no LLM. Run by .github/workflows/claude-release-watch.yml + manually.
 *
 * Why a second watcher (#3627): cc-release-watch.mjs polls exactly one feed, the
 * CC CLI CHANGELOG. Platform-side GA events (Skills API, Files API, browser and
 * computer toolsets, 2026-08-19) were structurally invisible to it and were only
 * noticed via a tweet. This watcher closes that blind spot.
 *
 * Inputs:
 *   - upstream: https://platform.claude.com/docs/en/release-notes/overview.md
 *               (the docs page serves clean markdown at the .md suffix:
 *               `### <Month> <D>, <YYYY>` headings with `*` bullets)
 *   - state:    shared/platform-snapshots/<YYYY-MM-DD>.md (processed dates;
 *               snapshot presence on disk is the single source of truth, same
 *               decision as cc-release-watch.mjs)
 *   - config:   shared/platform-support.json { "watch_since": "YYYY-MM-DD" }
 *               Dates strictly before watch_since are ignored entirely, so the
 *               first run does not snapshot years of history.
 *
 * Outputs:
 *   - shared/platform-snapshots/<YYYY-MM-DD>.md (per new date, raw bullets)
 *   - shared/platform-adoption-gaps.json (rolling list of dates awaiting triage)
 *   - GITHUB_OUTPUT: platform_new=true + platform_new_dates=... when new dates land
 *
 * Probe hygiene (#3627 acceptance criteria): a fetch failure or a page that
 * parses to ZERO dated headings exits 1 (could-not-observe), never "nothing
 * new". Silence from this instrument must never read as coverage.
 *
 * Issue: #3627
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_DIR = join(ROOT, 'shared/platform-snapshots');
const GAPS_PATH = join(ROOT, 'shared/platform-adoption-gaps.json');
const SUPPORT_PATH = join(ROOT, 'shared/platform-support.json');

const NOTES_URL = 'https://platform.claude.com/docs/en/release-notes/overview.md';
const FIXTURE_PATH = process.env.PLATFORM_RELEASE_WATCH_FIXTURE; // for tests

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

async function fetchNotes() {
  if (FIXTURE_PATH) {
    if (!existsSync(FIXTURE_PATH)) {
      console.error(`fixture not found: ${FIXTURE_PATH}`);
      process.exit(1);
    }
    return readFileSync(FIXTURE_PATH, 'utf8');
  }
  // Network errors (DNS, TLS, timeouts) exit 1 with a clean line, not an
  // uncaught-rejection stack: could-not-observe must be loud but legible.
  let res;
  try {
    res = await fetch(NOTES_URL, { headers: { 'user-agent': 'orchestkit-platform-release-watch' } });
  } catch (err) {
    console.error(`platform-release-watch: fetch failed for ${NOTES_URL}: ${err.cause?.message || err.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`platform-release-watch: fetch failed: HTTP ${res.status} for ${NOTES_URL}`);
    process.exit(1);
  }
  return await res.text();
}

// Heading shape observed 2026-08-21: `### August 19, 2026`. Anything else at
// `###` depth is ignored but counted, so a format drift is visible in the log.
const DATE_HEADING_RE = /^### +([A-Za-z]+) +(\d{1,2}), +(\d{4}) *$/;

function toIsoDate(monthName, day, year) {
  const m = MONTHS[monthName.toLowerCase()];
  if (!m) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeBullets(text) {
  // The page uses `* ` bullets; downstream conventions (snapshots, triage
  // bullet counting) expect `- `. Normalize top-level and indented bullets.
  return text.replace(/^(\s*)\* /gm, '$1- ');
}

// Parse the markdown into [{date, body}], newest-first as served. A `###` line
// that is not a date heading closes the current section without opening one, so
// prose under a non-date heading is never misattributed to the previous date.
function parseEntries(markdown) {
  const lines = markdown.split('\n');
  const entries = [];
  let current = null;
  let ignoredHeadings = 0;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current) {
        entries.push({ date: current.date, body: normalizeBullets(current.buf.join('\n').trim()) });
        current = null;
      }
      const m = line.match(DATE_HEADING_RE);
      const iso = m ? toIsoDate(m[1], Number(m[2]), Number(m[3])) : null;
      if (iso) {
        current = { date: iso, buf: [] };
      } else {
        ignoredHeadings++;
      }
      continue;
    }
    if (current) current.buf.push(line);
  }
  if (current) {
    entries.push({ date: current.date, body: normalizeBullets(current.buf.join('\n').trim()) });
  }
  if (ignoredHeadings > 0) {
    console.log(`platform-release-watch: ignored ${ignoredHeadings} non-date ### heading(s)`);
  }
  return entries;
}

function readWatchSince() {
  // Missing or malformed config disables the cutoff (process everything),
  // mirroring cc-triage's readSupportedFloor null-means-do-not-filter posture.
  if (!existsSync(SUPPORT_PATH)) return null;
  try {
    const cfg = JSON.parse(readFileSync(SUPPORT_PATH, 'utf8'));
    const since = cfg?.watch_since;
    if (typeof since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(since)) return null;
    return since;
  } catch {
    return null;
  }
}

function countBullets(body) {
  return body.split('\n').filter((l) => l.trim().startsWith('-')).length;
}

async function main() {
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const watchSince = readWatchSince();
  if (watchSince) {
    console.log(`platform-release-watch: watch_since = ${watchSince} (older dates ignored)`);
  } else {
    console.log('platform-release-watch: no watch_since configured; processing all dates');
  }

  const markdown = await fetchNotes();
  const allEntries = parseEntries(markdown);
  console.log(`platform-release-watch: parsed ${allEntries.length} dated entr(ies)`);

  if (allEntries.length === 0) {
    // Could-not-observe, not nothing-new. A page format change must fail loud.
    console.error('platform-release-watch: zero dated headings parsed; page format may have changed.');
    process.exit(1);
  }

  const entries = watchSince ? allEntries.filter((e) => e.date >= watchSince) : allEntries;

  const snapshotted = new Set(
    readdirSync(SNAPSHOT_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => f.replace(/\.md$/, '')),
  );

  const newEntries = entries
    .filter((e) => !snapshotted.has(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Carry forward pending gap entries (no issues_filed_at yet), mirroring the
  // cc-release-watch straggler-preservation logic (#2084 class).
  const existingGaps = (() => {
    if (!existsSync(GAPS_PATH)) return [];
    try {
      const g = JSON.parse(readFileSync(GAPS_PATH, 'utf8'));
      return Array.isArray(g) ? g : [];
    } catch {
      return [];
    }
  })();
  const newDateSet = new Set(newEntries.map((e) => e.date));
  const carriedPending = existingGaps.filter(
    (e) => e?.date && !newDateSet.has(e.date) && !e.issues_filed_at,
  );

  if (newEntries.length === 0) {
    if (carriedPending.length > 0) {
      writeFileSync(GAPS_PATH, JSON.stringify(carriedPending, null, 2) + '\n');
      console.log(`platform-release-watch: nothing new; preserved ${carriedPending.length} pending entr(ies).`);
    } else {
      if (existsSync(GAPS_PATH)) writeFileSync(GAPS_PATH, '[]\n');
      console.log('platform-release-watch: nothing new.');
    }
    return;
  }

  console.log(`platform-release-watch: ${newEntries.length} new date(s): ${newEntries.map((e) => e.date).join(', ')}`);

  for (const e of newEntries) {
    const snapPath = join(SNAPSHOT_DIR, `${e.date}.md`);
    writeFileSync(snapPath, `# Claude Platform release notes ${e.date}\n\nSource: ${NOTES_URL}\n\n${e.body}\n`);
    console.log(`  wrote ${snapPath}`);
  }

  const gaps = newEntries.map((e) => ({
    date: e.date,
    source: 'platform',
    features: [],
    raw_bullets_count: countBullets(e.body),
  }));
  const allGaps = [...gaps, ...carriedPending];
  writeFileSync(GAPS_PATH, JSON.stringify(allGaps, null, 2) + '\n');
  console.log(`  wrote ${GAPS_PATH} (${gaps.length} new + ${carriedPending.length} carried pending)`);

  if (process.env.GITHUB_OUTPUT) {
    try {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `platform_new=true\nplatform_new_dates=${newEntries.map((e) => e.date).join(',')}\n`,
      );
    } catch (err) {
      console.error(`platform-release-watch: could not write GITHUB_OUTPUT: ${err.message}`);
    }
  }

  console.log('platform-release-watch: done.');
}

await main();

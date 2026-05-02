#!/usr/bin/env node
/**
 * cc-release-watch.mjs — Pull CC CHANGELOG.md, snapshot new versions, emit gap report.
 *
 * Pure Node, no LLM. Run by .github/workflows/cc-release-watch.yml + manually for testing.
 *
 * Inputs:
 *   - upstream: anthropics/claude-code/CHANGELOG.md (via gh api)
 *   - state:    shared/cc-snapshots/<version>.md (already-snapshotted versions)
 *   - state:    shared/cc-support.json (current floor)
 *
 * Outputs:
 *   - shared/cc-snapshots/<version>.md (per new version, raw bullets only)
 *   - shared/cc-adoption-gaps.json     (rolling list of unseen versions awaiting triage)
 *   - shared/gh-issue-args.json        (pre-computed milestone title for the workflow filer)
 *
 * Exit 0 on success (even when no new versions found). Exit 1 only on real fetch/parse error.
 *
 * Issue: #1486 (M130)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_DIR = join(ROOT, 'shared/cc-snapshots');
const GAPS_PATH = join(ROOT, 'shared/cc-adoption-gaps.json');
const SUPPORT_PATH = join(ROOT, 'shared/cc-support.json');
const ISSUE_ARGS_PATH = join(ROOT, 'shared/gh-issue-args.json');

const FIXTURE_PATH = process.env.CC_RELEASE_WATCH_FIXTURE; // for tests

function fetchChangelog() {
  if (FIXTURE_PATH) {
    if (!existsSync(FIXTURE_PATH)) {
      console.error(`fixture not found: ${FIXTURE_PATH}`);
      process.exit(1);
    }
    return readFileSync(FIXTURE_PATH, 'utf8');
  }
  // Real: fetch via gh api so we re-use the workflow's GITHUB_TOKEN.
  const cmd = 'gh api repos/anthropics/claude-code/contents/CHANGELOG.md --jq .content';
  const b64 = execSync(cmd, { encoding: 'utf8' }).trim();
  return Buffer.from(b64, 'base64').toString('utf8');
}

function parseVersions(changelog) {
  // Split-based parser. Earlier regex `(?=^## ...|$(?![\s\S]))` had subtle
  // end-of-input edge cases (last version body could capture short / wrong);
  // splitting on the heading is straightforward and well-defined.
  //
  // Algorithm: split on lines that look like `## X.Y.Z`. Discard the preamble
  // before the first heading. Each chunk's first line is the heading body
  // (already version-only because we capture inside split), the rest is body.
  // Walk forward through headings. For each heading found, the previous
  // pending version's body runs from its start to this heading's start.
  // The final pending version's body runs to end-of-input.
  const versions = [];
  const re = /^## (\d+\.\d+\.\d+)\s*$/gm;
  let match;
  let pendingVersion = null;
  let pendingStart = -1;
  while ((match = re.exec(changelog)) !== null) {
    const version = match[1];
    const headingEnd = match.index + match[0].length;
    if (pendingVersion !== null) {
      const body = changelog.slice(pendingStart, match.index).trim();
      versions.push({ version: pendingVersion, body });
    }
    pendingVersion = version;
    pendingStart = headingEnd;
  }
  if (pendingVersion !== null) {
    const body = changelog.slice(pendingStart).trim();
    versions.push({ version: pendingVersion, body });
  }
  return versions;
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function main() {
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const support = existsSync(SUPPORT_PATH) ? JSON.parse(readFileSync(SUPPORT_PATH, 'utf8')) : {};
  const knownLatest = support.latest || '0.0.0';

  console.log(`cc-release-watch: known latest = ${knownLatest}`);

  const changelog = fetchChangelog();
  const versions = parseVersions(changelog);
  console.log(`cc-release-watch: parsed ${versions.length} versions from CHANGELOG.md`);

  if (versions.length === 0) {
    console.error('No versions parsed — CHANGELOG.md format may have changed.');
    process.exit(1);
  }

  // Already-snapshotted versions = files in SNAPSHOT_DIR that match X.Y.Z.md.
  const snapshotted = new Set(
    readdirSync(SNAPSHOT_DIR)
      .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f))
      .map((f) => f.replace(/\.md$/, '')),
  );

  // Take any version (a) newer than the known floor OR (b) at-or-newer than
  // the floor but NOT yet snapshotted on disk. The latter recovers from a
  // race where `cc-support.json.latest` advanced (via the bump workflow)
  // before its snapshot file landed — without this the watcher would silently
  // never re-create the missing snapshot.
  const newVersions = versions
    .filter((v) => {
      if (snapshotted.has(v.version)) return false;
      const cmp = compareSemver(v.version, knownLatest);
      return cmp > 0 || cmp === 0;
    })
    .sort((a, b) => compareSemver(a.version, b.version));

  if (newVersions.length === 0) {
    console.log('cc-release-watch: nothing new.');
    // Clear stale gaps file so re-runs are deterministic.
    if (existsSync(GAPS_PATH)) writeFileSync(GAPS_PATH, '[]\n');
    process.exit(0);
  }

  console.log(`cc-release-watch: ${newVersions.length} new version(s): ${newVersions.map((v) => v.version).join(', ')}`);

  // Write per-version snapshot files.
  for (const v of newVersions) {
    const snapPath = join(SNAPSHOT_DIR, `${v.version}.md`);
    writeFileSync(snapPath, `# Claude Code ${v.version}\n\nCaptured: ${new Date().toISOString()}\n\n${v.body}\n`);
    console.log(`  wrote ${snapPath}`);
  }

  // Emit a gaps file with version-level entries — populated further by cc-triage.mjs (Part A LLM step).
  // If triage is skipped (no LLM token), the workflow's fallback step files a generic manual-triage issue.
  const gaps = newVersions.map((v) => ({
    version: v.version,
    parse_failed: false,
    features: [], // filled in by triage; if empty after triage, a manual-triage issue is filed by the workflow
    raw_bullets_count: v.body.split('\n').filter((l) => l.trim().startsWith('-')).length,
  }));
  writeFileSync(GAPS_PATH, JSON.stringify(gaps, null, 2) + '\n');
  console.log(`  wrote ${GAPS_PATH} (${gaps.length} version entries)`);

  // Pre-compute milestone title for the workflow's filer step.
  // Latest new version drives the milestone name: "M{auto} — CC X.Y.Z adoption".
  // The workflow itself decides the M-number (or auto-creates).
  const latestNew = newVersions[newVersions.length - 1].version;
  const milestoneTitle = `CC ${latestNew} adoption`;
  writeFileSync(ISSUE_ARGS_PATH, JSON.stringify({ milestone: milestoneTitle, latest_new_version: latestNew }, null, 2) + '\n');
  console.log(`  wrote ${ISSUE_ARGS_PATH} (milestone="${milestoneTitle}")`);

  console.log('cc-release-watch: done.');
}

main();

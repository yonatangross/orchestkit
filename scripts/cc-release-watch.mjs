#!/usr/bin/env node
/**
 * cc-release-watch.mjs — Pull CC CHANGELOG.md, snapshot new versions, emit gap report.
 *
 * Pure Node, no LLM. Run by .github/workflows/claude-release-watch.yml + manually for testing.
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

function parseReissueFlag(argv) {
  // `--reissue-existing X.Y.Z` or `--reissue-existing X.Y.Z,X.Y.Z2`.
  // Either `--reissue-existing=val` or `--reissue-existing val` form is supported.
  // Versions that match no parsed CHANGELOG entry are silently dropped (logged once).
  const out = new Set();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let raw = null;
    if (arg === '--reissue-existing' && i + 1 < argv.length) {
      raw = argv[i + 1];
      i++;
    } else if (arg.startsWith('--reissue-existing=')) {
      raw = arg.slice('--reissue-existing='.length);
    }
    if (raw === null) continue;
    for (const v of raw.split(',')) {
      const trimmed = v.trim();
      if (/^\d+\.\d+\.\d+$/.test(trimmed)) out.add(trimmed);
    }
  }
  return out;
}

const REISSUE_VERSIONS = parseReissueFlag(process.argv.slice(2));

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

function normalizeBullets(text) {
  // Collapse repeated `- ` prefixes (e.g. `- - Added foo`) to a single `- `.
  // Upstream CHANGELOG occasionally ships this typo (seen in CC 2.1.126);
  // without normalization the bullet count is off and the LLM triage prompt
  // can emit non-JSON when given malformed bullet lists.
  return text.replace(/^(- )+/gm, '- ');
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
      const body = normalizeBullets(changelog.slice(pendingStart, match.index).trim());
      versions.push({ version: pendingVersion, body });
    }
    pendingVersion = version;
    pendingStart = headingEnd;
  }
  if (pendingVersion !== null) {
    const body = normalizeBullets(changelog.slice(pendingStart).trim());
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
  if (REISSUE_VERSIONS.size > 0) {
    console.log(`cc-release-watch: --reissue-existing = ${[...REISSUE_VERSIONS].join(', ')}`);
  }
  const reissueSet = REISSUE_VERSIONS;

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

  // Take ANY version that's not yet snapshotted on disk, regardless of its
  // relation to `knownLatest`. The earlier `cmp >= 0` filter dropped versions
  // that were older than the known floor but missing on disk, producing a
  // "permanently invisible" failure mode: if `cc-support.json.latest` jumped
  // past 2.1.133/134 to 2.1.135 without those intermediate snapshots landing
  // (race with the bump workflow), the watcher would skip them on every
  // subsequent run forever. Snapshot presence on disk is the single source
  // of truth for "have we processed this version" — comparing against the
  // floor is redundant and actively harmful.
  //
  // Versions in `--reissue-existing` bypass the snapshotted check too, so a
  // human can recover from a botched gaps file without re-fetching.
  const newVersions = versions
    .filter((v) => reissueSet.has(v.version) || !snapshotted.has(v.version))
    .sort((a, b) => compareSemver(a.version, b.version));

  // Carry forward every existing entry that still represents PENDING work:
  //   1. STUCK entries (parse_failed === true) awaiting `cc-triage --retry-failed`.
  //   2. TRIAGED-but-unfiled entries — features[] populated but the filer
  //      (cc-file-adoption-issues.sh) has not yet stamped `issues_filed_at`.
  // The old `parse_failed === true`-only filter silently wiped class 2 on the
  // next watch run, which is the #2084 straggler class: triage populated the
  // 2.1.153/154 features, the filer died/rate-limited before creating the
  // issues, and the next run dropped the entries — recoverable only via a
  // manual `--reissue-existing` + hand data-restore.
  //
  // Entries the filer HAS stamped `issues_filed_at` are PRUNED here so the
  // file stays bounded (else the filer re-scans every historical version each
  // run → gh secondary rate-limit) and adopted (closed) issues are never
  // re-filed — the filer dedups against OPEN issues only, so a re-scanned
  // closed feature would be filed again. Versions being re-emitted this run
  // are excluded too (their fresh entry supersedes the old one).
  const existingGaps = (() => {
    if (!existsSync(GAPS_PATH)) return [];
    try {
      const g = JSON.parse(readFileSync(GAPS_PATH, 'utf8'));
      return Array.isArray(g) ? g : [];
    } catch {
      return [];
    }
  })();
  const newVersionSet = new Set(newVersions.map((v) => v.version));
  const carriedPending = existingGaps.filter(
    (e) => e?.version && !newVersionSet.has(e.version) && (e.parse_failed === true || !e.issues_filed_at),
  );

  if (newVersions.length === 0) {
    // Preserve pending (stuck + triaged-unfiled) entries so --retry-failed and
    // the filer still have work; only fully clear the file when there are none.
    if (carriedPending.length > 0) {
      writeFileSync(GAPS_PATH, JSON.stringify(carriedPending, null, 2) + '\n');
      console.log(`cc-release-watch: nothing new; preserved ${carriedPending.length} pending entr(ies) (stuck + triaged-unfiled).`);
    } else {
      if (existsSync(GAPS_PATH)) writeFileSync(GAPS_PATH, '[]\n');
      console.log('cc-release-watch: nothing new.');
    }
    process.exit(0);
  }

  console.log(`cc-release-watch: ${newVersions.length} new version(s): ${newVersions.map((v) => v.version).join(', ')}`);

  // Write per-version snapshot files.
  // For `--reissue-existing` versions: do NOT overwrite an already-present
  // snapshot — the existing file is the historical capture and may carry
  // hand-edits or otherwise differ from upstream. The reissue is about
  // re-emitting the gap entry, not re-fetching the body.
  for (const v of newVersions) {
    const snapPath = join(SNAPSHOT_DIR, `${v.version}.md`);
    if (reissueSet.has(v.version) && existsSync(snapPath)) {
      console.log(`  reissue: ${snapPath} already present — keeping existing body`);
      continue;
    }
    writeFileSync(snapPath, `# Claude Code ${v.version}\n\nCaptured: ${new Date().toISOString()}\n\n${v.body}\n`);
    console.log(`  wrote ${snapPath}`);
  }

  // Emit a gaps file with version-level entries — populated further by cc-triage.mjs (Part A LLM step).
  // If triage is skipped (no LLM token), the workflow's fallback step files a generic manual-triage issue.
  // Reissued versions are included with empty `features[]` so the next triage
  // run picks them up exactly like a fresh discovery would.
  const gaps = newVersions.map((v) => ({
    version: v.version,
    parse_failed: false,
    features: [], // filled in by triage; if empty after triage, a manual-triage issue is filed by the workflow
    raw_bullets_count: v.body.split('\n').filter((l) => l.trim().startsWith('-')).length,
  }));
  // Append carried-forward pending entries (computed above) so stuck AND
  // triaged-but-unfiled versions survive this overwrite and stay retryable by
  // cc-triage / fileable by cc-file-adoption-issues.sh.
  const allGaps = [...gaps, ...carriedPending];
  writeFileSync(GAPS_PATH, JSON.stringify(allGaps, null, 2) + '\n');
  console.log(`  wrote ${GAPS_PATH} (${gaps.length} new + ${carriedPending.length} carried pending)`);

  // Pre-compute milestone title for the workflow's filer step.
  // SINGLE ROLLING UMBRELLA: every CC version files into one permanent
  // "CC adoption" milestone instead of one milestone per version (which
  // produced 8+ near-empty milestones). Per-version traceability is
  // unaffected — it lives in the `Key: <slug>+<version>` issue body marker
  // (cc-file-adoption-issues.sh) and shared/cc-snapshots/<version>.md, both
  // version-keyed and independent of the milestone. To keep a cluster as a
  // human bundle, rename its milestone out of the "CC X.Y.Z adoption" shape
  // (e.g. "M146 — CC 2.1.143 hardening"); cc-consolidate-milestones.sh then
  // leaves it alone. `latest_new_version` is still emitted so the snapshot
  // PR title stays unique per release (#1697).
  const latestNew = newVersions[newVersions.length - 1].version;
  const milestoneTitle = 'CC adoption';
  writeFileSync(ISSUE_ARGS_PATH, JSON.stringify({ milestone: milestoneTitle, latest_new_version: latestNew }, null, 2) + '\n');
  console.log(`  wrote ${ISSUE_ARGS_PATH} (milestone="${milestoneTitle}", latest=${latestNew})`);

  console.log('cc-release-watch: done.');
}

main();

#!/usr/bin/env node
/**
 * changelog-x.mjs: build facts-only changelog posts for X and write them to
 * the job summary. Preview only: nothing is posted.
 *
 * Run by .github/workflows/release-changelog-x.yml. No LLM. No `claude -p`.
 *
 * Modes:
 *   release --version X.Y.Z [--media-wait-seconds N]
 *       One post (or a thread when there are more than 3 changes) for a
 *       stable release, from the CHANGELOG.md section for that version.
 *       Names release-<version>-square.gif from the GitHub release as the
 *       media when that asset exists.
 *   beta-digest [--now ISO] [--releases-file F]
 *       One "today in OrchestKit beta" post for the prereleases published in
 *       the 24 hours before --now. No post when there are none.
 *   upstream --source NAME --state-file F [--fixture F]
 *       Reads an upstream changelog, compares it with the last seen version
 *       in the state file, and posts each new section. With no state, it
 *       records the head version and posts nothing (no backlog flood).
 *
 * Preview only: this build has no X client and posts nothing. A run with
 * DRY_RUN=false (the old live switch) fails before it builds any post. Live
 * posting ships later as a separate, reviewed change.
 *
 * Every run writes the posts to $GITHUB_STEP_SUMMARY (or stdout).
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseChangelog } from './changelog-to-props.mjs';
import { parseVersions } from './cc-release-watch.mjs';
import {
  MAX_POST,
  weightedLength,
  buildReleasePosts,
  buildBetaDigestPosts,
  buildUpstreamPosts,
  allWithinLimit,
} from './lib/changelog-x-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');
// No 120-character video cap: the formatter cuts each bullet by X weight.
const FULL_TEXT = { maxDescription: Infinity };
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Upstream sources for the `upstream` mode. Only enabled sources run.
export const SOURCES = {
  'claude-code': {
    enabled: true,
    label: 'Claude Code',
    repo: 'anthropics/claude-code',
    path: 'CHANGELOG.md',
    link: 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md',
    hashtag: '#ClaudeCode',
  },
  // hq-ext is a private repository. The default GITHUB_TOKEN cannot read it.
  // To enable this source: add a secret with a token that has read access to
  // Yonatan-HQ/hq-ext-plugin (contents: read), pass it as GH_TOKEN to the
  // upstream job for this source, set enabled to true, and add "hq-ext" to the
  // upstream job matrix in release-changelog-x.yml.
  'hq-ext': {
    enabled: false,
    label: 'hq-ext',
    repo: 'Yonatan-HQ/hq-ext-plugin',
    path: 'CHANGELOG.md',
    link: 'https://github.com/Yonatan-HQ/hq-ext-plugin/blob/main/CHANGELOG.md',
    hashtag: '',
  },
};

// == small helpers ==

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
    else opts[a.slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
  }
  return { mode, opts };
}

export const PREVIEW_ONLY_ERROR =
  'Live posting is not in this build. The X changelog feed is preview only; activation ships as a separate, reviewed change.';

/** Refuse a run that asks to post. DRY_RUN=false is the old live switch. */
export function assertPreviewOnly(env = process.env) {
  if (env.DRY_RUN === 'false') throw new Error(PREVIEW_ONLY_ERROR);
}

function gh(args, opts = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...opts });
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  else console.log(md);
}

/** Render the threads as Markdown for the job summary. */
export function renderSummary({ title, live, threads, notes = [] }) {
  const lines = [`### ${title}`, '', `Mode: ${live ? '**LIVE** (posts go to X)' : '**dry run** (nothing is posted)'}`, ''];
  for (const n of notes) lines.push(`- ${n}`);
  if (notes.length) lines.push('');
  if (!threads.length) lines.push('_No posts._');
  threads.forEach((thread, t) => {
    if (threads.length > 1) lines.push(`#### Thread ${t + 1}`, '');
    thread.forEach((p, i) => {
      lines.push(`Post ${i + 1}/${thread.length} (${weightedLength(p)}/${MAX_POST})`, '', '```text', p, '```', '');
    });
  });
  return lines.join('\n');
}

/**
 * Write the posts to the job summary. This build is preview only: it has no
 * X client, and it refuses a run that asks to post.
 */
async function publish({ title, threads, notes }) {
  assertPreviewOnly();
  for (const thread of threads) {
    if (!allWithinLimit(thread)) throw new Error(`a post is longer than ${MAX_POST} characters`);
  }
  summary(renderSummary({ title, live: false, threads, notes }));
  return [];
}

// == release ==

function readChangelog() {
  return readFileSync(CHANGELOG_PATH, 'utf8');
}

async function findGif(version, waitSeconds) {
  const tag = `v${version}`;
  const name = `release-${version}-square.gif`;
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    let names = [];
    try {
      names = JSON.parse(gh(['release', 'view', tag, '--repo', process.env.GITHUB_REPOSITORY || 'yonatangross/orchestkit', '--json', 'assets'])).assets.map((a) => a.name);
    } catch (e) {
      console.log(`::warning::could not list release assets for ${tag}: ${e.message.split('\n')[0]}`);
    }
    if (names.includes(name)) {
      const dir = mkdtempSync(join(tmpdir(), 'changelog-x-'));
      gh(['release', 'download', tag, '--repo', process.env.GITHUB_REPOSITORY || 'yonatangross/orchestkit', '--pattern', name, '--dir', dir]);
      return { path: join(dir, name), note: `Media: ${name} found on the release.` };
    }
    if (Date.now() >= deadline) return { path: null, note: `Media: ${name} not found, no media.` };
    // release-video.yml renders in parallel and uploads when it ends.
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

async function runRelease(opts) {
  const version = String(opts.version || '').replace(/^v/, '');
  if (!VERSION_RE.test(version)) throw new Error(`invalid --version: "${opts.version}"`);
  if (version.includes('-')) {
    summary(`### X changelog: release\n\nv${version} is a prerelease. The nightly beta digest covers it. No post.`);
    return;
  }
  const parsed = parseChangelog(readChangelog(), version, FULL_TEXT);
  const threads = [buildReleasePosts(parsed)];
  // A dry run checks once and does not wait for the render.
  const wait = Number(opts['media-wait-seconds'] || 0);
  const gif = opts['no-media'] ? { path: null, note: 'Media: skipped by --no-media.' } : await findGif(version, wait);
  await publish({ title: `X changelog: OrchestKit v${version}`, threads, notes: [gif.note], });
}

// == beta digest ==

/** Prereleases published in the 24 hours before `now`, oldest first. */
export function recentPrereleases(releases, now) {
  const since = now.getTime() - 24 * 3600 * 1000;
  return releases
    .filter((r) => r.prerelease && !r.draft && r.published_at)
    .filter((r) => {
      const t = Date.parse(r.published_at);
      return t > since && t <= now.getTime();
    })
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
}

async function runBetaDigest(opts) {
  const now = opts.now ? new Date(opts.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now: "${opts.now}"`);
  const releases = opts['releases-file']
    ? JSON.parse(readFileSync(opts['releases-file'], 'utf8'))
    : JSON.parse(gh(['api', `repos/${process.env.GITHUB_REPOSITORY || 'yonatangross/orchestkit'}/releases?per_page=100`]));
  const recent = recentPrereleases(releases, now);
  const day = now.toISOString().slice(0, 10);
  if (!recent.length) {
    summary(`### X changelog: beta digest ${day}\n\nNo prerelease in the last 24 hours. No post.`);
    return;
  }
  const changelog = readChangelog();
  const notes = [];
  const betas = recent.map((r) => {
    const version = String(r.tag_name).replace(/^v/, '');
    try {
      return { version, highlights: parseChangelog(changelog, version, FULL_TEXT).highlights };
    } catch {
      notes.push(`v${version} has no CHANGELOG.md section; counted with 0 changes.`);
      return { version, highlights: [] };
    }
  });
  await publish({ title: `X changelog: beta digest ${day}`, threads: [buildBetaDigestPosts(betas, day)], notes });
}

// == upstream ==

export function readState(file) {
  if (!file || !existsSync(file)) return null;
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    return typeof s.last_seen === 'string' && VERSION_RE.test(s.last_seen) ? s : null;
  } catch {
    return null;
  }
}

/**
 * Compare the parsed versions (newest first, as the upstream file lists them)
 * with the last seen version. Returns the new versions, oldest first.
 */
export function newSince(versions, lastSeen) {
  if (!versions.length) return { head: null, fresh: [], reason: 'no versions parsed' };
  const head = versions[0].version;
  if (!lastSeen) return { head, fresh: [], reason: 'no state: recorded the head, no post' };
  const idx = versions.findIndex((v) => v.version === lastSeen);
  if (idx < 0) return { head, fresh: [], reason: `last seen ${lastSeen} not in the changelog: reset to the head, no post` };
  return { head, fresh: versions.slice(0, idx).reverse(), reason: '' };
}

async function runUpstream(opts) {
  const name = opts.source;
  const src = SOURCES[name];
  if (!src) throw new Error(`unknown --source "${name}". Known: ${Object.keys(SOURCES).join(', ')}`);
  if (!src.enabled) {
    summary(`### X changelog: ${name}\n\nSource is disabled in SOURCES. No post.`);
    return;
  }
  const text = opts.fixture
    ? readFileSync(opts.fixture, 'utf8')
    : gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${src.repo}/contents/${src.path}`]);
  const versions = parseVersions(text);
  const state = readState(opts['state-file']);
  const { head, fresh, reason } = newSince(versions, state?.last_seen);
  const notes = [`Last seen: ${state?.last_seen ?? '(none)'}. Head: ${head ?? '(none)'}.`];
  if (reason) notes.push(reason);

  // Post at most 3 versions in one run. Older ones are named, not posted.
  const MAX_VERSIONS = 3;
  const skipped = fresh.slice(0, Math.max(0, fresh.length - MAX_VERSIONS));
  const toPost = fresh.slice(-MAX_VERSIONS);
  if (skipped.length) notes.push(`Not posted (more than ${MAX_VERSIONS} new): ${skipped.map((v) => v.version).join(', ')}`);

  const threads = toPost.map((v) =>
    buildUpstreamPosts({ label: src.label, version: v.version, body: v.body, link: src.link, hashtag: src.hashtag }),
  );
  await publish({ title: `X changelog: ${src.label} upstream`, threads, notes });

  // Write the state only after every post succeeded.
  if (head && head !== state?.last_seen && opts['state-file']) {
    mkdirSync(dirname(resolve(opts['state-file'])), { recursive: true });
    writeFileSync(opts['state-file'], JSON.stringify({ last_seen: head, source: name }, null, 2) + '\n');
    setOutput('state_changed', 'true');
  } else {
    setOutput('state_changed', 'false');
  }
}

// == main ==

async function main() {
  assertPreviewOnly();
  const { mode, opts } = parseArgs(process.argv.slice(2));
  if (mode === 'release') return runRelease(opts);
  if (mode === 'beta-digest') return runBetaDigest(opts);
  if (mode === 'upstream') return runUpstream(opts);
  throw new Error('usage: changelog-x.mjs <release|beta-digest|upstream> [options]');
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => {
    console.error(`changelog-x: ${e.message}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
// scripts/ci/dist-sync.mjs
//
// Publish the contents of plugins/ork at a release tag to the dist repo
// (yonatangross/orchestkit-plugin) as ONE signed commit, then tag it.
//
// Why a dist repo: the Anthropic plugin directory validates the whole repo
// archive (50 MiB compressed cap). orchestkit is about 77 MiB compressed;
// plugins/ork alone is about 3.8 MiB. The dist repo holds only the plugin, at
// the repo root, so .claude-plugin/plugin.json sits where the directory looks.
//
// What lands in the dist tree, and nothing else:
//   - every file of <source-ref>:plugins/ork, at the dist repo root
//   - README.md, generated here (says the repo is generated, points home)
//   - LICENSE, the dist repo's own copy if main has one, else orchestkit's
//
// How it writes (no clone of the dist repo, no runner-side push):
//   1. The expected tree id is computed LOCALLY from git objects: the plugin
//      entries come straight from the tagged tree, so modes and bytes are what
//      the tag holds, not what a checkout or a cp produced.
//   2. The tree is created through the Git Data API in chunks with inline
//      content (base_tree chained). One request per chunk, not one per file:
//      GitHub caps content-creating requests near 500 an hour, and plugins/ork
//      has about 1,900 files. Blobs the dist repo already has go by sha; a
//      file that is not valid UTF-8 goes through /git/blobs (base64).
//   3. The API tree id must equal the local one, the commit is created with
//      no author or committer so GitHub signs it, and it must come back
//      verified, or no ref is touched (the #5016 pattern, api-commit.mjs).
//   4. main moves with force=false (fast-forward only), then the tag is
//      created on the same commit. --no-move-main (an older tag re-run)
//      creates the commit and the tag but leaves main where it is.
//
// Idempotent: a tag that already points at the expected tree is a no-op
// success. A tag that points at any other tree is a hard failure (a published
// tag is never moved). If main already holds the expected tree (an earlier
// run moved main and then failed on the tag), the tag goes on main's head.
//
// Retry: one attempt, then one retry after a delay, then a loud failure.
// Setup problems (repo missing, app not installed, no main branch, a tag with
// another tree) fail at once with the missing step named; retrying cannot fix
// them.
//
// Usage: node dist-sync.mjs --version X.Y.Z --repo owner/name
//                           [--source-ref <rev>] [--plugin-path plugins/ork]
//                           [--no-move-main]
// Env:   GH_TOKEN (App installation token for the dist repo only),
//        GITHUB_API_URL (default https://api.github.com),
//        DIST_SYNC_RETRY_DELAY_MS (default 15000; tests set 0),
//        DIST_SYNC_TREE_ENTRIES (default 300; tests set 2).
// Exit:  0 synced or already in sync, 1 failed, 3 not a GA version (skipped).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOME_URL = 'https://github.com/yonatangross/orchestkit';
const CHUNK_BYTES = 1024 * 1024; // inline content per tree request
// Entries per tree request, sha-only ones included. A file the dist repo already
// has costs no bytes, so without this nearly all 1,879 entries land in one request
// and it dies at GitHub's 10 second limit with a 502 (v10.9.1, v10.10.0).
const TREE_ENTRIES = Number(process.env.DIST_SYNC_TREE_ENTRIES ?? 300);
const SETUP_HINT =
  'Setup steps: create the public repo, initialised with a README so main exists, then install the OrchestKit Release Bot app on it. Re-run this job after; no new tag is needed.';

class FatalError extends Error {} // retrying cannot fix it

export function parseArgs(argv) {
  const out = { version: '', repo: '', sourceRef: 'HEAD', pluginPath: 'plugins/ork', moveMain: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') out.version = argv[++i] ?? '';
    else if (a === '--repo') out.repo = argv[++i] ?? '';
    else if (a === '--source-ref') out.sourceRef = argv[++i] ?? '';
    else if (a === '--plugin-path') out.pluginPath = argv[++i] ?? '';
    else if (a === '--no-move-main') out.moveMain = false;
    else throw new FatalError(`unknown argument: ${a}`);
  }
  if (!out.version) throw new FatalError('--version is required');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(out.repo)) throw new FatalError(`--repo must be owner/name, got ${JSON.stringify(out.repo)}`);
  if (!out.sourceRef || !out.pluginPath) throw new FatalError('--source-ref and --plugin-path must not be empty');
  return out;
}

// GA only. A prerelease tag (10.0.0-alpha.1) is not published to the dist
// repo; the directory should only ever see a stable build.
export const isGaVersion = (v) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v);

export function readmeText(version) {
  return [
    '# orchestkit-plugin',
    '',
    'Generated. Do not edit or open pull requests here.',
    '',
    `This repository is a build output: the contents of \`plugins/ork\` from [orchestkit](${HOME_URL}),`,
    'copied to the repository root by the orchestkit release workflow on every stable release,',
    'so the Claude Code plugin directory can read a small repository.',
    '',
    `This commit was built from orchestkit v${version}. Source, issues and docs: ${HOME_URL}`,
    '',
  ].join('\n');
}

const git = (args, opts = {}) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024, ...opts });

// `git ls-tree -r -z <tree>`: "<mode> <type> <sha>\t<path>\0" repeated.
export function parseLsTree(buf) {
  const out = [];
  for (const rec of buf.toString('utf8').split('\0')) {
    if (!rec) continue;
    const m = rec.match(/^(\d{6}) (\w+) ([0-9a-f]{40,64})\t([\s\S]+)$/);
    if (!m) throw new FatalError(`unparseable ls-tree record: ${JSON.stringify(rec)}`);
    out.push({ mode: m[1], type: m[2], sha: m[3], path: m[4] });
  }
  return out;
}

// The tree id git would give these entries, without needing every blob here
// (the dist LICENSE may only exist remotely): a throwaway index plus
// write-tree --missing-ok.
export function localTreeId(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'ork-dist-index-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
    const info = entries.map((e) => `${e.mode} ${e.sha}\t${e.path}\0`).join('');
    git(['update-index', '-z', '--index-info'], { env, input: info });
    return git(['write-tree', '--missing-ok'], { env }).toString().trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function buildEntries({ sourceRef, pluginPath, version, distLicense }) {
  let pluginTree;
  try {
    pluginTree = git(['rev-parse', '--verify', '--quiet', `${sourceRef}:${pluginPath}`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    throw new FatalError(`${sourceRef}:${pluginPath} does not exist`);
  }
  const plugin = parseLsTree(git(['ls-tree', '-r', '-z', pluginTree]));
  for (const e of plugin) {
    if (e.type !== 'blob') throw new FatalError(`refusing ${e.type} entry ${e.path} (submodules are not copied)`);
    if (e.path === 'README.md' || e.path === 'LICENSE') {
      throw new FatalError(`${pluginPath}/${e.path} would collide with the dist repo's own ${e.path}`);
    }
  }
  if (!plugin.some((e) => e.path === '.claude-plugin/plugin.json')) {
    throw new FatalError(`${pluginPath}/.claude-plugin/plugin.json is missing; the dist root must hold it`);
  }
  const readme = Buffer.from(readmeText(version));
  const readmeSha = git(['hash-object', '-w', '--stdin'], { input: readme }).toString().trim();
  let license = distLicense;
  if (!license) {
    let sha;
    try {
      sha = git(['rev-parse', '--verify', '--quiet', `${sourceRef}:LICENSE`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      throw new FatalError(`the dist repo has no LICENSE and ${sourceRef}:LICENSE does not exist`);
    }
    license = { mode: '100644', sha, local: true };
  }
  return [
    ...plugin.map((e) => ({ ...e, local: true })),
    { mode: '100644', type: 'blob', sha: readmeSha, path: 'README.md', local: true },
    { mode: license.mode, type: 'blob', sha: license.sha, path: 'LICENSE', local: Boolean(license.local) },
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function makeApi(repo) {
  const base = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  return async function api(method, route, body, { allow = [] } = {}) {
    const res = await fetch(`${base}/repos/${repo}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (allow.includes(res.status)) return { status: res.status };
    if (!res.ok) throw new Error(`${method} ${route || '/'} -> HTTP ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
  };
}

// Resolve a tag ref to its commit (lightweight or annotated).
async function tagCommit(api, ref) {
  let obj = ref.object;
  for (let hops = 0; obj?.type === 'tag' && hops < 5; hops++) obj = (await api('GET', `/git/tags/${obj.sha}`)).object;
  if (obj?.type !== 'commit') throw new FatalError(`tag points at a ${obj?.type}, not a commit`);
  return obj.sha;
}

export async function syncOnce({ repo, version, sourceRef, pluginPath, moveMain, log = console.log }) {
  const api = makeApi(repo);
  const tag = `v${version}`;

  const meta = await api('GET', '', undefined, { allow: [404] });
  if (meta.status === 404) {
    throw new FatalError(`dist repo ${repo} is not reachable (HTTP 404: it does not exist, or the OrchestKit Release Bot is not installed on it). ${SETUP_HINT}`);
  }
  const main = await api('GET', '/git/ref/heads/main', undefined, { allow: [404, 409] });
  if (main.status) {
    throw new FatalError(`dist repo ${repo} has no main branch (HTTP ${main.status}; an empty repo answers 409). ${SETUP_HINT}`);
  }
  if (main.ref !== 'refs/heads/main') throw new FatalError(`GET main answered for ${JSON.stringify(main.ref)}`);
  const mainSha = main.object.sha;
  const mainTreeSha = (await api('GET', `/git/commits/${mainSha}`)).tree.sha;
  const remote = await api('GET', `/git/trees/${mainTreeSha}?recursive=1`);
  // A truncated listing is still a true subset; it only costs re-sending.
  const remoteBlobs = new Set((remote.tree || []).filter((e) => e.type === 'blob').map((e) => e.sha));
  const lic = (remote.tree || []).find((e) => e.path === 'LICENSE' && e.type === 'blob');
  const distLicense = lic ? { mode: lic.mode, sha: lic.sha, local: false } : null;

  const entries = buildEntries({ sourceRef, pluginPath, version, distLicense });
  const expectedTree = localTreeId(entries);
  log(`expected dist tree ${expectedTree} (${entries.length} files) for ${tag}`);

  const existing = await api('GET', `/git/ref/tags/${encodeURIComponent(tag)}`, undefined, { allow: [404] });
  if (!existing.status) {
    if (existing.ref !== `refs/tags/${tag}`) throw new FatalError(`GET tag answered for ${JSON.stringify(existing.ref)}`);
    const commitSha = await tagCommit(api, existing);
    const treeSha = (await api('GET', `/git/commits/${commitSha}`)).tree.sha;
    if (treeSha === expectedTree) {
      log(`::notice::${repo} ${tag} already holds tree ${expectedTree} (commit ${commitSha}); nothing to do.`);
      return { result: 'noop', commit: commitSha, tree: expectedTree };
    }
    throw new FatalError(`${repo} tag ${tag} already exists on commit ${commitSha} with tree ${treeSha}, not the expected ${expectedTree}. A published tag is never moved; delete it by hand if it is wrong, then re-run.`);
  }

  let target = mainSha;
  if (mainTreeSha === expectedTree) {
    log(`main already holds tree ${expectedTree}; tagging its head ${mainSha}.`);
  } else {
    const treeSha = await createTree(api, entries, remoteBlobs);
    if (treeSha !== expectedTree) throw new Error(`tree id mismatch: local ${expectedTree}, API ${treeSha}; no commit made`);
    const message = `chore(dist): sync plugins/ork from orchestkit ${tag}\n\nSource: ${HOME_URL}/tree/${tag}/plugins/ork\n`;
    // No author or committer: GitHub fills them from the App and signs it.
    const commit = await api('POST', '/git/commits', { message, tree: treeSha, parents: [mainSha] });
    const v = commit.verification || {};
    log(`created ${commit.sha} verified=${v.verified} reason=${v.reason}`);
    if (v.verified !== true) throw new Error(`GitHub did not sign ${commit.sha} (reason=${v.reason}); no ref touched`);
    target = commit.sha;
    if (moveMain) {
      const moved = await api('PATCH', '/git/refs/heads/main', { sha: target, force: false });
      if (moved.ref !== 'refs/heads/main' || moved.object?.sha !== target) {
        throw new Error(`PATCH main answered ${JSON.stringify(moved.ref)} at ${moved.object?.sha}, expected refs/heads/main at ${target}`);
      }
      log(`main fast-forwarded ${mainSha} -> ${target}`);
    } else {
      log(`::notice::${tag} is not the highest GA tag; main stays at ${mainSha}, only the tag is created.`);
    }
  }

  const made = await api('POST', '/git/refs', { ref: `refs/tags/${tag}`, sha: target });
  if (made.ref !== `refs/tags/${tag}` || made.object?.sha !== target) {
    throw new Error(`POST tag answered ${JSON.stringify(made.ref)} at ${made.object?.sha}, expected refs/tags/${tag} at ${target}`);
  }
  log(`::notice::Synced plugins/ork ${tag} to ${repo}: commit ${target}, tree ${expectedTree}.`);
  return { result: 'synced', commit: target, tree: expectedTree };
}

// Chunked tree build. Each request carries at most CHUNK_BYTES of inline
// content and TREE_ENTRIES entries, and chains base_tree to the previous result, so the final tree is
// the union. The first request has no base_tree, so nothing from the old
// dist tree survives except what `entries` lists.
async function createTree(api, entries, remoteBlobs) {
  const chunks = [[]];
  let size = 0;
  for (const e of entries) {
    let item;
    if (remoteBlobs.has(e.sha) || !e.local) {
      item = { path: e.path, mode: e.mode, type: 'blob', sha: e.sha };
    } else {
      const buf = git(['cat-file', 'blob', e.sha]);
      const text = buf.toString('utf8');
      if (Buffer.from(text, 'utf8').equals(buf)) {
        item = { path: e.path, mode: e.mode, type: 'blob', content: text };
      } else {
        const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
        if (blob.sha !== e.sha) throw new Error(`blob id mismatch for ${e.path}: local ${e.sha}, API ${blob.sha}`);
        item = { path: e.path, mode: e.mode, type: 'blob', sha: e.sha };
      }
    }
    const cost = item.content ? Buffer.byteLength(item.content) : 0;
    const open = chunks.at(-1);
    if (open.length && ((cost && size + cost > CHUNK_BYTES) || open.length >= TREE_ENTRIES)) {
      chunks.push([]);
      size = 0;
    }
    chunks.at(-1).push(item);
    size += cost;
  }
  let base;
  for (const tree of chunks) {
    const res = await api('POST', '/git/trees', base ? { base_tree: base, tree } : { tree });
    base = res.sha;
  }
  return base;
}

export async function run(argv, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log } = {}) {
  const opts = parseArgs(argv);
  if (!isGaVersion(opts.version)) {
    log(`::notice::${opts.version} is not a GA version; the dist repo only takes stable releases. Skipped.`);
    return 3;
  }
  if (!process.env.GH_TOKEN) throw new FatalError('GH_TOKEN is not set');
  const delay = Number(process.env.DIST_SYNC_RETRY_DELAY_MS ?? 15000);
  for (let attempt = 1; ; attempt++) {
    try {
      await syncOnce({ ...opts, log });
      return 0;
    } catch (err) {
      if (err instanceof FatalError || attempt >= 2) {
        const tail = err instanceof FatalError ? '' : ` after ${attempt} attempts`;
        log(`::error::dist sync of v${opts.version} to ${opts.repo} failed${tail}: ${err.message}`);
        return 1;
      }
      log(`::warning::dist sync attempt ${attempt} failed: ${err.message}; retrying in ${delay / 1000}s.`);
      await sleep(delay);
    }
  }
}

// realpath both sides (see api-commit.mjs): a missed compare would exit 0
// having done nothing.
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.log(`::error::dist sync failed: ${err.message}`);
      process.exit(1);
    },
  );
}

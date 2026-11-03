#!/usr/bin/env node
// scripts/ci/api-commit.mjs
//
// Commit the working-tree changes under the given paths to a branch through
// the GitHub Git Data API instead of `git push` (#5012).
//
// Why: a commit built on the runner and pushed with `git push` carries no
// signature, so the skill-autoheal commits on PR branches showed as
// unverified and security review legs flagged them. A commit created through
// the API by a GitHub App token, with no author or committer set, is signed
// by GitHub and reports verification.verified=true.
//
// Steps: stage the paths, read the staged diff (modes and blob ids), upload
// each added or changed blob, build a tree on top of HEAD's tree, create the
// commit with HEAD as its only parent, then move the branch with force=false
// (fast-forward only; a branch that moved meanwhile is a 422, not an
// overwrite). The tree id GitHub returns must equal `git write-tree`, and the
// commit must come back verified, or the ref is never touched.
//
// Usage: node scripts/ci/api-commit.mjs --branch <ref> --message-file <f> -- <pathspec>...
// Env:   GH_TOKEN (App installation token), GITHUB_REPOSITORY (owner/name),
//        GITHUB_API_URL (default https://api.github.com).
// Exit:  0 committed or nothing to commit, 1 refused or failed (ref untouched
//        unless the final PATCH itself is what failed).

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REGEN_HINT =
  'Regenerate and commit the build output yourself (signed): npm ci && npm run build && git add -A plugins docs/site/content/docs && git commit';

function parseArgs(argv) {
  const out = { branch: '', messageFile: '', paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out.paths = argv.slice(i + 1);
      break;
    }
    if (a === '--branch') out.branch = argv[++i] ?? '';
    else if (a === '--message-file') out.messageFile = argv[++i] ?? '';
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!out.branch) throw new Error('--branch is required');
  if (!out.messageFile) throw new Error('--message-file is required');
  if (out.paths.length === 0) throw new Error('at least one pathspec after -- is required');
  return out;
}

const git = (args, opts = {}) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024, ...opts });

// Parse `git diff --cached --raw -z --no-renames` output:
// ":<srcmode> <dstmode> <srcsha> <dstsha> <status>\0<path>\0" repeated.
export function parseRawDiff(buf) {
  const parts = buf.toString('utf8').split('\0');
  const changes = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i];
    const path = parts[i + 1];
    if (!meta) break;
    const m = meta.match(/^:(\d{6}) (\d{6}) ([0-9a-f]{40,64}) ([0-9a-f]{40,64}) ([A-Z])\d*$/);
    if (!m) throw new Error(`unparseable diff line: ${JSON.stringify(meta)}`);
    const [, , dstMode, , dstSha, status] = m;
    changes.push({ path, mode: dstMode, sha: dstSha, status });
  }
  return changes;
}

async function api(method, route, body) {
  const base = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  const repo = process.env.GITHUB_REPOSITORY;
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
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const { branch, messageFile, paths } = parseArgs(process.argv.slice(2));
  if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN is not set');
  if (!process.env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is not set');
  const message = readFileSync(messageFile, 'utf8');

  // Stage exactly the gated paths (adds, edits, deletes, untracked files).
  git(['add', '-A', '--', ...paths]);
  const changes = parseRawDiff(git(['diff', '--cached', '--raw', '--no-abbrev', '-z', '--no-renames', '--', ...paths]));
  if (changes.length === 0) {
    console.log('::notice::No build drift, source and committed artifacts already in sync.');
    return 0;
  }

  const parent = git(['rev-parse', 'HEAD']).toString().trim();
  const baseTree = git(['rev-parse', 'HEAD^{tree}']).toString().trim();
  const expectedTree = git(['write-tree']).toString().trim();

  const entries = [];
  for (const c of changes) {
    if (c.status === 'D') {
      entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    if (c.mode === '160000') throw new Error(`refusing to commit a submodule entry: ${c.path}`);
    const content = git(['cat-file', 'blob', c.sha]).toString('base64');
    const blob = await api('POST', '/git/blobs', { content, encoding: 'base64' });
    if (blob.sha !== c.sha) throw new Error(`blob id mismatch for ${c.path}: local ${c.sha}, API ${blob.sha}`);
    entries.push({ path: c.path, mode: c.mode, type: 'blob', sha: c.sha });
  }

  const tree = await api('POST', '/git/trees', { base_tree: baseTree, tree: entries });
  if (tree.sha !== expectedTree) {
    throw new Error(`tree id mismatch: local write-tree ${expectedTree}, API ${tree.sha}`);
  }

  // No author or committer: GitHub fills them from the App and signs it.
  const commit = await api('POST', '/git/commits', { message, tree: tree.sha, parents: [parent] });
  const verification = commit.verification || {};
  console.log(`created ${commit.sha} verified=${verification.verified} reason=${verification.reason}`);
  if (verification.verified !== true) {
    throw new Error(`GitHub did not sign ${commit.sha} (reason=${verification.reason}); branch left untouched`);
  }

  await api('PATCH', `/git/refs/heads/${encodeURI(branch)}`, { sha: commit.sha, force: false });
  console.log(`::notice::Pushed signed heal commit ${commit.sha} to ${branch} (${changes.length} files).`);
  return 0;
}

// realpath both sides: import.meta.url is resolved through symlinks, argv[1]
// is what the caller typed, and a missed compare would exit 0 having done
// nothing (the fail-open trap documented in docs/site/scripts/lab-manifest.mjs).
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`::error::skill-autoheal API commit failed: ${err.message}`);
      console.error(`::error::${REGEN_HINT}`);
      process.exit(1);
    },
  );
}

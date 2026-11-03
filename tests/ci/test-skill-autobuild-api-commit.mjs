#!/usr/bin/env node
// Regression test for #5012: skill-autoheal must create its heal commit
// through the GitHub API (which GitHub signs), never by pushing a commit built
// on the runner (unsigned). Drives scripts/ci/api-commit.mjs against a fake
// GitHub API and checks the workflow no longer pushes from the runner.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts/ci/api-commit.mjs');
const workflowPath = join(root, '.github/workflows/skill-autobuild.yml');
const GATED = ['plugins/', ':!plugins/ork/hooks/dist', 'docs/site/content/docs/reference'];

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${name}\n  ${err.stack || err.message}`);
  }
}

const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
env.GIT_AUTHOR_NAME = env.GIT_COMMITTER_NAME = 'fixture';
env.GIT_AUTHOR_EMAIL = env.GIT_COMMITTER_EMAIL = 'fixture@example.com';
env.GIT_CONFIG_GLOBAL = '/dev/null';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ork-autoheal-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, stdio: 'pipe' }).toString().trim();
  const put = (file, text) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  };
  git('init', '-q', '-b', 'main');
  put('plugins/ork/skills/a/SKILL.md', 'old a\n');
  put('plugins/ork/skills/gone/SKILL.md', 'to delete\n');
  put('plugins/ork/skills/a/run.sh', '#!/bin/sh\necho hi\n');
  put('plugins/ork/hooks/dist/bundle.js', 'release owned\n');
  put('docs/site/content/docs/reference/a.mdx', 'ref old\n');
  put('src/skills/a.md', 'src\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { dir, git, put };
}

const gitBlobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

// Fake GitHub Git Data API. Blob ids are computed like git does; the tree id
// is taken from the local repo's write-tree (passed in) so the script's
// integrity check can be exercised both ways.
async function fakeGitHub({ treeSha, verified = true }) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = body ? JSON.parse(body) : undefined;
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: json });
      const send = (status, obj) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (req.method === 'POST' && req.url.endsWith('/git/blobs')) {
        return send(201, { sha: gitBlobSha(Buffer.from(json.content, 'base64')) });
      }
      if (req.method === 'POST' && req.url.endsWith('/git/trees')) return send(201, { sha: treeSha });
      if (req.method === 'POST' && req.url.endsWith('/git/commits')) {
        return send(201, {
          sha: 'c0ffee'.padEnd(40, '0'),
          verification: { verified, reason: verified ? 'valid' : 'unsigned' },
        });
      }
      if (req.method === 'PATCH' && req.url.includes('/git/refs/heads/')) return send(200, { ref: 'ok' });
      send(404, { message: 'not found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { calls, url, close: () => new Promise((r) => server.close(r)) };
}

function runScript(cwd, apiUrl, branch = 'feat/x') {
  const msg = join(cwd, '.msg');
  writeFileSync(msg, 'chore(build): regenerate skill artifacts [skill-autoheal]\n');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, '--branch', branch, '--message-file', msg, '--', ...GATED], {
      cwd,
      env: { ...env, GH_TOKEN: 'test-token', GITHUB_REPOSITORY: 'o/r', GITHUB_API_URL: apiUrl },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => resolve({ status, out }));
  });
}

function driftRepo() {
  const r = makeRepo();
  r.put('plugins/ork/skills/a/SKILL.md', 'new a\n');
  r.put('plugins/ork/skills/new/SKILL.md', 'brand new\n');
  rmSync(join(r.dir, 'plugins/ork/skills/gone/SKILL.md'));
  chmodSync(join(r.dir, 'plugins/ork/skills/a/run.sh'), 0o755);
  r.put('plugins/ork/hooks/dist/bundle.js', 'changed but excluded\n');
  r.put('src/skills/a.md', 'outside gated paths\n');
  r.put('docs/site/content/docs/reference/a.mdx', 'ref new\n');
  // Local expected tree for the gated paths only.
  r.git('add', '-A', '--', ...GATED);
  const tree = r.git('write-tree');
  r.git('reset', '-q');
  return { ...r, tree };
}

await check('workflow never pushes from the runner and calls the API commit script', () => {
  const wf = readFileSync(workflowPath, 'utf8');
  const code = wf.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /\bgit\s+push\b/, 'skill-autobuild.yml must not run a runner-side push (#5012)');
  assert.doesNotMatch(code, /\bgit\s+commit\b/, 'skill-autobuild.yml must not build the commit on the runner (#5012)');
  assert.match(code, /node scripts\/ci\/api-commit\.mjs --branch "\$HEAD_REF"/);
  assert.match(code, /persist-credentials: false/);
  // The App token is minted only after the PR's code (npm ci + build) ran.
  assert.ok(code.indexOf('Mint Release Bot token') > code.indexOf('run: npm run build'), 'mint after build');
  // No new write scope for GITHUB_TOKEN.
  assert.doesNotMatch(code, /^\s*contents:\s*write/m);
  // Every action is pinned by full commit SHA.
  for (const m of code.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `unpinned: ${m[1]}`);
});

await check('drift: blobs + tree + unsigned-author commit + fast-forward ref update', async () => {
  const r = driftRepo();
  const head = r.git('rev-parse', 'HEAD');
  const api = await fakeGitHub({ treeSha: r.tree });
  try {
    const res = await runScript(r.dir, api.url);
    assert.equal(res.status, 0, res.out);
    assert.match(res.out, /verified=true/);
    const blobs = api.calls.filter((c) => c.url.endsWith('/git/blobs'));
    assert.equal(blobs.length, 4, 'a, new, run.sh (mode), reference mdx');
    const treeCall = api.calls.find((c) => c.url.endsWith('/git/trees'));
    assert.equal(treeCall.body.base_tree, r.git('rev-parse', 'HEAD^{tree}'));
    const byPath = Object.fromEntries(treeCall.body.tree.map((e) => [e.path, e]));
    assert.equal(byPath['plugins/ork/skills/gone/SKILL.md'].sha, null, 'deletion is sha null');
    assert.equal(byPath['plugins/ork/skills/a/run.sh'].mode, '100755', 'exec bit kept');
    assert.ok(byPath['plugins/ork/skills/new/SKILL.md'], 'untracked file included');
    assert.ok(!byPath['plugins/ork/hooks/dist/bundle.js'], 'release-owned hook dist excluded');
    assert.ok(!byPath['src/skills/a.md'], 'src outside gated paths excluded');
    const commitCall = api.calls.find((c) => c.url.endsWith('/git/commits'));
    assert.deepEqual(commitCall.body.parents, [head]);
    assert.equal(commitCall.body.author, undefined, 'no author, so GitHub signs it');
    assert.equal(commitCall.body.committer, undefined, 'no committer, so GitHub signs it');
    const refCall = api.calls.find((c) => c.method === 'PATCH');
    assert.equal(refCall.url, '/repos/o/r/git/refs/heads/feat/x');
    assert.equal(refCall.body.force, false, 'fast-forward only');
    assert.ok(api.calls.every((c) => c.auth === 'Bearer test-token'));
    assert.equal(r.git('rev-parse', 'HEAD'), head, 'no local commit made');
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('unverified commit: branch is never moved, exit 1 with regenerate command', async () => {
  const r = driftRepo();
  const api = await fakeGitHub({ treeSha: r.tree, verified: false });
  try {
    const res = await runScript(r.dir, api.url);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /did not sign/);
    assert.match(res.out, /npm run build/);
    assert.equal(api.calls.filter((c) => c.method === 'PATCH').length, 0, 'ref untouched');
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('tree mismatch: refuses before creating a commit', async () => {
  const r = driftRepo();
  const api = await fakeGitHub({ treeSha: 'f'.repeat(40) });
  try {
    const res = await runScript(r.dir, api.url);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /tree id mismatch/);
    assert.equal(api.calls.filter((c) => c.url.endsWith('/git/commits')).length, 0);
    assert.equal(api.calls.filter((c) => c.method === 'PATCH').length, 0);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('no drift: exits 0 without any API call', async () => {
  const r = makeRepo();
  r.put('src/skills/a.md', 'only src changed\n');
  r.put('plugins/ork/hooks/dist/bundle.js', 'only excluded dist changed\n');
  const api = await fakeGitHub({ treeSha: 'unused' });
  try {
    const res = await runScript(r.dir, api.url);
    assert.equal(res.status, 0, res.out);
    assert.match(res.out, /No build drift/);
    assert.equal(api.calls.length, 0);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all skill-autobuild api-commit checks passed');

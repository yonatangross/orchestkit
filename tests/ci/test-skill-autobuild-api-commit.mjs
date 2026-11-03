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
// Decode the request path the way a real server does: the fragment never
// leaves the client, the query is not part of the path, and each segment is
// percent-decoded. refOverride lets a row fake a misrouted answer.
function refFromUrl(url, marker) {
  const path = new URL(url, 'http://x').pathname;
  const i = path.indexOf(marker);
  if (i < 0) return null;
  return 'refs/heads/' + path.slice(i + marker.length).split('/').map(decodeURIComponent).join('/');
}

async function fakeGitHub({ treeSha, verified = true, headSha = '', refOverride = {} }) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = body ? JSON.parse(body) : undefined;
      const ref =
        refFromUrl(req.url, '/git/ref/heads/') || refFromUrl(req.url, '/git/refs/heads/');
      calls.push({ method: req.method, url: req.url, ref, auth: req.headers.authorization, body: json });
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
      if (req.method === 'GET' && req.url.includes('/git/ref/heads/')) {
        return send(200, { ref: refOverride.get ?? ref, object: { sha: headSha } });
      }
      if (req.method === 'PATCH' && req.url.includes('/git/refs/heads/')) {
        return send(200, { ref: refOverride.patch ?? ref, object: { sha: json.sha } });
      }
      send(404, { message: 'not found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { calls, url, close: () => new Promise((r) => server.close(r)) };
}

function runScript(cwd, apiUrl, branch = 'feat/x', flags = []) {
  const msg = join(tmpdir(), `ork-autoheal-msg-${process.pid}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(msg, 'chore(build): regenerate skill artifacts [skill-autoheal]\n');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...flags, '--branch', branch, '--message-file', msg, '--', ...GATED], {
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
  return { ...r, tree, head: r.git('rev-parse', 'HEAD') };
}

await check('workflow never pushes from the runner and calls the API commit script', () => {
  const wf = readFileSync(workflowPath, 'utf8');
  const code = wf.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /\bgit\s+push\b/, 'skill-autobuild.yml must not run a runner-side push (#5012)');
  assert.doesNotMatch(code, /\bgit\s+commit\b/, 'skill-autobuild.yml must not build the commit on the runner (#5012)');
  assert.match(code, /node \.\.\/base\/scripts\/ci\/api-commit\.mjs --strict --branch "\$HEAD_REF"/);
  assert.doesNotMatch(code, /^on:[\s\S]*pull_request_target/m, 'pull_request only');
  // No new write scope for GITHUB_TOKEN.
  assert.doesNotMatch(code, /^\s*contents:\s*write/m);
  // Every action is pinned by full commit SHA.
  for (const m of code.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `unpinned: ${m[1]}`);
});

// b35 HOLD item 2 on #5016: a token minted in the job that ran the PR's build
// is reachable from it (GITHUB_ENV, NODE_OPTIONS). The token must live in a
// separate job that runs no PR code.
await check('token job runs no PR code; build job holds no secret', () => {
  const code = readFileSync(workflowPath, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  const jobsAt = code.indexOf('\njobs:\n');
  assert.ok(jobsAt > 0, 'jobs: block');
  const jobs = {};
  for (const m of code.slice(jobsAt).matchAll(/\n {2}([a-z][\w-]*):\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n|$)/g)) jobs[m[1]] = m[2];
  assert.deepEqual(Object.keys(jobs).sort(), ['autoheal', 'build']);
  const { build, autoheal } = jobs;
  assert.doesNotMatch(build, /secrets\.|create-github-app-token|GH_TOKEN/, 'build job holds no secret');
  assert.match(build, /run: npm ci/);
  assert.match(build, /upload-artifact@/);
  assert.match(autoheal, /needs: build/);
  assert.match(autoheal, /create-github-app-token@/);
  assert.doesNotMatch(autoheal, /npm (ci|run|install)|npx |\.\/\.github\/actions/, 'token job runs no PR code');
  assert.doesNotMatch(autoheal, /node (?!\.\.\/base\/)/, 'node only runs the base copy of the script');
  assert.match(autoheal, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(autoheal, /node-version-file: base\/\.nvmrc/);
  // Same-repo gate on both jobs; no checkout persists a credential.
  for (const [name, body] of Object.entries(jobs)) {
    assert.match(body, /head\.repo\.full_name == github\.repository/, `${name}: same-repo gate`);
    const checkouts = body.match(/actions\/checkout@/g) || [];
    const persisted = body.match(/persist-credentials: false/g) || [];
    assert.equal(persisted.length, checkouts.length, `${name}: every checkout persist-credentials false`);
  }
});

// b35 HOLD item 1 on #5016: encodeURI kept '#' and '?', so a PR branch named
// 'X#y' moved refs/heads/X. Every row must act on exactly refs/heads/<branch>.
for (const branch of ['X#y', 'fix?x=1', 'pct%41b', 'a/b', 'feat/x#heal']) {
  await check(`ref safety: branch ${JSON.stringify(branch)} only ever touches refs/heads/${branch}`, async () => {
    const r = driftRepo();
    const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head });
    try {
      const res = await runScript(r.dir, api.url, branch);
      const refCalls = api.calls.filter((c) => c.ref);
      assert.ok(refCalls.length > 0, `no ref call made: ${res.out}`);
      for (const c of refCalls) assert.equal(c.ref, `refs/heads/${branch}`, `${c.method} ${c.url}`);
      assert.equal(res.status, 0, res.out);
      assert.equal(api.calls.filter((c) => c.method === 'PATCH').length, 1);
    } finally {
      await api.close();
      rmSync(r.dir, { recursive: true, force: true });
    }
  });
}

await check('ref safety: GET answering for another ref stops before any write', async () => {
  const r = driftRepo();
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head, refOverride: { get: 'refs/heads/main' } });
  try {
    const res = await runScript(r.dir, api.url, 'main#heal');
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /GET ref answered for ref "refs\/heads\/main"/);
    assert.equal(api.calls.filter((c) => c.method !== 'GET').length, 0, 'no blob, tree, commit or ref write');
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('ref safety: PATCH answering for another ref fails the run', async () => {
  const r = driftRepo();
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head, refOverride: { patch: 'refs/heads/X' } });
  try {
    const res = await runScript(r.dir, api.url, 'X#y');
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /PATCH ref answered for ref "refs\/heads\/X"/);
    assert.doesNotMatch(res.out, /Pushed signed heal commit/);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('branch moved since the build: refuses before creating a commit', async () => {
  const r = driftRepo();
  const api = await fakeGitHub({ treeSha: r.tree, headSha: 'a'.repeat(40) });
  try {
    const res = await runScript(r.dir, api.url);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /not the built commit/);
    assert.equal(api.calls.filter((c) => c.method !== 'GET').length, 0);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('refRoute refuses empty and dot segments', async () => {
  const { refRoute } = await import(script);
  assert.equal(refRoute('a/b'), 'refs/heads/a/b');
  assert.equal(refRoute('X#y'), 'refs/heads/X%23y');
  assert.equal(refRoute('fix?x=1'), 'refs/heads/fix%3Fx%3D1');
  assert.equal(refRoute('pct%41b'), 'refs/heads/pct%2541b');
  for (const bad of ['', 'a//b', '../main', 'a/./b', '/a']) assert.throws(() => refRoute(bad), /refusing|empty/);
});

await check('--strict: a change outside the gated paths stops before any API call', async () => {
  const r = driftRepo(); // also changes src/skills/a.md and the excluded hook dist
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head });
  try {
    const res = await runScript(r.dir, api.url, 'feat/x', ['--strict']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /changes outside the gated paths: .*src\/skills\/a\.md/);
    assert.equal(api.calls.length, 0);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('--strict: gated-only changes commit normally', async () => {
  const r = driftRepo();
  r.git('checkout', '-q', '--', 'src/skills/a.md', 'plugins/ork/hooks/dist/bundle.js');
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head });
  try {
    const res = await runScript(r.dir, api.url, 'feat/x', ['--strict']);
    assert.equal(res.status, 0, res.out);
    assert.equal(api.calls.filter((c) => c.method === 'PATCH').length, 1);
  } finally {
    await api.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

await check('drift: blobs + tree + unsigned-author commit + fast-forward ref update', async () => {
  const r = driftRepo();
  const head = r.git('rev-parse', 'HEAD');
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head });
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
    assert.equal(api.calls.find((c) => c.method === 'GET').url, '/repos/o/r/git/ref/heads/feat/x');
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
  const api = await fakeGitHub({ treeSha: r.tree, headSha: r.head, verified: false });
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
  const api = await fakeGitHub({ treeSha: 'f'.repeat(40), headSha: r.head });
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

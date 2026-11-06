#!/usr/bin/env node
// Tests for scripts/ci/dist-sync.mjs and the release.yml sync-dist job: on a
// GA tag, plugins/ork is published to yonatangross/orchestkit-plugin as one
// signed API commit at the repo root, main moves fast-forward only, the same
// tag lands on that commit, a re-run is a no-op, the push retries once and
// then fails loudly, and a missing repo fails with the setup step named.
//
// The fake GitHub Git Data API below keeps real state (refs, commits, trees)
// and computes REAL git tree ids with `git write-tree --missing-ok` in a
// scratch repo, so the script's "API tree id must equal the local one" check
// is exercised against git itself, not against a value the test made up.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts/ci/dist-sync.mjs');
const workflowPath = join(root, '.github/workflows/release.yml');

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

const gitBlobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const tmpDirs = [];
const tmp = (p) => {
  const d = mkdtempSync(join(tmpdir(), p));
  tmpDirs.push(d);
  return d;
};

// Source repo: a stand-in orchestkit with plugins/ork, a LICENSE and noise
// outside plugins/ork that must never reach the dist tree.
function makeSource({ withPluginJson = true, extra = {} } = {}) {
  const dir = tmp('ork-dist-src-');
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, stdio: 'pipe' }).toString().trim();
  const put = (file, data) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), data);
  };
  git('init', '-q', '-b', 'main');
  if (withPluginJson) put('plugins/ork/.claude-plugin/plugin.json', '{"name":"ork","version":"1.2.3"}\n');
  put('plugins/ork/skills/a/SKILL.md', 'skill a\n');
  put('plugins/ork/hooks/run.sh', '#!/bin/sh\necho hook\n');
  put('plugins/ork/.claude-plugin/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x01]));
  put('LICENSE', 'MIT orchestkit\n');
  put('src/outside.md', 'never copied\n');
  put('plugins/other/x.md', 'never copied\n');
  for (const [f, d] of Object.entries(extra)) put(f, d);
  chmodSync(join(dir, 'plugins/ork/hooks/run.sh'), 0o755);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { dir, git, put, head: git('rev-parse', 'HEAD') };
}

// Fake GitHub. Trees are stored as flat {path: {mode, sha}} maps; the tree id
// is git's own, from a scratch index in a scratch repo.
async function fakeGitHub({ exists = true, empty = false, verified = true, patchFailures = 0, distLicense = 'MIT dist\n' } = {}) {
  const scratch = tmp('ork-dist-fake-');
  execFileSync('git', ['init', '-q', '--bare', scratch], { env });
  const treeId = (flat) => {
    const idx = join(scratch, `index-${Math.random().toString(36).slice(2)}`);
    const e = { ...env, GIT_DIR: scratch, GIT_INDEX_FILE: idx };
    const info = Object.entries(flat).map(([p, v]) => `${v.mode} ${v.sha}\t${p}\0`).join('');
    execFileSync('git', ['update-index', '-z', '--index-info'], { env: e, input: info });
    const id = execFileSync('git', ['write-tree', '--missing-ok'], { env: e }).toString().trim();
    rmSync(idx, { force: true });
    return id;
  };
  const trees = new Map();
  const commits = new Map();
  const refs = new Map();
  const blobs = new Set();
  const storeTree = (flat) => {
    const id = treeId(flat);
    trees.set(id, flat);
    return id;
  };
  if (!empty) {
    const readme = Buffer.from('# orchestkit-plugin\n');
    const flat = { 'README.md': { mode: '100644', sha: gitBlobSha(readme) } };
    if (distLicense !== null) flat.LICENSE = { mode: '100644', sha: gitBlobSha(Buffer.from(distLicense)) };
    for (const v of Object.values(flat)) blobs.add(v.sha);
    const t = storeTree(flat);
    commits.set('1'.repeat(40), { tree: t, parents: [] });
    refs.set('refs/heads/main', '1'.repeat(40));
  }
  let commitN = 0;
  let patchLeft = patchFailures;
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = body ? JSON.parse(body) : undefined;
      const url = new URL(req.url, 'http://x');
      const path = url.pathname.replace(/^\/repos\/o\/dist/, '');
      calls.push({ method: req.method, path, body: json, auth: req.headers.authorization });
      const send = (status, obj) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (!exists || !url.pathname.startsWith('/repos/o/dist')) return send(404, { message: 'Not Found' });
      if (req.method === 'GET' && path === '') return send(200, { full_name: 'o/dist' });
      let m;
      if (req.method === 'GET' && (m = path.match(/^\/git\/ref\/(heads|tags)\/(.+)$/))) {
        if (empty) return send(409, { message: 'Git Repository is empty.' });
        const ref = `refs/${m[1]}/${decodeURIComponent(m[2])}`;
        if (!refs.has(ref)) return send(404, { message: 'Not Found' });
        return send(200, { ref, object: { type: 'commit', sha: refs.get(ref) } });
      }
      if (req.method === 'GET' && (m = path.match(/^\/git\/commits\/(\w+)$/))) {
        const c = commits.get(m[1]);
        return c ? send(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })) }) : send(404, {});
      }
      if (req.method === 'GET' && (m = path.match(/^\/git\/trees\/(\w+)$/))) {
        const flat = trees.get(m[1]);
        if (!flat) return send(404, {});
        return send(200, { sha: m[1], truncated: false, tree: Object.entries(flat).map(([p, v]) => ({ path: p, mode: v.mode, type: 'blob', sha: v.sha })) });
      }
      if (req.method === 'POST' && path === '/git/blobs') {
        const sha = gitBlobSha(Buffer.from(json.content, json.encoding === 'base64' ? 'base64' : 'utf8'));
        blobs.add(sha);
        return send(201, { sha });
      }
      if (req.method === 'POST' && path === '/git/trees') {
        let flat = {};
        if (json.base_tree) {
          if (!trees.has(json.base_tree)) return send(422, { message: 'base_tree not found' });
          flat = { ...trees.get(json.base_tree) };
        }
        for (const e of json.tree) {
          let sha = e.sha;
          if (e.content !== undefined) {
            sha = gitBlobSha(Buffer.from(e.content, 'utf8'));
            blobs.add(sha);
          } else if (!blobs.has(sha)) {
            return send(422, { message: `tree.sha ${sha} is not a valid blob` });
          }
          flat[e.path] = { mode: e.mode, sha };
        }
        return send(201, { sha: storeTree(flat) });
      }
      if (req.method === 'POST' && path === '/git/commits') {
        if (json.author || json.committer) return send(422, { message: 'test forbids author/committer' });
        const sha = createHash('sha1').update(`c${++commitN}${json.tree}`).digest('hex');
        commits.set(sha, { tree: json.tree, parents: json.parents, message: json.message });
        return send(201, { sha, verification: { verified, reason: verified ? 'valid' : 'unsigned' } });
      }
      if (req.method === 'PATCH' && path === '/git/refs/heads/main') {
        if (patchLeft > 0) {
          patchLeft--;
          return send(502, { message: 'Bad Gateway' });
        }
        const c = commits.get(json.sha);
        if (json.force !== false) return send(422, { message: 'test requires force:false' });
        if (!c || !c.parents.includes(refs.get('refs/heads/main'))) return send(422, { message: 'Update is not a fast forward' });
        refs.set('refs/heads/main', json.sha);
        return send(200, { ref: 'refs/heads/main', object: { type: 'commit', sha: json.sha } });
      }
      if (req.method === 'POST' && path === '/git/refs') {
        if (refs.has(json.ref)) return send(422, { message: 'Reference already exists' });
        refs.set(json.ref, json.sha);
        return send(201, { ref: json.ref, object: { type: 'commit', sha: json.sha } });
      }
      send(404, { message: 'Not Found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    apiUrl,
    calls,
    refs,
    commits,
    trees,
    flatAt: (commitSha) => trees.get(commits.get(commitSha).tree),
    close: () => new Promise((r) => server.close(r)),
  };
}

function runScript(cwd, apiUrl, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, '--repo', 'o/dist', ...args], {
      cwd,
      env: { ...env, GH_TOKEN: 'test-token', GITHUB_API_URL: apiUrl, DIST_SYNC_RETRY_DELAY_MS: '0', ...extraEnv },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => resolve({ status, out }));
  });
}

// ---------------------------------------------------------------- behaviour

await check('first sync: plugins/ork at the root, signed commit, main fast-forwarded, tag on it', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 0, res.out);
    const main = gh.refs.get('refs/heads/main');
    assert.notEqual(main, '1'.repeat(40), 'main moved');
    assert.equal(gh.refs.get('refs/tags/v1.2.3'), main, 'tag on the same commit as main');
    const c = gh.commits.get(main);
    assert.deepEqual(c.parents, ['1'.repeat(40)], 'one commit on top of the old main');
    assert.match(c.message, /^chore\(dist\): sync plugins\/ork from orchestkit v1\.2\.3\n/);
    const flat = gh.flatAt(main);
    assert.deepEqual(Object.keys(flat).sort(), [
      '.claude-plugin/icon.png',
      '.claude-plugin/plugin.json',
      'LICENSE',
      'README.md',
      'hooks/run.sh',
      'skills/a/SKILL.md',
    ]);
    assert.equal(flat['hooks/run.sh'].mode, '100755', 'exec bit kept');
    assert.equal(flat.LICENSE.sha, gitBlobSha(Buffer.from('MIT dist\n')), "dist repo's own LICENSE kept");
    const icon = readFileSync(join(src.dir, 'plugins/ork/.claude-plugin/icon.png'));
    assert.equal(flat['.claude-plugin/icon.png'].sha, gitBlobSha(icon), 'binary file byte-exact');
    assert.equal(gh.calls.filter((x) => x.path === '/git/blobs').length, 1, 'only the non-UTF-8 file goes through /git/blobs');
    assert.ok(gh.calls.every((x) => x.auth === 'Bearer test-token'));
  } finally {
    await gh.close();
  }
});

await check('README says generated and points at orchestkit', async () => {
  const { readmeText, HOME_URL } = await import(script);
  const t = readmeText('1.2.3');
  assert.match(t, /Generated/);
  assert.ok(t.includes(HOME_URL));
  assert.equal(HOME_URL, 'https://github.com/yonatangross/orchestkit');
  assert.doesNotMatch(t, /—|–/, 'no em or en dash');
});

await check('re-run for the same tag and tree is a no-op success', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    const before = gh.calls.length;
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 0, res.out);
    assert.match(res.out, /already holds tree .*nothing to do/);
    const writes = gh.calls.slice(before).filter((x) => x.method !== 'GET');
    assert.equal(writes.length, 0, `no writes on re-run: ${JSON.stringify(writes.map((w) => w.path))}`);
  } finally {
    await gh.close();
  }
});

await check('tag exists with a different tree: fails loudly, nothing moved', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    src.put('plugins/ork/skills/a/SKILL.md', 'changed after the tag\n');
    src.git('commit', '-qam', 'change');
    const main = gh.refs.get('refs/heads/main');
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /::error::.*tag v1\.2\.3 already exists .*never moved/);
    assert.equal(gh.refs.get('refs/heads/main'), main);
  } finally {
    await gh.close();
  }
});

await check('next release: one more commit on top, unchanged blobs go by sha', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    const first = gh.refs.get('refs/heads/main');
    src.put('plugins/ork/skills/a/SKILL.md', 'skill a v2\n');
    src.git('commit', '-qam', 'v1.2.4');
    const before = gh.calls.length;
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.4']);
    assert.equal(res.status, 0, res.out);
    const main = gh.refs.get('refs/heads/main');
    assert.deepEqual(gh.commits.get(main).parents, [first]);
    assert.equal(gh.refs.get('refs/tags/v1.2.4'), main);
    assert.equal(gh.refs.get('refs/tags/v1.2.3'), first, 'old tag untouched');
    const treeCalls = gh.calls.slice(before).filter((x) => x.path === '/git/trees' && x.method === 'POST');
    const inline = treeCalls.flatMap((x) => x.body.tree).filter((e) => e.content !== undefined).map((e) => e.path);
    assert.deepEqual(inline.sort(), ['README.md', 'skills/a/SKILL.md'], 'only changed files carry content');
    assert.equal(gh.calls.slice(before).filter((x) => x.path === '/git/blobs').length, 0);
  } finally {
    await gh.close();
  }
});

// v10.9.1 and v10.10.0 failed four times on POST /git/trees, HTTP 502 at about
// 10.8 seconds, GitHub's request limit. Files the dist repo already has go by sha
// and cost no bytes, so nearly all 1,879 entries landed in one request.
await check('a release caps entries per tree request, including sha-only ones', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    const whole = gh.flatAt(gh.refs.get('refs/heads/main'));
    assert.ok(Object.keys(whole).length > 2, 'fixture needs more entries than the cap');
    src.put('plugins/ork/skills/a/SKILL.md', 'skill a v2\n');
    src.git('commit', '-qam', 'v1.2.4');
    const before = gh.calls.length;
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.4'], { DIST_SYNC_TREE_ENTRIES: '2' });
    assert.equal(res.status, 0, res.out);
    const treeCalls = gh.calls.slice(before).filter((x) => x.path === '/git/trees' && x.method === 'POST');
    assert.ok(treeCalls.length > 1, 'entries span more than one request');
    for (const call of treeCalls) assert.ok(call.body.tree.length <= 2, `${call.body.tree.length} entries in one request`);
    assert.equal(treeCalls[0].body.base_tree, undefined, 'the first request starts clean, so removals stay removed');
    const flat = gh.flatAt(gh.refs.get('refs/heads/main'));
    assert.deepEqual(Object.keys(flat).sort(), Object.keys(whole).sort(), 'the chain yields the whole tree');
  } finally {
    await gh.close();
  }
});

await check('the default entry cap stays well under the 10 second limit', () => {
  const source = readFileSync(script, 'utf8');
  const match = source.match(/DIST_SYNC_TREE_ENTRIES \?\? (\d+)/);
  assert.ok(match, 'dist-sync.mjs reads DIST_SYNC_TREE_ENTRIES with a default');
  assert.ok(Number(match[1]) <= 500, `default ${match[1]} entries`);
});

// NaN never reaches the cap in `open.length >= TREE_ENTRIES`, so a typo in this
// variable would send every entry in one request, the failure the cap exists for.
for (const bad of ['oops', '0', '-1', '2.5', '']) {
  await check(`an entry cap of ${JSON.stringify(bad)} stops the sync before any write`, async () => {
    const src = makeSource();
    const gh = await fakeGitHub();
    try {
      const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'], { DIST_SYNC_TREE_ENTRIES: bad });
      assert.equal(res.status, 1, res.out);
      assert.match(res.out, /DIST_SYNC_TREE_ENTRIES/);
      assert.equal(gh.calls.filter((x) => x.method !== 'GET').length, 0, 'no write reached the API');
    } finally {
      await gh.close();
    }
  });
}

await check('a file removed from plugins/ork disappears from the dist tree', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    src.git('rm', '-q', 'plugins/ork/skills/a/SKILL.md');
    src.git('commit', '-qm', 'drop a');
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.4'])).status, 0);
    assert.ok(!gh.flatAt(gh.refs.get('refs/heads/main'))['skills/a/SKILL.md']);
  } finally {
    await gh.close();
  }
});

await check('--no-move-main (older tag): commit and tag created, main untouched', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3', '--no-move-main']);
    assert.equal(res.status, 0, res.out);
    assert.equal(gh.refs.get('refs/heads/main'), '1'.repeat(40));
    const tagged = gh.refs.get('refs/tags/v1.2.3');
    assert.ok(tagged && tagged !== '1'.repeat(40));
    assert.equal(gh.calls.filter((x) => x.method === 'PATCH').length, 0);
  } finally {
    await gh.close();
  }
});

await check('push fails once: retried, then synced', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ patchFailures: 1 });
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 0, res.out);
    assert.match(res.out, /::warning::dist sync attempt 1 failed: PATCH .*HTTP 502/);
    assert.equal(gh.calls.filter((x) => x.method === 'PATCH').length, 2);
    assert.equal(gh.refs.get('refs/tags/v1.2.3'), gh.refs.get('refs/heads/main'));
  } finally {
    await gh.close();
  }
});

await check('push fails twice: fails loudly after 2 attempts, no tag', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ patchFailures: 2 });
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /::error::dist sync of v1\.2\.3 to o\/dist failed after 2 attempts: PATCH .*HTTP 502/);
    assert.equal(gh.calls.filter((x) => x.method === 'PATCH').length, 2, 'exactly one retry');
    assert.ok(!gh.refs.has('refs/tags/v1.2.3'));
  } finally {
    await gh.close();
  }
});

await check('dist repo missing (404): fails at once with the setup step named', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ exists: false });
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /::error::.*not reachable \(HTTP 404.*install the OrchestKit Release Bot/);
    assert.doesNotMatch(res.out, /retrying/, 'a setup gap is not retried');
    assert.equal(gh.calls.length, 1);
  } finally {
    await gh.close();
  }
});

await check('dist repo empty (no main): fails with the initialise step named', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ empty: true });
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /::error::.*has no main branch \(HTTP 409.*initialised with a README/);
    assert.equal(gh.calls.filter((x) => x.method !== 'GET').length, 0);
  } finally {
    await gh.close();
  }
});

await check('unsigned commit: no ref is touched', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ verified: false });
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
    assert.equal(res.status, 1, res.out);
    assert.match(res.out, /did not sign/);
    assert.equal(gh.calls.filter((x) => x.method === 'PATCH' || x.path === '/git/refs').length, 0);
  } finally {
    await gh.close();
  }
});

await check('no LICENSE in the dist repo: orchestkit LICENSE is used', async () => {
  const src = makeSource();
  const gh = await fakeGitHub({ distLicense: null });
  try {
    assert.equal((await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3'])).status, 0);
    const flat = gh.flatAt(gh.refs.get('refs/heads/main'));
    assert.equal(flat.LICENSE.sha, gitBlobSha(Buffer.from('MIT orchestkit\n')));
  } finally {
    await gh.close();
  }
});

await check('prerelease version: skipped with exit 3 and no API call', async () => {
  const src = makeSource();
  const gh = await fakeGitHub();
  try {
    const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3-alpha.1']);
    assert.equal(res.status, 3, res.out);
    assert.match(res.out, /not a GA version/);
    assert.equal(gh.calls.length, 0);
  } finally {
    await gh.close();
  }
});

await check('missing .claude-plugin/plugin.json or a README.md collision is refused before any write', async () => {
  for (const [opts, re] of [
    [{ withPluginJson: false }, /plugin\.json is missing/],
    [{ extra: { 'plugins/ork/README.md': 'x\n' } }, /would collide/],
  ]) {
    const src = makeSource(opts);
    const gh = await fakeGitHub();
    try {
      const res = await runScript(src.dir, gh.apiUrl, ['--version', '1.2.3']);
      assert.equal(res.status, 1, res.out);
      assert.match(res.out, re);
      assert.equal(gh.calls.filter((x) => x.method !== 'GET').length, 0);
    } finally {
      await gh.close();
    }
  }
});

await check('isGaVersion', async () => {
  const { isGaVersion } = await import(script);
  for (const v of ['0.0.1', '10.8.5', '1.20.300']) assert.ok(isGaVersion(v), v);
  for (const v of ['10.0.0-alpha.1', 'v1.2.3', '01.2.3', '1.2', '1.2.3.4', '']) assert.ok(!isGaVersion(v), v);
});

// ---------------------------------------------------------------- workflow

const wfCode = readFileSync(workflowPath, 'utf8')
  .split('\n')
  .filter((l) => !l.trim().startsWith('#'))
  .join('\n');
function jobs() {
  const at = wfCode.indexOf('\njobs:\n');
  assert.ok(at > 0, 'jobs: block');
  const out = {};
  for (const m of wfCode.slice(at).matchAll(/\n {2}([a-z][\w-]*):\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n|$)/g)) out[m[1]] = m[2];
  return out;
}

await check('release.yml: a manual dispatch runs only the dry run, every release job is tag-push only', () => {
  assert.match(wfCode, /^on:\n {2}push:\n {4}tags:\n {6}- 'v\*'\n {2}workflow_dispatch:\n {4}inputs:\n {6}dry_run:\n[\s\S]*?type: boolean\n {8}default: true\n/m);
  assert.doesNotMatch(wfCode, /pull_request/);
  const all = jobs();
  assert.ok(all['dist-dry-run'], 'dist-dry-run job exists');
  for (const [name, body] of Object.entries(all)) {
    if (name === 'dist-dry-run') continue;
    assert.match(body, /^ {4}if: github\.event_name == 'push'/m, `${name} must be gated to tag pushes`);
  }
});

await check('release.yml dist-dry-run job: token as the real job, two GETs, no write, no token printed', () => {
  const job = jobs()['dist-dry-run'];
  assert.match(job, /if: github\.event_name == 'workflow_dispatch' && github\.repository == 'yonatangross\/orchestkit'/);
  assert.match(job, /permissions: \{\}/);
  assert.match(job, /if: \$\{\{ !inputs\.dry_run \}\}\n[\s\S]*?::error::[\s\S]*?exit 1/, 'dry_run=false refused');
  const mint = (body) => body.match(/uses: actions\/create-github-app-token@[\s\S]*?permission-contents: write\n/)[0];
  assert.equal(mint(job), mint(jobs()['sync-dist']), 'token minted exactly as sync-dist does');
  assert.match(job, /gh api \/installation\/repositories/);
  assert.match(job, /gh api "\/repos\/\$DIST" --jq '\.permissions\.push/);
  assert.match(job, /grep -qxF "\$DIST"[\s\S]*?::error::[\s\S]*?exit 1/);
  assert.match(job, /repositories: orchestkit-plugin\n {10}permission-contents: write\n/, 'the mint is the write proof');
  assert.match(job, /echo "permissions\.push on \$DIST \(info only\): \$push"/);
  assert.doesNotMatch(job, /\$push"? *!?= *"?true/, 'never fails on permissions.push');
  assert.doesNotMatch(job, /actions\/checkout|dist-sync\.mjs|git push|--method|\s-X\s|\s-[fF]\s|\bcurl\b/, 'read-only');
  assert.doesNotMatch(job, /(echo|printf)[^\n]*(GH_TOKEN|steps\.dist-token\.outputs\.token)/, 'token never printed');
  assert.equal((job.match(/gh api /g) || []).length, 2, 'exactly two API calls');
  for (const m of job.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `unpinned: ${m[1]}`);
});

await check('release.yml sync-dist job: trigger, scope, pins, loud failure', () => {
  const job = jobs()['sync-dist'];
  assert.ok(job, 'sync-dist job exists');
  assert.match(job, /needs: create-release/);
  assert.match(job, /if: github\.event_name == 'push' && github\.repository == 'yonatangross\/orchestkit'/, 'tag push only, never on forks');
  assert.match(job, /permissions:\n {6}contents: read/);
  assert.match(job, /repositories: orchestkit-plugin\n/, 'token scoped to the dist repo only');
  assert.doesNotMatch(job, /repositories: orchestkit\n/);
  assert.doesNotMatch(job, /continue-on-error/, 'no advisory step');
  assert.match(job, /if: failure\(\) && steps\.dist-token\.outcome == 'failure'[\s\S]*?::error::[^\n]*install the app[\s\S]*?exit 1/);
  assert.match(job, /merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/, 'main only');
  assert.match(job, /node scripts\/ci\/dist-sync\.mjs "\$\{ARGS\[@\]\}"/);
  assert.match(job, /--source-ref "\$GITHUB_SHA"/);
  assert.match(job, /persist-credentials: false/);
  assert.doesNotMatch(job, /git push|npm (ci|install)/, 'no runner-side push, no dependency install');
  assert.doesNotMatch(job, /\$\{\{[^}]*github\.event/, 'no event data interpolated into run');
  for (const m of job.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `unpinned: ${m[1]}`);
});

for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all release dist-sync checks passed');

#!/usr/bin/env node
// A published release shows its own media: scripts/ci/release-media-body.mjs
// builds the body, and release-video.yml writes it after the assets upload.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'ci', 'release-media-body.mjs');
const { embedMedia } = await import(SCRIPT);

const TAG = 'v1.2.3';
const url = name => `https://github.com/o/r/releases/download/${TAG}/${name}`;
const asset = (name, extra = {}) => ({ name, url: url(name), size: 10, state: 'uploaded', ...extra });
const NAMES = ['release-1.2.3-preview.gif', 'release-1.2.3-landscape.mp4', 'release-1.2.3-square.mp4'];
const ASSETS = NAMES.map(name => asset(name));
const NOTES = '## 1.2.3\n\n* a fix\n';

test('puts the gif inline at the top with both mp4 links, notes unchanged below', () => {
  const out = embedMedia(NOTES, TAG, ASSETS);
  assert.ok(out.startsWith('<!-- release-media:start -->\n'));
  assert.ok(out.includes(`![Release ${TAG} preview](${url(NAMES[0])})`));
  assert.ok(out.includes(`[landscape mp4](${url(NAMES[1])})`));
  assert.ok(out.includes(`[square mp4](${url(NAMES[2])})`));
  assert.ok(out.endsWith(NOTES));
});

test('a second run replaces its own block, never stacks one', () => {
  const once = embedMedia(NOTES, TAG, ASSETS);
  assert.equal(embedMedia(once, TAG, ASSETS), once);
});

test('leaves a body alone that already embeds the gif by hand', () => {
  const byHand = `![x](${url(NAMES[0])})\n\n${NOTES}`;
  assert.equal(embedMedia(byHand, TAG, ASSETS), byHand);
});

test('a plain link to the gif is not an embed', () => {
  const linked = `see ${url(NAMES[0])}\n`;
  assert.notEqual(embedMedia(linked, TAG, ASSETS), linked);
});

const GIF = url(NAMES[0]);
const NOT_AN_EMBED = {
  'a labeled link': `[download the preview](${GIF})`,
  'a labeled link with a bang before a space': `Look! [preview](${GIF})`,
  'an autolink': `<${GIF}>`,
  'an escaped image': `\\![preview](${GIF})`,
  'an image in a code span': `write \`![preview](${GIF})\` to embed it`,
  'an image in a fenced block': `\`\`\`md\n![preview](${GIF})\n\`\`\``,
  'an image in a tilde fence': `~~~\n![preview](${GIF})\n~~~`,
  'an image in an unclosed fence': `\`\`\`\n![preview](${GIF})`,
  'an image in an indented code block': `text\n\n    ![preview](${GIF})`,
  'an image in an HTML comment': `<!-- ![preview](${GIF}) -->`,
  'an image of another file': `![preview](${GIF}.png)`,
  // Removed text must not join what stood on either side of it.
  'a bang split from a link by a code span': `!\`x\`[preview](${GIF})`,
  'a bang split from a link by a comment': `!<!-- x -->[preview](${GIF})`,
  'a link split from its url by a comment': `![preview]<!-- x -->(${GIF})`,
  'a link split from its url by a code span': `![preview]\`x\`(${GIF})`,
};

for (const [label, text] of Object.entries(NOT_AN_EMBED)) {
  test(`adds the media when the notes hold only ${label}`, () => {
    const body = `${text}\n\n${NOTES}`;
    const out = embedMedia(body, TAG, ASSETS);
    assert.ok(out.startsWith('<!-- release-media:start -->\n'), out.slice(0, 80));
    assert.ok(out.includes(`[landscape mp4](${url(NAMES[1])})`));
    assert.ok(out.includes(`[square mp4](${url(NAMES[2])})`));
    assert.ok(out.endsWith(body));
  });
}

for (const [label, text] of Object.entries({
  'with a title': `![preview](${GIF} "release")`,
  'inside a link': `[![preview](${GIF})](https://example.com)`,
  'after text on the line': `Watch: ![preview](${GIF})`,
})) {
  test(`leaves a hand embed alone ${label}`, () => {
    const body = `${text}\n\n${NOTES}`;
    assert.equal(embedMedia(body, TAG, ASSETS), body);
  });
}

test('a marker quoted inside the notes is text, not our block', () => {
  for (const quoted of ['* fix: handle <!-- release-media:start --> markers', '<!-- release-media:start -->\nx\n<!-- release-media:end -->']) {
    const body = `${NOTES}\n${quoted}\n`;
    const out = embedMedia(body, TAG, ASSETS);
    assert.ok(out.startsWith('<!-- release-media:start -->\n![Release'));
    assert.ok(out.endsWith(body));
  }
});

test('an empty body still gets the media', () => {
  assert.ok(embedMedia('', TAG, ASSETS).includes(url(NAMES[0])));
});

for (const name of NAMES) {
  test(`fails when ${name} is missing`, () => {
    assert.throws(() => embedMedia(NOTES, TAG, ASSETS.filter(a => a.name !== name)), new RegExp(name));
  });
  test(`fails when ${name} is empty or not uploaded`, () => {
    for (const bad of [{ size: 0 }, { state: 'starter' }, { url: '' }]) {
      const assets = ASSETS.map(a => (a.name === name ? { ...a, ...bad } : a));
      assert.throws(() => embedMedia(NOTES, TAG, assets), new RegExp(name));
    }
  });
}

test('fails on an unreadable release: no body or no asset list', () => {
  assert.throws(() => embedMedia(undefined, TAG, ASSETS), /body/);
  assert.throws(() => embedMedia(NOTES, TAG, undefined), /assets/);
  assert.throws(() => embedMedia(NOTES, '', ASSETS), /tag/);
});

test('fails on a start marker with no end marker', () => {
  assert.throws(() => embedMedia(`<!-- release-media:start -->\n${NOTES}`, TAG, ASSETS), /marker/);
});

test('CLI writes the body file, and writes nothing on truncated input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-media-'));
  try {
    const input = join(dir, 'release.json');
    const output = join(dir, 'body.md');
    writeFileSync(input, JSON.stringify({ body: NOTES, assets: ASSETS }));
    assert.equal(spawnSync('node', [SCRIPT, TAG, input, output]).status, 0);
    assert.ok(readFileSync(output, 'utf8').includes(url(NAMES[0])));

    rmSync(output);
    writeFileSync(input, '{"body":"x","assets":[');
    assert.notEqual(spawnSync('node', [SCRIPT, TAG, input, output]).status, 0);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the ffmpeg install gets more than the 90 s default (v10.18.1 and v10.20.0 died on it)', () => {
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'release-video.yml'), 'utf8');
  const step = yml.slice(yml.indexOf('- name: Install ffmpeg'), yml.indexOf('- name: Install demo dependencies'));
  assert.ok(step.includes('ensure-system-deps.sh ffmpeg'));
  const seconds = Number(/SYSTEM_DEPS_TIMEOUT:\s*'(\d+)'/.exec(step)?.[1]);
  assert.ok(seconds >= 300, `timeout is ${seconds}`);
});

test('release-video.yml embeds after the upload, in the same job', () => {
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'release-video.yml'), 'utf8');
  const job = yml.slice(yml.indexOf('\n  upload-to-release:'));
  const upload = job.indexOf('gh release upload');
  const embed = job.indexOf('node scripts/ci/release-media-body.mjs');
  const edit = job.indexOf('gh release edit');
  assert.ok(upload > 0 && embed > upload && edit > embed);
  assert.ok(job.includes('actions/checkout@'), 'the job needs the script in its workspace');
  assert.ok(job.includes('set -euo pipefail'));
});

#!/usr/bin/env node
// ============================================================================
// changelog-x: post format, the 280 character split, and the preview-only gate
// ============================================================================
// WHAT THIS GUARDS
//
//   scripts/changelog-x.mjs builds the posts for the X changelog feed
//   (.github/workflows/release-changelog-x.yml). These cases make sure that:
//   1. Every post is 280 weighted characters or less, also for long input.
//   2. URLs count as 23 and emoji count as 2, as X counts them.
//   3. More than 3 changes make a thread. 3 or fewer make one post.
//   4. The only hashtag is #ClaudeCode. Mentions are neutralized.
//   5. The docs link carries the UTM parameters for the version.
//   6. Preview only: DRY_RUN=false is refused, and no X client ships.
//   7. The upstream diff posts only versions newer than the last seen one.
//
// No network. No X call.
// ============================================================================

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_POST,
  weightedLength,
  truncate,
  splitText,
  cleanItem,
  docsLink,
  buildThread,
  buildReleasePosts,
  buildBetaDigestPosts,
  buildUpstreamPosts,
  allWithinLimit,
} from '../../scripts/lib/changelog-x-format.mjs';
import { assertPreviewOnly, PREVIEW_ONLY_ERROR, newSince, recentPrereleases, readState, renderSummary } from '../../scripts/changelog-x.mjs';
import { parseChangelog } from '../../scripts/changelog-to-props.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'changelog-x.mjs');

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL ${name}\n    ${e.message.split('\n').join('\n    ')}`);
  }
}

const long = (n, word = 'word') => Array.from({ length: n }, (_, i) => `${word}${i}`).join(' ');

console.log('changelog-x format');

check('weightedLength counts a URL as 23', () => {
  assert.equal(weightedLength('see https://example.com/a/very/long/path?with=query&and=more'), 4 + 23);
});

check('weightedLength counts emoji and CJK as 2', () => {
  assert.equal(weightedLength('a\u{1F680}'), 3);
  assert.equal(weightedLength('中'), 2);
});

check('truncate keeps short text and cuts long text to the budget', () => {
  assert.equal(truncate('short', 50), 'short');
  const t = truncate(long(100), 60);
  assert.ok(weightedLength(t) <= 60, `got ${weightedLength(t)}`);
  assert.ok(t.endsWith('...'));
});

check('splitText makes parts of 280 or less and keeps every word', () => {
  const text = long(400);
  const parts = splitText(text, MAX_POST);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(weightedLength(p) <= MAX_POST, `part is ${weightedLength(p)}`);
  assert.equal(parts.join(' '), text);
});

check('splitText cuts a single word longer than the limit', () => {
  const parts = splitText('x'.repeat(700), MAX_POST);
  assert.deepEqual(parts.map((p) => p.length), [280, 280, 140]);
});

check('cleanItem removes markdown, release-please links and extra hashtags', () => {
  const out = cleanItem('* **hooks:** add `foo` for #bar ([#12](https://x/y)) ([abc1234](https://x/z))');
  assert.equal(out, 'hooks: add foo for bar');
  assert.equal(cleanItem('fix #123 and #ClaudeCode'), 'fix #123 and #ClaudeCode');
});

check('cleanItem stops @mentions', () => {
  assert.equal(cleanItem('thanks @someone'), 'thanks @​someone');
});

check('docsLink carries the UTM parameters and the version anchor', () => {
  assert.equal(
    docsLink('10.1.0'),
    'https://orchestkit.yonyon.ai/changelog?utm_source=x&utm_medium=social&utm_campaign=v10.1.0#10.1.0',
  );
});

check('3 items or fewer make one post', () => {
  const posts = buildThread({ headline: 'H', items: ['a', 'b', 'c'], link: 'https://e.com' });
  assert.equal(posts.length, 1);
  assert.match(posts[0], /^H\n\n- a\n- b\n- c\n\nhttps:\/\/e\.com #ClaudeCode$/);
});

check('more than 3 items make a thread, with the top 3 first', () => {
  const posts = buildThread({ headline: 'H', items: ['a', 'b', 'c', 'd', 'e'], link: 'https://e.com' });
  assert.equal(posts.length, 2);
  assert.match(posts[0], /- a\n- b\n- c\n\n\+2 more/);
  assert.equal(posts[1], '- d\n- e');
});

check('long items stay within 280 in every post', () => {
  const items = Array.from({ length: 30 }, () => long(80));
  const posts = buildThread({ headline: long(10), items, link: docsLink('1.2.3') });
  assert.ok(allWithinLimit(posts), posts.map(weightedLength).join(','));
  assert.ok(posts.length <= 6, `${posts.length} posts`);
  assert.match(posts[posts.length - 1], /\+\d+ more: https:/);
});

check('a very long headline still fits', () => {
  const posts = buildThread({ headline: long(200), items: ['a'], link: 'https://e.com' });
  assert.ok(allWithinLimit(posts));
  assert.ok(posts[0].endsWith('https://e.com #ClaudeCode'));
});

check('the hashtag is #ClaudeCode only, and on the first post only', () => {
  const posts = buildThread({ headline: 'H', items: Array.from({ length: 12 }, (_, i) => `item ${i} #tag`), link: 'https://e.com' });
  const tags = posts.join('\n').match(/#[A-Za-z_]\w*/g) || [];
  assert.deepEqual(tags, ['#ClaudeCode']);
  assert.ok(posts[0].includes('#ClaudeCode'));
});

check('release posts: headline facts, features first, docs link', () => {
  const parsed = {
    version: '10.1.0',
    date: '2026-10-20',
    highlights: [
      { category: 'fixed', title: 'hooks', description: 'fix a race in the pretool hook' },
      { category: 'added', title: 'skills', description: 'add /ork:x' },
      { category: 'added', title: 'agents', description: 'add a new agent' },
      { category: 'changed', title: 'docs', description: 'docs: move pages' },
    ],
  };
  const posts = buildReleasePosts(parsed);
  assert.equal(posts.length, 2);
  assert.match(posts[0], /^OrchestKit v10\.1\.0 is out \(2026-10-20\)\. 2 features, 1 fix\.\n\n- skills: add \/ork:x\n- agents: add a new agent\n- hooks: fix a race/);
  assert.ok(posts[0].includes('utm_campaign=v10.1.0'));
  assert.equal(posts[1], '- docs: move pages');
});

check('beta digest: one post, version range, change count', () => {
  const betas = [
    { version: '10.0.0-beta.1', highlights: [{ category: 'fixed', title: 'a', description: 'fix a' }] },
    { version: '10.0.0-beta.2', highlights: [{ category: 'added', title: 'b', description: 'add b' }] },
  ];
  const posts = buildBetaDigestPosts(betas, '2026-10-12');
  assert.equal(posts.length, 1);
  assert.match(posts[0], /^Today in OrchestKit beta \(2026-10-12\): 2 releases, v10\.0\.0-beta\.1 to v10\.0\.0-beta\.2, 2 changes\./);
  assert.match(posts[0], /- b: add b\n- a: fix a/);
  assert.equal(buildBetaDigestPosts([], '2026-10-12').length, 0);
});

check('upstream posts use top-level bullets only', () => {
  const body = '- Added A\n  - nested detail\n- Fixed B\n\nprose line';
  const posts = buildUpstreamPosts({ label: 'Claude Code', version: '2.1.300', body, link: 'https://e.com' });
  assert.equal(posts.length, 1);
  assert.match(posts[0], /^Claude Code 2\.1\.300 changelog: 2 entries\.\n\n- Added A\n- Fixed B/);
});

check('preview only: DRY_RUN=false is refused, every other value runs the preview', () => {
  assert.throws(() => assertPreviewOnly({ DRY_RUN: 'false' }), (e) => e.message === PREVIEW_ONLY_ERROR);
  for (const v of [undefined, '', 'true', 'False', 'no', '0']) assert.doesNotThrow(() => assertPreviewOnly({ DRY_RUN: v }), String(v));
});

check('preview only: the CLI refuses DRY_RUN=false before it builds a post', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'upstream', '--source', 'claude-code', '--state-file', '/nonexistent/state.json', '--fixture', '/nonexistent/fixture.md'], {
    env: { ...process.env, DRY_RUN: 'false', GITHUB_STEP_SUMMARY: '', GITHUB_OUTPUT: '' },
    encoding: 'utf8',
  });
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes(PREVIEW_ONLY_ERROR), r.stderr);
});

check('preview only: the script has no X client and no X API host', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(src, /x-client|api\.x\.com|api\.twitter\.com|X_ACCESS_TOKEN/);
  assert.equal(existsSync(join(dirname(SCRIPT), 'lib', 'x-client.mjs')), false);
});

check('newSince: no state records the head and posts nothing', () => {
  const versions = [{ version: '2.1.3' }, { version: '2.1.2' }, { version: '2.1.1' }];
  assert.deepEqual(newSince(versions, null).fresh, []);
  assert.equal(newSince(versions, null).head, '2.1.3');
  assert.deepEqual(newSince(versions, '2.1.1').fresh.map((v) => v.version), ['2.1.2', '2.1.3']);
  assert.deepEqual(newSince(versions, '2.1.3').fresh, []);
  assert.deepEqual(newSince(versions, '9.9.9').fresh, []);
});

check('readState rejects a value that is not a version', () => {
  assert.equal(readState('/nonexistent/state.json'), null);
  const dir = mkdtempSync(join(tmpdir(), 'changelog-x-state-'));
  const file = join(dir, 'state.json');
  writeFileSync(file, JSON.stringify({ last_seen: '$(touch /tmp/pwned)' }));
  assert.equal(readState(file), null);
  writeFileSync(file, JSON.stringify({ last_seen: '2.1.300' }));
  assert.equal(readState(file)?.last_seen, '2.1.300');
  rmSync(dir, { recursive: true, force: true });
});

check('recentPrereleases: last 24 hours, prerelease only, oldest first', () => {
  const now = new Date('2026-10-12T23:30:00Z');
  const rel = [
    { tag_name: 'v10.0.0-beta.3', prerelease: true, draft: false, published_at: '2026-10-12T20:00:00Z' },
    { tag_name: 'v10.0.0-beta.2', prerelease: true, draft: false, published_at: '2026-10-12T01:00:00Z' },
    { tag_name: 'v10.0.0-beta.1', prerelease: true, draft: false, published_at: '2026-10-11T20:00:00Z' },
    { tag_name: 'v9.9.0', prerelease: false, draft: false, published_at: '2026-10-12T10:00:00Z' },
    { tag_name: 'v10.0.0-beta.4', prerelease: true, draft: true, published_at: '2026-10-12T22:00:00Z' },
  ];
  assert.deepEqual(recentPrereleases(rel, now).map((r) => r.tag_name), ['v10.0.0-beta.2', 'v10.0.0-beta.3']);
});

check('renderSummary names the mode and each post length', () => {
  const md = renderSummary({ title: 'T', live: false, threads: [['hello']] });
  assert.match(md, /dry run/);
  assert.match(md, /Post 1\/1 \(5\/280\)/);
});

check('weightedLength never counts a bare domain lower than a URL', () => {
  // X links "x.com" with no scheme and counts it as 23. Counting high is safe.
  assert.equal(weightedLength('x.com'), 23);
  assert.equal(weightedLength('see CLAUDE.md'), 4 + 23);
  // Version numbers are not domains.
  assert.equal(weightedLength('v10.0.0-beta.171'), 16);
});

check('a long changelog entry keeps its links whole (no 120 character cap)', () => {
  const url = 'https://github.com/yonatangross/orchestkit/issues/1403';
  const md = [
    '## [9.9.0](https://example.invalid/compare) (2026-08-10)',
    '',
    '### Features',
    '',
    `* **ci:** de-noise PR rollup signals and auto-sync the version files across every manifest (Closes [#1403](${url}))`,
    '',
  ].join('\n');
  // The video keeps its cap, which cuts this link in half.
  assert.match(parseChangelog(md, '9.9.0').highlights[0].description, /\.\.\.$/);
  const parsed = parseChangelog(md, '9.9.0', { maxDescription: Infinity });
  const posts = buildReleasePosts(parsed);
  assert.ok(allWithinLimit(posts));
  assert.ok(posts[0].includes('(Closes #1403)'), posts[0]);
  assert.ok(!posts[0].includes('github.com/yonatangross/orchestkit/i'), posts[0]);
});

console.log(`\n  Total: ${pass + fail}  |  Passed: ${pass}  |  Failed: ${fail}`);
process.exit(fail ? 1 : 0);

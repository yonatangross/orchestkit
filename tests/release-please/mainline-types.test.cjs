// Release notes must show every unreleased mainline change, on the release PR and on the site.
// Uses release-please's own parser and writer plus the real site generators. See README.md.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

assert.ok(process.env.RELEASE_PLEASE_ROOT, 'Set RELEASE_PLEASE_ROOT per README.md');
const upstream = createRequire(resolve(process.env.RELEASE_PLEASE_ROOT, 'package.json'));
assert.equal(upstream('release-please/package.json').version, '17.6.0');
const { parseConventionalCommits } = upstream('release-please/build/src/commit.js');
const { DefaultChangelogNotes } = upstream('release-please/build/src/changelog-notes/default.js');

const repo = resolve(__dirname, '../..');
const config = require('../../.release-please-config.json');
const sections = config['changelog-sections'];
const byType = new Map(sections.map(entry => [entry.type, entry]));
const visibleNames = new Set(sections.filter(entry => !entry.hidden).map(entry => entry.section));

function parse(message, sha) {
  return parseConventionalCommits([{ sha, message, files: [] }]);
}

function write(commits) {
  return new DefaultChangelogNotes().buildNotes(commits, {
    owner: 'yonatangross', repository: 'orchestkit',
    version: '10.0.0', previousTag: 'v9.0.0', currentTag: 'v10.0.0',
    changelogSections: sections,
  });
}

// The subject of a commit is dropped when the writer leaves it out, or files it under a heading the
// config does not list as visible. A type the config hides on purpose is skipped. No second grammar:
// the parser decides the type, the writer decides the section, the commit sha finds the entry.
// Only the subject line is judged: trailers such as Co-authored-by parse as extra commits of no type.
const SYNTHETIC_SHA = 'a'.repeat(40);
async function dropped(message, sha = SYNTHETIC_SHA) {
  const commits = parse(message.split('\n')[0], sha);
  const notes = await write(commits);
  const shown = notes.split(/^### /m).slice(1).map(block => {
    const [heading, ...body] = block.split('\n');
    return { heading: heading.trim(), body: body.join('\n') };
  }).filter(block => visibleNames.has(block.heading));
  return commits.filter(commit => {
    const entry = byType.get(commit.type.toLowerCase());
    if (entry && entry.hidden) return false;
    return !shown.some(block => block.body.includes('/commit/' + commit.sha));
  }).map(commit => commit.type + ': ' + commit.bareMessage);
}

test('every unreleased mainline change reaches a visible release-notes section', async () => {
  const head = process.env.RELEASE_BASE_SHA || 'HEAD';
  const manifest = JSON.parse(execFileSync('git', ['show', head + ':.release-please-manifest.json'], { cwd: repo, encoding: 'utf8' }));
  const range = 'v' + manifest['.'] + '..' + head;
  const log = execFileSync('git', ['log', '--first-parent', '--format=%H%n%B%x1e', range], { cwd: repo, encoding: 'utf8' });
  const records = log.split('\x1e').map(text => text.trim()).filter(Boolean);
  const missing = [];
  for (const record of records) {
    const [sha, ...lines] = record.split('\n');
    missing.push(...await dropped(lines.join('\n').trim(), sha));
  }
  assert.deepEqual(missing, [], 'Dropped from the release notes in ' + range + ':\n' + missing.join('\n'));
});

for (const message of [
  'SWF(bug): fix a thing (#1)',
  'swf: fix a thing (#1)',
  'fix(a-b): fix a thing (#1)',
  'test: add a case (#2)',
  'test(x): add a case (#2)',
]) {
  test('guard passes a mapped or deliberately hidden type: ' + message, async () => {
    assert.deepEqual(await dropped(message), []);
  });
}

for (const message of [
  'release-tooling: tidy up (#3)',
  'release-tooling(scope): tidy up (#3)',
  'Ghost: tidy up (#3)',
  'ghost!: break it (#4)',
  'ghost(scope)!: break it (#4)',
]) {
  test('guard fails an unmapped type, hyphenated, scoped or breaking: ' + message, async () => {
    assert.equal((await dropped(message)).length, 1);
  });
}

// Site side: the changelog is read again by two other parsers, each with its own section table.
// A section name missing from either table drops its items without a word.
const sampleItem = '* **x:** shown on the site ([#1](https://github.com/yonatangross/orchestkit/issues/1))';

function changelogWith(heading) {
  return '# Changelog\n\n## [10.0.0](https://example.test/compare/v9.0.0...v10.0.0) (2026-11-25)\n\n### ' + heading + '\n\n' + sampleItem + '\n';
}

for (const name of [...visibleNames]) {
  test('the site generators keep the "' + name + '" section', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ork-changelog-'));
    writeFileSync(join(root, 'CHANGELOG.md'), changelogWith(name));
    execFileSync('node', [join(repo, 'scripts/generate-changelog-data.js')], { env: { ...process.env, CHANGELOG_DATA_ROOT: root }, encoding: 'utf8' });
    const generated = readFileSync(join(root, 'docs/site/lib/generated/changelog-data.ts'), 'utf8');
    assert.match(generated, /shown on the site/, 'generate-changelog-data.js dropped "' + name + '"');
  });
}

// The release-video parser has never shown Miscellaneous, Performance or CI/CD (not in scope here).
for (const name of ['Features', 'Bug Fixes']) {
  test('the release-video parser keeps the "' + name + '" section on its own', async () => {
    const { parseChangelog } = await import(pathToFileURL(join(repo, 'scripts/changelog-to-props.mjs')).href);
    const props = parseChangelog(changelogWith(name), '10.0.0');
    assert.match(JSON.stringify(props.highlights), /shown on the site/, 'changelog-to-props.mjs dropped "' + name + '"');
  });
}

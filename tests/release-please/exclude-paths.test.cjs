// Uses the real release-please filter, parser and changelog writer. See README.md.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { test } = require('node:test');

assert.ok(process.env.RELEASE_PLEASE_ROOT, 'Set RELEASE_PLEASE_ROOT per README.md');
const upstream = createRequire(resolve(process.env.RELEASE_PLEASE_ROOT, 'package.json'));
assert.equal(upstream('release-please/package.json').version, '17.6.0');
const { CommitExclude } = upstream('release-please/build/src/util/commit-exclude.js');
const { parseConventionalCommits } = upstream('release-please/build/src/commit.js');
const { DefaultChangelogNotes } = upstream('release-please/build/src/changelog-notes/default.js');
const config = JSON.parse(readFileSync(resolve(__dirname, '../../.release-please-config.json'), 'utf8'));

// Exact squash subject and complete changed-file list from #4057, verified with:
// gh api repos/yonatangross/orchestkit/commits/b945f70d4eb04f87eeb8de51495ae99067dbdac7
const regression = {
  sha: 'b945f70d4eb04f87eeb8de51495ae99067dbdac7',
  message: 'fix(docs): restore Docs Site Build (ESM imports skip Vite resolution) (#4057)',
  files: [
    'docs/fix--4044-docs-site-build/playground.html',
    'docs/site/lab-manifest.json',
    'docs/site/lib/generated/lab-data.ts',
    'docs/site/public/lab/fumadocs-vitest-import-resolution.html',
    'docs/site/vitest.site.config.ts',
  ],
};

async function notes(commit, excludePaths = config.packages['.']['exclude-paths']) {
  const filter = new CommitExclude({ '.': { excludePaths } });
  const included = filter.excludeCommits({ '.': [commit] })['.'];
  return new DefaultChangelogNotes().buildNotes(parseConventionalCommits(included), {
    owner: 'yonatangross', repository: 'orchestkit',
    version: '10.0.0-beta.14', previousTag: 'v10.0.0-beta.13', currentTag: 'v10.0.0-beta.14',
    changelogSections: config['changelog-sections'],
  });
}

test('the original docs exclusion reproduces the missing #4057 changelog entry', async () => {
  assert.doesNotMatch(await notes(regression, ['docs']), /#4057/);
});

test('#4057 appears in generated Bug Fixes with its real file list', async () => {
  const changelog = await notes(regression);
  assert.match(changelog, /### Bug Fixes[\s\S]*restore Docs Site Build.*\[#4057\]/);
  console.log(changelog);
});

test('a commit touching only docs/site/vitest.site.config.ts appears', async () => {
  assert.match(await notes({ ...regression, files: ['docs/site/vitest.site.config.ts'] }), /\[#4057\]/);
});

for (const file of ['docs/adr/caching-strategy.md', 'docs/audits/release-please-version-drift-2026-05-22.md', 'docs/catalog-currency-audit/GAPS.md']) {
  test(`prose stays excluded: ${file}`, async () => {
    assert.doesNotMatch(await notes({ ...regression, files: [file] }), /#4057/);
  });
}

test('mixing excluded prose with shipped site code keeps the commit', async () => {
  assert.match(await notes({ ...regression, files: ['docs/adr/caching-strategy.md', 'docs/site/app/page.tsx'] }), /\[#4057\]/);
});

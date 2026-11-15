#!/usr/bin/env node
// ============================================================================
// plugins-data.ts: every plugin's version line carries the release-please marker
// ============================================================================
// WHAT THIS GUARDS
//
//   .release-please-config.json lists docs/site/lib/generated/plugins-data.ts as a generic
//   extra file, so release-please bumps only the lines tagged `// x-release-please-version`.
//   scripts/generate-docs-data.js used to tag the FIRST plugin's version line only. Once
//   ork-extras joined ork (#5220), the release PR bumped ork and left ork-extras at the old
//   version, the release build regenerated the file with both bumped, and Build (CI) failed
//   on drift (release 10.13.0, #5218).
//
//   Three checks: the committed file tags every plugin's version line; the generator uses
//   the shared tagging step; and that step, run on a two-plugin array, tags both plugins and
//   no nested "version" key.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MARKER = '// x-release-please-version';
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL - ${name}\n  ${err.message.split('\n').join('\n  ')}`);
  }
}

check('committed plugins-data.ts tags every plugin version line', () => {
  const text = readFileSync(join(root, 'docs/site/lib/generated/plugins-data.ts'), 'utf8');
  const versionLines = text.split('\n').filter((l) => /^ {4}"version": /.test(l));
  assert.ok(versionLines.length >= 2, `expected at least 2 plugin version lines, found ${versionLines.length}`);
  const untagged = versionLines.filter((l) => !l.endsWith(MARKER));
  assert.deepEqual(untagged, [], 'version lines without the release-please marker');
});

check('generate-docs-data.js tags plugin versions with the shared step', () => {
  const src = readFileSync(join(root, 'scripts/generate-docs-data.js'), 'utf8');
  assert.ok(
    src.includes('tagPluginVersions(JSON.stringify(plugins, null, 2))'),
    'scripts/generate-docs-data.js does not build pluginsJson with tagPluginVersions(...)',
  );
});

check('tagPluginVersions tags every plugin and no nested version key', () => {
  const require = createRequire(import.meta.url);
  const { tagPluginVersions } = require(join(root, 'scripts/lib/release-version-marker.js'));
  const plugins = [
    { name: 'ork', version: '9.9.9', meta: { version: 'nested' } },
    { name: 'ork-extras', version: '9.9.9', skillCount: 1 },
  ];
  const lines = tagPluginVersions(JSON.stringify(plugins, null, 2)).split('\n');
  const pluginLines = lines.filter((l) => /^ {4}"version": /.test(l));
  assert.equal(pluginLines.length, 2);
  for (const l of pluginLines) assert.ok(l.endsWith(MARKER), `untagged: ${l.trim()}`);
  for (const l of lines.filter((x) => /^ {6,}"version": /.test(x))) {
    assert.ok(!l.includes(MARKER), `nested version tagged: ${l.trim()}`);
  }
});

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log('\n3 ok, 0 FAIL');

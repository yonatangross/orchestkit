const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const config = require('../../.release-please-config.json');

function git(...args) {
  return execFileSync('git', args, { cwd: __dirname, encoding: 'utf8' }).trim();
}

test('every conventional type since the mainline release has a changelog policy', () => {
  const head = process.env.RELEASE_BASE_SHA || 'HEAD';
  const manifest = JSON.parse(git('show', head + ':.release-please-manifest.json'));
  const range = 'v' + manifest['.'] + '..' + head;
  const subjects = git('log', '--first-parent', '--format=%s', range);
  const mapped = new Set(config['changelog-sections'].map(entry => entry.type));
  const missing = subjects.split('\n').filter(subject => {
    const match = /^(\w+)(?:\([^)]+\))?!?: /.exec(subject);
    return match && !mapped.has(match[1].toLowerCase());
  });
  assert.deepEqual(missing, [], 'Unmapped mainline subjects in ' + range + ':\n' + missing.join('\n'));
});

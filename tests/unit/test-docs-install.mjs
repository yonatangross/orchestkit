import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

for (const [name, firstExit, message, production, fallbackExit, expected] of [
  ['registry success', 0, '', false, 0, 0],
  ['auth fallback', 1, 'E401', false, 0, 0],
  ['production refuses stub', 1, '401 Unauthorized', true, 0, 1],
  ['non-auth failure', 42, 'network error', false, 0, 42],
  ['empty failure output', 42, '', false, 0, 42],
  ['fallback failure', 1, 'unauthenticated', false, 17, 17],
]) {
  test(name, () => {
    const dir = mkdtempSync(join(tmpdir(), 'docs-install-'));
    try {
      mkdirSync(join(dir, 'scripts'));
      mkdirSync(join(dir, 'bin'));
      copyFileSync(new URL('../../docs/site/scripts/install-deps.sh', import.meta.url), join(dir, 'scripts/install-deps.sh'));
      for (const file of ['package.json', 'package-lock.json']) writeFileSync(join(dir, file), '{}\n');
      writeFileSync(join(dir, 'bin/npm'), `#!/usr/bin/env bash
echo "$*" >> calls
if [[ ! -f attempted ]]; then
  touch attempted
  echo '${message}'
  exit ${firstExit}
fi
echo mutated > package.json
echo mutated > package-lock.json
exit ${fallbackExit}
`, { mode: 0o755 });
      const result = spawnSync('bash', [join(dir, 'scripts/install-deps.sh')], {
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, VERCEL_ENV: production ? 'production' : '' },
        encoding: 'utf8',
      });
      assert.equal(result.status, expected, result.stdout + result.stderr);
      for (const file of ['package.json', 'package-lock.json']) assert.equal(readFileSync(join(dir, file), 'utf8'), '{}\n');
      const calls = readFileSync(join(dir, 'calls'), 'utf8');
      assert.equal(calls.includes('pkg set'), firstExit !== 0 && !production && /E401|unauthenticated/.test(message));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

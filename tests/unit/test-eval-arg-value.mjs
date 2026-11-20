#!/usr/bin/env node
/**
 * argValue must reject a flag given last (no value) with exit 2.
 * CodeRabbit 4240757703 on #4688.
 *
 * Both scripts parse --clients/--clients-dir before loadSeam, so the hooks
 * bundle is never consulted here: no skip guard, a missing bundle must not
 * make this test pass vacuously (agy HOLD CLEAN 6108013942).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const cases = [
  {
    script: join(ROOT, 'scripts/eval/jev-route-score.mjs'),
    args: (flag) => [flag],
  },
  {
    script: join(ROOT, 'scripts/eval/route-check.mjs'),
    args: (flag) => ['--jev', flag],
  },
];
const flags = ['--clients', '--clients-dir'];
let fail = 0;

for (const { script, args } of cases) {
  for (const flag of flags) {
    const r = spawnSync(process.execPath, [script, ...args(flag)], { encoding: 'utf8' });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (r.status !== 2) {
      console.error(`FAIL: ${script} ${flag} last: want exit 2, got ${r.status}`);
      console.error(out);
      fail = 1;
      continue;
    }
    if (!out.includes(`${flag} needs a value`)) {
      console.error(`FAIL: ${script} ${flag} last: missing needs-a-value error`);
      console.error(out);
      fail = 1;
      continue;
    }
    console.log(`ok: ${script} ${flag} last -> exit 2`);
  }
}

if (fail) process.exit(1);
console.log('PASS: eval argValue rejects a flag with no value');

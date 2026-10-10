// Stand-in for src/hooks/bin/run-hook.mjs used by
// tests/unit/test-security-starved-stdin-harness-error.sh (#4352).
//
// For the hook key named in ORK_STUB_STARVE_KEY it behaves like the runner's
// 100 ms stdin watchdog (#3415): it never reads stdin, warns on stderr that the
// hook measured nothing, and answers with an abstain payload. Every other key
// is handed to the real runner (ORK_STUB_REAL_RUNNER) unchanged.
import { spawnSync } from 'node:child_process';

const key = process.argv[2] ?? '';
if (process.env.ORK_STUB_STARVE_KEY && key === process.env.ORK_STUB_STARVE_KEY) {
  process.stderr.write(
    `[orchestkit] WARNING: stdin delivered 0 bytes in 100ms for hook "${key}" - ` +
      'running with an EMPTY payload, so this hook measured nothing.\n',
  );
  process.stdout.write('{"continue":true,"suppressOutput":true}\n');
  process.exit(0);
}

const real = process.env.ORK_STUB_REAL_RUNNER;
if (!real) {
  process.stderr.write('starved-stdin-runner: ORK_STUB_REAL_RUNNER is not set\n');
  process.exit(2);
}
const r = spawnSync(process.execPath, [real, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);

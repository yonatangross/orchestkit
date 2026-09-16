// #4136 test fixture: holds the real runner back by SLOW_BOOT_MS before
// importing it, simulating a slow Node boot. run-hook.mjs opens its 100ms
// stdin window only after boot, so a parent timer measured from spawn races
// that window under host load. The wrapper makes child startup slower than
// the parent delay deterministically instead of by load. argv[2] (the hook
// name) passes through untouched: run-hook.mjs reads process.argv[2].
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runner = join(here, '../../../bin/run-hook.mjs');
const slowBootMs = Number(process.env.SLOW_BOOT_MS ?? 0);

await new Promise((resolve) => setTimeout(resolve, slowBootMs));
await import(pathToFileURL(runner).href);

# Hook benchmarks

Vitest benchmarks for hot-path hooks. Lives outside the regular test
runner so wall-clock perf noise never gates CI.

## Why a separate harness

Functional tests used to embed perf assertions like:

```ts
expect(elapsedMs).toBeLessThan(50);
```

That looked sensible in isolation but broke under realistic CI load:

| Run mode | What happens | Failure rate |
|---|---|---|
| `vitest run secret-handler.test.ts` | 1 file, warm JIT, no instrumentation | 0% |
| `vitest run` (full suite) | 283 files, parallel workers, CPU contention | sometimes |
| `vitest run --coverage` | + v8 hooks every fn call (~2-4x slowdown), GC pressure | often |
| CI macOS runner | + cold runner, thermal jitter | often |

The bound was too tight for an absolute wall-clock guard. The signal we
actually want (catastrophic regex backtracking) shows up as **seconds**,
not the 50 ms threshold. Mixing them put a real signal behind a flaky
gate, so PRs were being blocked on noise.

## What's here instead

- `*.bench.ts` files run only via `npm run bench` (config:
  `vitest.bench.config.ts`)
- vitest's `benchmark.include` glob picks up these files; `vitest run`
  does not — so test gates stay clean
- Each bench prints a Tinybench table with `hz / min / max / mean /
  p75 / p99 / p995 / p999 / rme / samples`
- p99 is the regression signal. Catastrophic backtracking inflates many
  samples in a row; `max` is dominated by single-event noise (GC pause,
  scheduler swap)
- Baselines live in each `.bench.ts` file's header comment

## Running locally

```bash
cd src/hooks
npm run bench                 # full suite
npm run bench -- secret       # filter to secret-handler bench
```

JSON output lands at `src/hooks/bench-results.json` for ad-hoc diffing.

## CI

A separate `.github/workflows/bench.yml` runs the bench suite on PRs
that touch `src/hooks/**`. It is **non-gating** (`continue-on-error`):
its job is to surface the numbers in the PR's Actions log, not to fail
a merge on transient slowness. Catastrophic regressions show up as 10x+
shifts; reviewers can spot those in the table without a hard threshold.

## When to update a baseline

Update the comment block at the top of a `.bench.ts` file when:

1. You intentionally changed a regex or hot path
2. You verified the new numbers on a clean machine (no `--coverage`,
   power plugged in, nothing else running)
3. The change is monotone (no scenario got slower without justification)

Don't update baselines just to silence a regression on CI runners with
different hardware — use the **ratio** between scenarios as the portable
signal (e.g. `50KB w/ pat` vs `50KB no secret`).

## Adding a new benchmark

1. Create `src/__bench__/<hook-name>.bench.ts`
2. Import `{ bench, describe }` from `vitest`
3. Build inputs **outside** the timed function — bench bodies should
   only do the work under measurement
4. Use `NOOP_CTX` from `../lib/context.js` so you don't depend on
   test-only fixtures
5. Set `time: 1000, warmupTime: 500` as a sensible default; raise both
   when `rme > 3%` in the report
6. Add a baseline block at the top of the file

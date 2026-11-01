/**
 * The three CodeRabbit threads on #4962 (a2cbbd25), each a fail-open or a
 * false-OK in the flag-on path:
 *
 * - run-hook.mjs:470: the tool dispatchers are the only tool-event entries
 *   in the variant, so a missing or stale dispatcher bundle must block, not
 *   take the runner's silent-success path (FAIL_CLOSED_WHEN_MISSING).
 * - check-dispatch-proof.mjs:90: a log with no dispatcher run at all must
 *   not pass as OK.
 * - check-plugins-drift.ts:96: a git query that timed out is "unknown", not
 *   "not rebuilt", so it must not produce a blocking verdict on its own.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitTimedOut, rebuildEvidence } from '../../posttool/check-plugins-drift.js';
import { judge } from '../../../scripts/check-dispatch-proof.mjs';

const HOOKS = join(__dirname, '..', '..', '..');

describe('run-hook.mjs: a missing dispatcher fails closed', () => {
  const src = readFileSync(join(HOOKS, 'bin', 'run-hook.mjs'), 'utf8');
  const setOf = (name: string) => src.match(new RegExp(`${name} = new Set\\(\\[([^\\]]*)\\]`))?.[1] ?? '';

  it('lists both tool dispatchers in the bundle fail-closed set', () => {
    const bundle = setOf('FAIL_CLOSED_ON_BUNDLE');
    expect(bundle).toContain("'pretool/tool-dispatcher'");
    expect(bundle).toContain("'posttool/tool-dispatcher'");
  });

  // b10 HOLD 6560089425 on #4971: the dispatchers in FAIL_CLOSED_WHEN_MISSING
  // also turned every input path (a 600 KB Write, starved stdin, empty input)
  // into a block with a wrong "Rebuild" hint. Only a missing or stale bundle
  // or handler blocks them; every input path stays on the original set.
  it('keeps the dispatchers out of the input and throw paths', () => {
    const inputSet = setOf('FAIL_CLOSED_WHEN_MISSING');
    expect(inputSet).not.toContain('tool-dispatcher');
    expect(inputSet).toContain("'skill/review-post-gate'");
    const bundleChecks = ["would load another version's bundle", 'has no bundle', 'has no handler in its bundle'];
    for (const line of src.split('\n').filter((l) => /\.has\(hookName\)/.test(l) && /FAIL_CLOSED/.test(l))) {
      const isBundleCheck = bundleChecks.some((b) => line.includes(b)) || /effectiveDistDir !== distDir/.test(line);
      if (line.includes('FAIL_CLOSED_ON_BUNDLE')) expect(isBundleCheck, line.trim()).toBe(true);
    }
    for (const b of bundleChecks.slice(1)) {
      const line = src.split('\n').find((l) => l.includes(`failMissing('${b}')`));
      expect(line, b).toContain('FAIL_CLOSED_ON_BUNDLE');
    }
  });
});

describe('check-dispatch-proof: no dispatcher run is not OK', () => {
  it('a log with no proof tokens is a problem', () => {
    const hooksDoc = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
    const { problems } = judge([], hooksDoc);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/no dispatcher run/);
  });
});

describe('check-plugins-drift: a git timeout is unknown, never a block on its own', () => {
  it('recognises a timed-out git call', () => {
    expect(gitTimedOut(Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(gitTimedOut(Object.assign(new Error('killed'), { signal: 'SIGKILL' }))).toBe(true);
    expect(gitTimedOut(new Error('fatal: not a git repository'))).toBe(false);
  });

  it.each([
    [true, false, 'rebuilt'],
    [false, true, 'rebuilt'],
    [null, true, 'rebuilt'],
    [false, false, 'none'],
    [null, false, 'unknown'],
    [false, null, 'unknown'],
    [null, null, 'unknown'],
  ] as const)('touched=%s dirty=%s -> %s', (touched, dirty, want) => {
    expect(rebuildEvidence(touched, dirty)).toBe(want);
  });
});

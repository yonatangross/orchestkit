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
  it('lists both tool dispatchers in FAIL_CLOSED_WHEN_MISSING', () => {
    const src = readFileSync(join(HOOKS, 'bin', 'run-hook.mjs'), 'utf8');
    const m = src.match(/FAIL_CLOSED_WHEN_MISSING = new Set\(\[([^\]]*)\]\)/);
    expect(m?.[1]).toContain("'pretool/tool-dispatcher'");
    expect(m?.[1]).toContain("'posttool/tool-dispatcher'");
    expect(m?.[1]).toContain("'skill/review-post-gate'");
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

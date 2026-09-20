import { describe, expect, it } from 'vitest';
import * as typed from '../src/runtime.js';
// The dependency-free twin is the shipped artifact: the codex hook byte-pins
// it and scripts/jev-loop-report.mjs imports it. Nothing else guarantees it
// still matches the typed source, so this test does. A change to required[],
// harnesses or the outcome shape in one file is silent in the other without it.
// @ts-expect-error plain module, no declaration file by design
import * as shipped from '../../../src/codex/ork-codex/runtime/jev-shadow-runtime.mjs';

describe('shipped runtime matches the typed source', () => {
  it('publishes the same contract hash and key set', () => {
    expect(shipped.JEV_SHADOW_CONTRACT_SHA256).toBe(typed.JEV_SHADOW_CONTRACT_SHA256);
    expect([...shipped.JEV_SHADOW_CONTRACT_KEYS]).toEqual([...typed.JEV_SHADOW_CONTRACT_KEYS]);
  });

  it('returns the same errors for the same records', () => {
    const base = { schema_version: 1, namespace: 'n', producer: 'p', seam: 'route', mode: 'shadow',
      decision_id: 'd', phase: 'pending', harness: 'claude-code', session_id: 's', prompt_id: 'q',
      router: 'ork:auto', jev_pick: 'a', jev_confidence: 0.5, incumbent_pick: 'a', agree: true,
      floor: 0.5, decided_by: 'jev', unknown_reason: null };
    const probes: unknown[] = [
      base,
      { ...base, incumbent_pick: {} },
      { ...base, incumbent_pick: null, agree: null },
      { ...base, harness: 'not-a-harness' },
      { ...base, agree: false },
      'not an object',
    ];
    for (const record of probes) {
      expect([...shipped.validateJevShadow(record)]).toEqual([...typed.validateJevShadow(record)]);
    }
  });
});

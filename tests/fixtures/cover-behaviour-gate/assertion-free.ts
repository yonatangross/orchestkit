// Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (b), no assertion on a result.
import { expect, it } from 'vitest';
import { applyDiscount } from '../src/pricing';

it('runs applyDiscount', () => {
  applyDiscount(100, 0.1);
});

it('handles a large order', () => {
  expect(() => applyDiscount(1e9, 0.1)).not.toThrow();
});

it('counts assertions but makes none', () => {
  expect.hasAssertions();
  applyDiscount(1, 0);
});

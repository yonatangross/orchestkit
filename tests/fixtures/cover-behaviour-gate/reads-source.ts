// Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (c), reading source instead of running it.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { applyDiscount } from '../src/pricing';

const PRICING = join(__dirname, '..', 'src', 'pricing.ts');
const SRC = readFileSync(PRICING, 'utf8');

it('exports applyDiscount', () => {
  expect(SRC).toContain('export function applyDiscount');
});

it('has no TODO left in pricing', () => {
  const hits = execSync('grep -c TODO src/pricing.ts || true').toString();
  expect(hits.trim()).toBe('0');
});

it('guards the rate inline', () => {
  const text = readFileSync('src/pricing.ts', 'utf8');
  expect(text).toMatch(/rate < 0/);
});

it('still computes a total', () => {
  expect(applyDiscount(10, 0.5)).toBe(5);
});

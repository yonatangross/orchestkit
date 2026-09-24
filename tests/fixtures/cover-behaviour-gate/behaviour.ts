// Fixture for tests/unit/test-cover-behaviour-gate.mjs: every test here asserts behaviour.
// A commented-out read must not count: readFileSync('src/pricing.ts')
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, test, vi } from 'vitest';
import { applyDiscount, parseAmount, sendReceipt } from '../src/pricing';

const cases = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'cases.json'), 'utf8'));

describe('applyDiscount', () => {
  it('returns the discounted total', () => {
    expect(applyDiscount(100, 0.2)).toBe(80);
  });

  it('rejects a negative rate with a RangeError', () => {
    expect(() => applyDiscount(100, -1)).toThrow(RangeError);
  });

  it('sends the receipt and returns its id', async () => {
    const mailer = { send: vi.fn().mockResolvedValue({ id: 'r1' }) };
    const receipt = await sendReceipt(mailer, 42);
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ orderId: 42 }));
    expect(receipt.id).toBe('r1');
  });

  it('ignores "expect(" and a regex with a paren /\\(/ in strings', () => {
    const pattern = /\(total\)/;
    expect(pattern.test('(total)')).toBe(true);
  });

  it.each(cases)('parses %s', (input, expected) => {
    expect(parseAmount(input)).toEqual(expected);
  });

  it('does not throw on an empty cart', () => {
    expect(() => applyDiscount(0, 0)).not.toThrow();
  });

  test('parses with a node assert', () => {
    assert.strictEqual(parseAmount('1.50'), 150);
  });
});

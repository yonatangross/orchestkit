import { applyDiscount } from '../src/pricing';

it('discounts and keeps a leftover sanity check', () => {
  expect(true).toBe(true);
  expect(applyDiscount(100, 0.1)).toBe(90);
});

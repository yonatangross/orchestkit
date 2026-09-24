// Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (a), mock-call assertions only.
import { expect, it, vi } from 'vitest';
import { checkout } from '../src/checkout';

it('calls the payment gateway', async () => {
  const gateway = { charge: vi.fn() };
  await checkout(gateway, { total: 10 });
  expect(gateway.charge).toHaveBeenCalledWith(10);
});

it('logs once', () => {
  const log = vi.fn();
  checkout({ charge: vi.fn() }, { total: 0 }, log);
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).not.toHaveBeenCalledWith('error');
});

it('passes the total through', () => {
  const charge = vi.fn();
  checkout({ charge }, { total: 5 });
  expect(charge.mock.calls[0][0]).toBe(5);
});

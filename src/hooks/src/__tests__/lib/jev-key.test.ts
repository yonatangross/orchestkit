import { afterEach, describe, expect, it, vi } from 'vitest';
import { TYPESAFE_KEY_ENV, resolveTypesafeKey } from '../../lib/jev-key.js';
import { resolveTypesafeKey as routeKey, TYPESAFE_KEY_ENV as routeEnv } from '../../lib/route-judgment.js';
import { resolveTypesafeKey as categoryKey, TYPESAFE_KEY_ENV as categoryEnv } from '../../lib/session-category-provider.js';

afterEach(() => vi.unstubAllEnvs());

describe('shared Jev key lookup', () => {
  it('preserves both existing public exports as the same implementation', () => {
    expect(routeKey).toBe(resolveTypesafeKey);
    expect(categoryKey).toBe(resolveTypesafeKey);
    expect(routeEnv).toBe(TYPESAFE_KEY_ENV);
    expect(categoryEnv).toBe(TYPESAFE_KEY_ENV);
  });

  it('uses only the supplied environment and trims empty and padded values', () => {
    expect(resolveTypesafeKey({})).toBeNull();
    expect(resolveTypesafeKey({ ORK_TYPESAFE_API_KEY: '  ' })).toBeNull();
    expect(resolveTypesafeKey({ ORK_TYPESAFE_API_KEY: '  fake-test-value  ' })).toBe('fake-test-value');
  });

  it('defaults to the process environment without caching across calls', () => {
    vi.stubEnv('ORK_TYPESAFE_API_KEY', ' fake-one ');
    expect(routeKey()).toBe('fake-one');
    vi.stubEnv('ORK_TYPESAFE_API_KEY', 'fake-two');
    expect(categoryKey()).toBe('fake-two');
    vi.stubEnv('ORK_TYPESAFE_API_KEY', '');
    expect(resolveTypesafeKey()).toBeNull();
  });
});

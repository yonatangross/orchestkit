import assert from 'node:assert/strict';

it('always passes', () => { doThing(); expect(true).toBe(true); });
it('also passes', () => { expect(1).toEqual(1); });
it('compares two literals', () => { expect('a').not.toBe('b'); });
it('is truthy', () => { run(); expect(true).toBeTruthy(); });
it('compares a name with itself', () => { const result = run(); expect(result).toBe(result); });
it('node asserts on literals', () => { run(); assert.ok(true); assert.equal(1, 1, 'one is one'); });

/**
 * Unit tests for shared stringifyOutput helper (#4217).
 */

import { describe, test, expect } from 'vitest';
import { stringifyOutput } from '../../lib/stringify-output.js';

describe('stringifyOutput', () => {
  test('returns strings unchanged', () => {
    expect(stringifyOutput('hello')).toBe('hello');
  });

  test('returns null for nullish', () => {
    expect(stringifyOutput(null)).toBeNull();
    expect(stringifyOutput(undefined)).toBeNull();
  });

  test('joins array elements', () => {
    expect(stringifyOutput(['a', 'b'])).toBe('a\nb');
  });

  test('concatenates Bash {stdout, stderr} shape', () => {
    expect(
      stringifyOutput({ stdout: 'out', stderr: 'err', interrupted: false }),
    ).toBe('out\nerr');
  });

  test('scans stderr when stdout is empty', () => {
    expect(
      stringifyOutput({ stdout: '', stderr: 'only-err', interrupted: false }),
    ).toBe('\nonly-err');
  });

  test('JSON-stringifies other objects', () => {
    expect(stringifyOutput({ foo: 1 })).toBe('{"foo":1}');
  });

  test('interrupted empty Bash object does not throw', () => {
    expect(() =>
      stringifyOutput({ stdout: '', stderr: '', interrupted: true }),
    ).not.toThrow();
    expect(stringifyOutput({ stdout: '', stderr: '', interrupted: true })).toBe('\n');
  });
});

/**
 * Token Estimation Tests
 * Tests the content-aware estimateTokenCount function in common.ts
 */

import { describe, test, expect } from 'vitest';
import { estimateTokenCount } from '../../lib/common.js';

describe('estimateTokenCount', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  test('returns 0 for null/undefined (falsy)', () => {
    expect(estimateTokenCount(null as unknown as string)).toBe(0);
    expect(estimateTokenCount(undefined as unknown as string)).toBe(0);
  });

  test('estimates prose text at ~3.5 chars/token', () => {
    const prose = 'The quick brown fox jumps over the lazy dog. This is a sample sentence with no code.';
    const tokens = estimateTokenCount(prose);
    // 84 chars / 3.5 = 24 tokens
    expect(tokens).toBe(Math.ceil(prose.length / 3.5));
  });

  test('estimates code-heavy text at ~2.8 chars/token', () => {
    const code = 'function foo(x) { if (x > 0) { return x * 2; } else { return -x; } }';
    const tokens = estimateTokenCount(code);
    // Code indicators: { } ( ) > * ; { } ( ) { } = lots
    // Should use 2.8 chars/token
    expect(tokens).toBe(Math.ceil(code.length / 2.8));
  });

  test('prose has fewer estimated tokens than code of same length', () => {
    const length = 200;
    const prose = 'a'.repeat(length);
    const code = 'if(x){y=z;}'.repeat(Math.ceil(length / 11)).slice(0, length);

    const proseTokens = estimateTokenCount(prose);
    const codeTokens = estimateTokenCount(code);

    // Code should produce more tokens (lower chars/token ratio)
    expect(codeTokens).toBeGreaterThan(proseTokens);
  });

  test('handles mixed content', () => {
    const mixed = 'This is some text.\nfunction foo() { return 1; }\nMore text here.';
    const tokens = estimateTokenCount(mixed);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(mixed.length); // Always fewer tokens than chars
  });

  test('returns positive number for any non-empty string', () => {
    const inputs = ['hello', '{}', '   ', '\n\n\n', 'a'];
    for (const input of inputs) {
      expect(estimateTokenCount(input)).toBeGreaterThan(0);
    }
  });

  test('scales linearly with content length', () => {
    // Use longer base to minimize ceil() rounding effects
    const short = 'hello world this is a test sentence that is reasonably long';
    const long = short.repeat(10);
    const shortTokens = estimateTokenCount(short);
    const longTokens = estimateTokenCount(long);

    // Should be approximately 10x (within rounding)
    expect(longTokens).toBeGreaterThanOrEqual(shortTokens * 9);
    expect(longTokens).toBeLessThanOrEqual(shortTokens * 11);
  });
});

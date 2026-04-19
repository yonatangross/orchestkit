import { describe, it, expect } from 'vitest';
import { formatStars } from '../lib/format-stars';

describe('formatStars — small range (n < 1000)', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [42, '42'],
    [100, '100'],
    [999, '999'],
  ])('formats %i as %s (exact integer)', (input, expected) => {
    expect(formatStars(input)).toBe(expected);
  });
});

describe('formatStars — thousands range (1,000 ≤ n < 10,000) → one-decimal "k"', () => {
  it.each([
    [1000, '1.0k'],
    [1500, '1.5k'],
    [2400, '2.4k'],
    [9900, '9.9k'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatStars(input)).toBe(expected);
  });

  it('rounds at the upper boundary toward "10.0k" (a known quirk)', () => {
    // 9999 / 1000 = 9.999 → toFixed(1) = "10.0" → "10.0k". This is intentional;
    // the integer-tier kicks in at exactly 10000. Test pins the behavior.
    expect(formatStars(9999)).toBe('10.0k');
  });
});

describe('formatStars — ten-thousands+ range (n ≥ 10,000) → integer "k"', () => {
  it.each([
    [10000, '10k'],
    [10500, '11k'],   // 10.5 toFixed(0) rounds half-to-even → 11
    [12345, '12k'],
    [99999, '100k'],
    [100000, '100k'],
    [999000, '999k'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatStars(input)).toBe(expected);
  });
});

describe('formatStars — million+ range (no special tier yet)', () => {
  it('formats 1,000,000 as "1000k" (no "M" suffix exists; revisit if repo grows)', () => {
    expect(formatStars(1_000_000)).toBe('1000k');
  });

  it('formats very large values without crashing', () => {
    expect(formatStars(123_456_789)).toBe('123457k');
  });
});

describe('formatStars — boundary precision', () => {
  it('exactly 1000 crosses into "k" tier with one decimal', () => {
    expect(formatStars(999)).toBe('999');
    expect(formatStars(1000)).toBe('1.0k');
  });

  it('exactly 10000 crosses into integer-k tier', () => {
    expect(formatStars(9000)).toBe('9.0k');
    expect(formatStars(10000)).toBe('10k');
  });
});

import { describe, test, expect } from 'vitest';
import { denyLine, shortFix, cutCodePoints, MAX_DENY_CHARS } from '../src/card.js';

const lesson = (message: string, fix?: string) => ({ id: 'l1', severity: 'block' as const, message, fix, source: 'pattern' as const });

describe('shortFix', () => {
  test('prefers the first code line under a RIGHT heading', () => {
    const fix = '# WRONG - bad\ngit ls-files | grep x\n\n# RIGHT - NUL-delimited\ngit ls-files -z | tr x y\n# BEST\nother';
    expect(shortFix(fix)).toBe('git ls-files -z | tr x y');
  });

  test('uses a plain one-line fix as is', () => {
    expect(shortFix('Use gh pr view with --json to check mergeStateStatus.')).toBe('Use gh pr view with --json to check mergeStateStatus.');
  });

  test('skips a WRONG section when there is no RIGHT heading', () => {
    expect(shortFix('// WRONG\nbad()\n// use this instead\ngood()')).toBe('good()');
  });

  test('no fix gives undefined', () => {
    expect(shortFix(undefined)).toBeUndefined();
  });
});

describe('denyLine', () => {
  test('one line with the id, the first sentence and a short Fix', () => {
    const line = denyLine(lesson('First sentence here.\nSecond line.', '# WRONG\nold()\n# RIGHT\nnew()'), 'the user chose Cancel');
    expect(line).toBe('lesson-cards: the user chose Cancel; call not run. [lesson:l1] First sentence here. Fix: new()');
    expect(line).not.toContain('\n');
  });

  test('no fix, no Fix label', () => {
    expect(denyLine(lesson('Only this.'), 'no dialog')).toBe('lesson-cards: no dialog; call not run. [lesson:l1] Only this.');
  });

  test('the cap counts code points and never splits a surrogate pair', () => {
    const line = denyLine(lesson('\u{1F6A6}'.repeat(400)), 'no dialog');
    const points = Array.from(line);
    expect(points.length).toBe(MAX_DENY_CHARS);
    expect(line.endsWith('...')).toBe(true);
    // No lone surrogate anywhere: every code point is a whole character.
    expect(points.every(p => !/^[\uD800-\uDFFF]$/.test(p))).toBe(true);
  });

  test('cutCodePoints leaves short text alone', () => {
    expect(cutCodePoints('abc', 10)).toBe('abc');
  });
});

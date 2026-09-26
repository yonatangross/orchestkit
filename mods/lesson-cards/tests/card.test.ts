import { describe, test, expect } from 'vitest';
import { askQuestion, denyLine, shortFix, cutCodePoints, MAX_DENY_CHARS } from '../src/card.js';

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
  test('a real block keeps the reason, the id and a short Fix, never the message', () => {
    const line = denyLine(lesson('First sentence here.\nSecond line.', '# WRONG\nold()\n# RIGHT\nnew()'), 'Not run: no "Proceed anyway".');
    expect(line).toBe('Not run: no "Proceed anyway". [lesson:l1] Fix: new()');
    expect(line).not.toContain('First sentence');
    expect(line).not.toContain('\n');
  });

  test('a user cancel is plain: reason, lesson id, no Fix', () => {
    const line = denyLine(lesson('First sentence here.\nSecond line.', '# WRONG\nold()\n# RIGHT\nnew()'), 'Cancelled by you; not run.');
    expect(line).toBe('Cancelled by you; not run. [lesson:l1]');
    expect(line).not.toContain('Fix:');
    expect(line).not.toMatch(/^Cancelled: Cancelled/);
  });

  test('no fix, no Fix label', () => {
    expect(denyLine(lesson('Only this.'), 'Not run: no dialog to confirm.')).toBe('Not run: no dialog to confirm. [lesson:l1]');
  });

  test('the cap counts code points and never splits a surrogate pair', () => {
    const line = denyLine({ ...lesson('m'), id: '\u{1F6A6}'.repeat(400) }, 'Cancelled by you; not run.');
    const points = Array.from(line);
    expect(points.length).toBe(MAX_DENY_CHARS);
    expect(line.endsWith('...')).toBe(true);
    // No lone surrogate anywhere: every code point is a whole character.
    expect(points.every(p => !/^[\uD800-\uDFFF]$/.test(p))).toBe(true);
  });

  test('cutCodePoints leaves short text alone', () => {
    expect(cutCodePoints('abc', 10)).toBe('abc');
  });

  test('a long message never reaches a cancel line (no Fix to keep)', () => {
    const line = denyLine(lesson('w'.repeat(500) + '.', '# RIGHT\nuse_the_safe_call()'), 'Cancelled by you; not run.');
    expect(line).not.toContain('www');
    expect(line).not.toContain('Fix:');
    expect(line.startsWith('Cancelled by you; not run.')).toBe(true);
  });

  test('a long message on a real block keeps the Fix whole', () => {
    const line = denyLine(lesson('w'.repeat(500) + '.', '# RIGHT\nuse_the_safe_call()'), 'Not run: no "Proceed anyway".');
    expect(line).not.toContain('www');
    expect(line.endsWith(' Fix: use_the_safe_call()')).toBe(true);
  });
});

describe('askQuestion', () => {
  test('the lesson id and "Proceed anyway?" only', () => {
    expect(askQuestion(lesson('A long lesson paragraph.'))).toBe('lesson l1: Proceed anyway?');
  });
});

describe('shortFix headings (CodeRabbit)', () => {
  test('"# WRONG: Do not use this" is a WRONG heading, so its code is never the fix', () => {
    const fix = '# WRONG: Do not use this\nbad_call()\n\n# RIGHT\ngood_call()';
    expect(shortFix(fix)).toBe('good_call()');
  });

  test('a fix with only a WRONG example offers no short fix', () => {
    expect(shortFix('# WRONG: Do not use this\nbad_call()')).toBeUndefined();
  });

  test('"# Do not ..." alone is a WRONG heading too', () => {
    expect(shortFix('# Do not pipe into grep\nls | grep x\n# Use this\nls -1')).toBe('ls -1');
  });
});


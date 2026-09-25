import { describe, test, expect } from 'vitest';
import { denyLine, MAX_DENY_CHARS } from '../src/card.js';

describe('denyLine', () => {
  test('flattens a multi-line message and caps the length', () => {
    const long = 'First sentence here.\nSecond line ' + 'x'.repeat(400);
    const line = denyLine({ id: 'l1', severity: 'block', message: long, source: 'pattern' }, 'the user chose Cancel');
    expect(line).toBe('lesson-cards: the user chose Cancel; call not run. [lesson:l1] First sentence here.');
  });

  test('a message with no sentence end is cut at the cap', () => {
    const line = denyLine({ id: 'l2', severity: 'block', message: 'y'.repeat(600), source: 'pattern' }, 'no dialog');
    expect(line.length).toBe(MAX_DENY_CHARS);
    expect(line.endsWith('...')).toBe(true);
  });
});

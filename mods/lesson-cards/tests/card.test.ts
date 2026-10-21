import { describe, test, expect } from 'vitest';
import { BLOCK_ADVISORY_PREFIX, formatContext } from '../src/card.js';

const lesson = (severity: 'block' | 'warn', message: string, fix?: string, source: 'pattern' | 'bullet' = 'pattern') => ({
  id: 'l1',
  severity,
  message,
  fix,
  source,
});

describe('formatContext: lessons are advisory', () => {
  test('a block-severity pattern is marked advisory and keeps the lesson and its Fix', () => {
    const text = formatContext(lesson('block', 'Never pipe into grep.', '# RIGHT\nls -1'));
    expect(text).toBe(`${BLOCK_ADVISORY_PREFIX}[lesson:l1] Never pipe into grep. Fix: # RIGHT\nls -1`);
    expect(text.startsWith('BLOCK-SEVERITY LESSON (advisory, not enforced): ')).toBe(true);
  });

  test('an ALLOWED-FORM line inside the fix is kept whole', () => {
    const text = formatContext(lesson('block', 'Use the helper.', 'ALLOWED-FORM: helper.sh ref'));
    expect(text).toContain('ALLOWED-FORM: helper.sh ref');
  });

  test('a warn lesson carries no advisory prefix', () => {
    expect(formatContext(lesson('warn', 'Heads up.', 'Do this.'))).not.toContain('BLOCK-SEVERITY');
    expect(formatContext(lesson('warn', 'Heads up.'))).toBe('[lesson:l1] Heads up.');
  });

  test('a bullet note is never marked block severity', () => {
    expect(formatContext(lesson('block', 'From lessons.md.', undefined, 'bullet'))).toBe('[lesson:l1] From lessons.md.');
  });

  test('the cap still applies', () => {
    const text = formatContext(lesson('block', 'w'.repeat(500)), 100);
    expect(text.length).toBe(100);
    expect(text.endsWith('...')).toBe(true);
  });
});

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BLOCK_ADVISORY_PREFIX, formatContext } from '../src/card.js';
import type { LessonPattern } from '../src/corpus.js';
import { matchBashCommand } from '../src/match.js';

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

// A real hq-ext pattern (configs/lesson-patterns.json, copied verbatim): its
// ALLOWED-FORM lives in the separate allowed_form field, not in example_fix.
describe('allowed_form from a real hq-ext lesson reaches the context', () => {
  const real = JSON.parse(
    readFileSync(new URL('./fixtures/hq-ext-quotepath-pattern.json', import.meta.url), 'utf8')
  ) as LessonPattern;

  test('the fixture is the real block pattern with allowed_form outside its fix', () => {
    expect(real.id).toBe('git-ls-files-quotepath-blind');
    expect(real.severity).toBe('block');
    expect(real.allowed_form).toBe('git -c core.quotePath=false ls-files | grep -qxF "$name"');
    expect(real.example_fix ?? '').not.toContain('ALLOWED-FORM:');
  });

  test('a matched call carries the ALLOWED-FORM line in its context', () => {
    const [m] = matchBashCommand('git ls-files | grep name', [real]);
    expect(m?.id).toBe('git-ls-files-quotepath-blind');
    const text = formatContext(m!);
    expect(text.startsWith(BLOCK_ADVISORY_PREFIX)).toBe(true);
    expect(text.split('\n').filter((l) => l.startsWith('ALLOWED-FORM:'))).toEqual([
      `ALLOWED-FORM: ${real.allowed_form}`,
    ]);
  });

  test('the cap never cuts the ALLOWED-FORM line', () => {
    const [m] = matchBashCommand('git ls-files | grep name', [real]);
    const text = formatContext(m!, 120);
    expect(text.length).toBeLessThanOrEqual(120);
    expect(text.endsWith(`\nALLOWED-FORM: ${real.allowed_form}`)).toBe(true);
  });
});

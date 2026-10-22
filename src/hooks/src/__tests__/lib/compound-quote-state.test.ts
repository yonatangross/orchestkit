/**
 * Codex XREVIEW 6334668685 Must 1 (#4845): compound detection must track
 * quote state, so a quote character nested in the other quote type cannot
 * hide command substitution or a redirect. Backport of the main fix.
 *
 * Fail-first: the "does not hide" cases fail on cc61f74a and pass after.
 */

import { describe, test, expect } from 'vitest';
import { isCompoundCommand, blankQuotedContent } from '../../lib/normalize-command.js';

describe('compound detection tracks quote state', () => {
  const executes = [
    `echo "a'b $(id) c'd"`,
    'echo "a\'b `id` c\'d"',
    `echo "x'" > out.txt "'y"`,
    `echo "a'b" $(id) "c'd"`,
  ];

  test.each(executes)('apostrophes inside double quotes do not hide an operator: %s', (cmd) => {
    expect(isCompoundCommand(cmd)).toBe(true);
  });

  const inert = [`echo 'a $(b) c'`, `echo "a > b"`, `echo "it's fine"`, `echo 'say "$(x)"'`];

  test.each(inert)('control: quoted text that bash never runs stays simple: %s', (cmd) => {
    expect(isCompoundCommand(cmd)).toBe(false);
  });

  test('blankQuotedContent keeps operators that sit between quoted regions', () => {
    expect(blankQuotedContent(`echo "x'" > f "'y"`)).toContain('>');
    expect(blankQuotedContent(`echo 'a > b'`)).not.toContain('>');
  });

  test('an unterminated quote hides nothing', () => {
    expect(isCompoundCommand(`echo 'a $(id)`)).toBe(true);
  });
});

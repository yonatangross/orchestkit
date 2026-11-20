/**
 * PostToolUseFailure error classifier: closed enum, text never leaves.
 * Seeded strings are real-shaped (copied in form, not content, from CC
 * tool_result errors and hook refusals).
 */

import { describe, it, expect } from 'vitest';
import {
  classifyToolFailure,
  isFailureClass,
  FAILURE_CLASSES,
  type FailureClass,
} from '../../lib/failure-class.js';

const SEEDED: ReadonlyArray<readonly [FailureClass, string]> = [
  ['user_rejected', "The user doesn't want to proceed with this tool use. The tool use was rejected."],
  ['guard_refusal', 'PreToolUse:Bash hook error: [sh run-hook-wrapper.sh --strict tool-dispatch-sync]: {"result":"deny"}'],
  ['sandbox_denied', 'mkdir: /opt/x: Operation not permitted'],
  ['permission_denied', 'Permission to use Bash has been denied.'],
  ['rate_limit', 'gh: API rate limit exceeded for installation (HTTP 403 secondary)'],
  ['timeout', 'Command timed out after 2m 0.0s'],
  ['network', 'curl: (7) Failed to connect: ECONNREFUSED 127.0.0.1:5432'],
  ['edit_conflict', 'String to replace not found in file.\nString: const a = 1;'],
  ['not_found', 'cat: notes.txt: No such file or directory'],
  ['invalid_input', 'InputValidationError: Edit failed due to the following issue: The required parameter `old_string` is missing'],
  ['parse_error', 'SyntaxError: Unexpected token } in JSON at position 12'],
  ['nonzero_exit', 'Exit code 2\nFAIL  src/foo.test.ts'],
  ['other', 'something odd happened that no rule knows'],
];

describe('classifyToolFailure', () => {
  it.each(SEEDED)('maps a real-shaped %s error to its class', (cls, error) => {
    expect(classifyToolFailure({ error })).toBe(cls);
  });

  it('every enum member except interrupted is covered by a seed', () => {
    const seeded = new Set(SEEDED.map(([c]) => c));
    for (const c of FAILURE_CLASSES) {
      if (c === 'interrupted') continue;
      expect(seeded.has(c), `missing seed for ${c}`).toBe(true);
    }
  });

  it('is_interrupt true wins before any text match', () => {
    expect(classifyToolFailure({ error: 'Exit code 1', is_interrupt: true })).toBe('interrupted');
    expect(classifyToolFailure({ is_interrupt: true })).toBe('interrupted');
  });

  it('is_interrupt that is not exactly true does not count', () => {
    expect(classifyToolFailure({ error: 'Exit code 1', is_interrupt: 'true' })).toBe('nonzero_exit');
  });

  it('unknown, empty or missing input is "other", never dropped', () => {
    expect(classifyToolFailure({ error: '' })).toBe('other');
    expect(classifyToolFailure({})).toBe('other');
    expect(classifyToolFailure({ error: 42 })).toBe('other');
    expect(classifyToolFailure(null)).toBe('other');
    expect(classifyToolFailure(undefined)).toBe('other');
  });

  it('always returns a member of the closed list', () => {
    for (const [, error] of SEEDED) {
      expect(isFailureClass(classifyToolFailure({ error }))).toBe(true);
    }
    expect(isFailureClass('No such file')).toBe(false);
  });
});

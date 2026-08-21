/**
 * Regression: failure-handler must stamp PostToolUseFailure, not PostToolUse.
 *
 * hooks.json registers posttool/failure-handler under the PostToolUseFailure
 * event, but both of its context-bearing exits went through the shared helper
 * outputWithContext(), which hardcoded `hookEventName: 'PostToolUse'`. CC
 * validates the stamp against the event it dispatched and rejects a mismatch
 * with "Hook returned incorrect event name: expected 'PostToolUseFailure' but
 * got 'PostToolUse'", so every suggestion this handler produced was discarded.
 *
 * The defect read as intermittent because the handler's other two exits return
 * outputSilentSuccess(), which carries no hookSpecificOutput and therefore no
 * event name to mismatch, so the failures that produced no advice "worked", and
 * only the ones that had something useful to say were thrown away.
 *
 * These tests deliberately use mockCommonReal (real output helpers, stubbed
 * side effects) rather than mockCommonBasic: a stubbed outputWithContext would
 * assert the fixture's hardcoded string instead of the stamp that ships.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonReal } from '../fixtures/mock-common.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../../lib/common.js', async () => mockCommonReal());

vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('../../lib/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/paths.js')>();
  return {
    ...actual,
    getLogDir: vi.fn(() => '/tmp/test-logs'),
  };
});

import { failureHandler } from '../../posttool/failure-handler.js';
import { outputWithContext } from '../../lib/output.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

/** RFC 9457 payload shaped to satisfy extractStructuredError()'s four required fields. */
const STRUCTURED_ERROR = JSON.stringify({
  type: 'https://orchestkit.dev/errors/rate-limit',
  status: 429,
  title: 'Upstream rate limit exceeded',
  retryable: true,
  retry_after: 30,
  error_category: 'rate_limit',
  what_you_should_do: 'Back off and retry the request.',
});

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;

describe('failureHandler event-name stamp', () => {
  beforeEach(() => {
    testCtx = createTestContext({ logDir: '/tmp/test-logs' });
    vi.clearAllMocks();
  });

  it('stamps PostToolUseFailure on the structured RFC 9457 path', () => {
    const result = failureHandler(makeInput({ error: STRUCTURED_ERROR, exit_code: 1 }), testCtx);

    // Prove we actually took the structured branch, not the regex fallback.
    expect(result.hookSpecificOutput?.additionalContext).toContain('Structured error from Bash');
    expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUseFailure');
  });

  it('stamps PostToolUseFailure on the regex-suggestion path', () => {
    const result = failureHandler(
      makeInput({ error: 'ENOENT: no such file or directory', exit_code: 1 }),
      testCtx,
    );

    // Prove we actually took the regex fallback branch.
    expect(result.hookSpecificOutput?.additionalContext).toContain('File not found');
    expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUseFailure');
  });

  it('never emits the PostToolUse name that CC rejects on this event', () => {
    for (const error of [STRUCTURED_ERROR, 'EACCES: permission denied']) {
      const result = failureHandler(makeInput({ error, exit_code: 1 }), testCtx);
      expect(result.hookSpecificOutput?.hookEventName).not.toBe('PostToolUse');
    }
  });

  it('leaves PostToolUse as the default for every other outputWithContext caller', () => {
    // The shared helper has ~40 non-test callers on the PostToolUse event.
    // Widening it must not change what they emit.
    expect(outputWithContext('ctx').hookSpecificOutput?.hookEventName).toBe('PostToolUse');
  });

  it('silent exits carry no event name at all, which is why it looked intermittent', () => {
    const noError = failureHandler(makeInput({ exit_code: 0 }), testCtx);
    expect(noError.hookSpecificOutput).toBeUndefined();

    const noPatternMatched = failureHandler(
      makeInput({ error: 'zzz unrecognised failure text zzz', exit_code: 1 }),
      testCtx,
    );
    expect(noPatternMatched.hookSpecificOutput).toBeUndefined();
  });
});

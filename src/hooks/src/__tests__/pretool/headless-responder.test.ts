/**
 * Unit tests for headless-responder (pretool/ask)
 *
 * Claude Code reads AskUserQuestion answers from `updatedInput.answers`
 * ("question text -> answer string; multi-select answers are comma-separated",
 * the AskUserQuestion input schema at the 2.1.277 floor). The hook used to
 * write `_headless_answers`, a key the tool does not know: since CC 2.1.300
 * validates updatedInput, that key is dropped, so the hook never answered.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import headlessResponder from '../../pretool/ask/headless-responder.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function askInput(questions: unknown[]): HookInput {
  return {
    tool_name: 'AskUserQuestion',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { questions },
  } as HookInput;
}

const single = {
  question: 'Which branch?',
  options: [{ label: 'main (Recommended)' }, { label: 'dev' }],
};
const multi = {
  question: 'Which checks?',
  multiSelect: true,
  options: [{ label: 'lint' }, { label: 'types' }, { label: 'tests' }],
};

type Updated = { questions?: unknown; answers?: Record<string, unknown>; _headless_answers?: unknown };
function updatedOf(result: ReturnType<typeof headlessResponder>): Updated | undefined {
  const out = (result as { hookSpecificOutput?: { updatedInput?: Updated } }).hookSpecificOutput;
  return out?.updatedInput;
}

describe('headless-responder', () => {
  beforeEach(() => {
    vi.stubEnv('ORCHESTKIT_HEADLESS', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers through updatedInput.answers, keyed by question text', () => {
    const result = headlessResponder(askInput([single]), createTestContext());
    const updated = updatedOf(result);

    expect(updated?.answers).toEqual({ 'Which branch?': 'main (Recommended)' });
    // the old key is gone: CC drops it, so it answered nothing
    expect(updated).not.toHaveProperty('_headless_answers');
    // the questions stay, so the call is still a valid AskUserQuestion input
    expect(updated?.questions).toEqual([single]);
  });

  it('joins a multi-select answer into one comma-separated string', () => {
    const result = headlessResponder(askInput([multi]), createTestContext());
    const answers = updatedOf(result)?.answers ?? {};

    expect(answers['Which checks?']).toBe('lint, types, tests');
    expect(Array.isArray(answers['Which checks?'])).toBe(false);
  });

  it('answers every question in one call', () => {
    const result = headlessResponder(askInput([single, multi]), createTestContext());

    expect(updatedOf(result)?.answers).toEqual({
      'Which branch?': 'main (Recommended)',
      'Which checks?': 'lint, types, tests',
    });
  });

  it('does nothing in an interactive session', () => {
    vi.stubEnv('ORCHESTKIT_HEADLESS', '');
    vi.stubEnv('CI', '');
    vi.stubEnv('GITHUB_ACTIONS', '');
    const result = headlessResponder(askInput([single]), createTestContext());

    expect(updatedOf(result)).toBeUndefined();
  });
});

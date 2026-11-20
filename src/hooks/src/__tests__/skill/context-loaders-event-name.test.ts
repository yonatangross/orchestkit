/**
 * #4683: skill frontmatter PreToolUse loaders never took effect.
 *
 * The loaders returned outputWithContext(ctx), which defaulted the envelope
 * label to 'PostToolUse'. On a PreToolUse firing, CC routes on the declared
 * hookEventName, so the context was filed under the wrong event and dropped.
 * The label must come from the event the hook actually fired on.
 */
import { describe, expect, it } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';
import {
  assessmentBaselineLoader,
  priorDecisionsLoader,
} from '../../skill/context-loaders-env.js';
import {
  brainstormInstructionsLoader,
  verifyScoringRubricLoader,
} from '../../skill/context-loaders-standards.js';
import { sanitizeOutput } from '../../../bin/output-guard.mjs';

function input(hook_event: HookInput['hook_event']): HookInput {
  return { hook_event, tool_name: 'Read', session_id: 's', tool_input: {} } as HookInput;
}

const loaders = [
  ['priorDecisionsLoader', priorDecisionsLoader],
  ['assessmentBaselineLoader', assessmentBaselineLoader],
  ['verifyScoringRubricLoader', verifyScoringRubricLoader],
  ['brainstormInstructionsLoader', brainstormInstructionsLoader],
] as const;

describe('#4683 skill context loaders label the real firing event', () => {
  it.each(loaders)('%s on PreToolUse emits hookEventName PreToolUse', (_name, loader) => {
    const result = loader(input('PreToolUse'));
    expect(result.hookSpecificOutput?.additionalContext).toBeTruthy();
    expect(result.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  });

  it.each(loaders)('%s on PostToolUse still emits PostToolUse', (_name, loader) => {
    expect(loader(input('PostToolUse')).hookSpecificOutput?.hookEventName).toBe('PostToolUse');
  });

  it('survives the run-hook output guard intact on a PreToolUse firing', () => {
    const out = sanitizeOutput(priorDecisionsLoader(input('PreToolUse')), 'PreToolUse') as HookResult;
    expect(out.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput?.additionalContext).toBeTruthy();
  });

  it('an input with no event is labelled by the guard from the firing event', () => {
    const raw = priorDecisionsLoader({ tool_name: 'Read', session_id: 's', tool_input: {} } as HookInput);
    expect(raw.hookSpecificOutput).not.toHaveProperty('hookEventName');
    const out = sanitizeOutput(raw, 'PreToolUse') as HookResult;
    expect(out.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  });
});

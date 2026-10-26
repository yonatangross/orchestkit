/**
 * Regression coverage for UserPromptSubmit consolidation (#4847).
 *
 * The dispatcher must preserve the synchronous goal brake while folding the
 * deferred worktree advisory into its single additionalContext response.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../../prompt/frustration-detector.js', () => ({
  frustrationDetector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/cache-break-detector.js', () => ({
  cacheBreakDetector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/handoff-injector.js', () => ({
  handoffInjector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/executor-route-nudge.js', () => ({
  executorRouteNudge: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/visual-style-nudge.js', () => ({
  visualStyleNudge: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/multi-step-task-nudge.js', () => ({
  multiStepTaskNudge: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../lib/session-identity-state.js', () => ({
  manageSessionIdentity: () => null,
  resolveTranscriptPath: () => null,
}));

import { unifiedPromptDispatcher, registeredHookNames } from '../../prompt/unified-dispatcher.js';
import { MAX_PROMPT_LENGTH } from '../../lib/prompt-guards.js';
import {
  acknowledgeWorktreeAdvisories,
  readWorktreeAdvisories,
  writeWorktreeAdvisory,
} from '../../lib/worktree-advisory.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

let projectDir: string;
const savedEnv: Record<string, string | undefined> = {};

function input(prompt: string, sessionId = 'session-4847'): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: sessionId,
    project_dir: projectDir,
    tool_input: {},
    prompt,
  };
}

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'prompt-dispatcher-4847-'));
  for (const key of ['CLAUDE_PLUGIN_DATA', 'ORK_SESSION_IDENTITY', 'CLAUDE_EFFORT', 'CLAUDE_MODEL']) {
    savedEnv[key] = process.env[key];
  }
  delete process.env.CLAUDE_PLUGIN_DATA;
  process.env.ORK_SESSION_IDENTITY = '0';
  delete process.env.CLAUDE_EFFORT;
  delete process.env.CLAUDE_MODEL;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(projectDir, { recursive: true, force: true });
});

describe('prompt/unified-dispatcher consolidation', () => {
  it('registers the goal tracker and worktree consumer in-process', () => {
    expect(registeredHookNames()).toContain('goal-tracker');
    expect(registeredHookNames()).toContain('worktree-advisory-consumer');
  });

  it('preserves the synchronous goal budget block', () => {
    const stateDir = join(projectDir, '.claude', 'state');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, 'goal-budget-tripped.json'),
      JSON.stringify({
        tripped_at: '2026-10-25T00:00:00Z',
        session_id: 'blocked-session',
        turns: 31,
        tokens: 200,
        reason: 'turns_cap',
      }),
    );

    const result = unifiedPromptDispatcher(
      input('/goal continue until green', 'blocked-session'),
      createTestContext({ projectDir, sessionId: 'blocked-session' }),
    );

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('budget tripped');
    expect(result.stopReason).toContain('turns_cap');
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('checks the goal budget before skipping oversized prompt analysis', () => {
    const stateDir = join(projectDir, '.claude', 'state');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, 'goal-budget-tripped.json'),
      JSON.stringify({ session_id: 'large-goal-session', reason: 'tokens_cap' }),
    );

    const prompt = `/goal ${'continue '.repeat(Math.ceil(MAX_PROMPT_LENGTH / 9))}`;
    const result = unifiedPromptDispatcher(
      input(prompt, 'large-goal-session'),
      createTestContext({ projectDir, sessionId: 'large-goal-session' }),
    );

    expect(prompt.length).toBeGreaterThan(MAX_PROMPT_LENGTH);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('budget tripped');
    expect(result.stopReason).toContain('tokens_cap');
  });

  it('delivers and consumes a deferred worktree advisory', () => {
    const sessionId = 'advisory-session';
    expect(writeWorktreeAdvisory('Use the sparse paths for this worktree.', 'feature/demo', projectDir, sessionId)).toBe(true);

    const result = unifiedPromptDispatcher(
      input('continue the implementation', sessionId),
      createTestContext({ projectDir, sessionId }),
    );

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Use the sparse paths for this worktree.');
    expect(existsSync(join(projectDir, '.claude', 'state', 'worktree-advisory-feature-demo.advisory-session.md'))).toBe(false);
  });

  it('delivers an advisory even when it exceeds the prompt context budget', () => {
    const sessionId = 'large-advisory-session';
    process.env.CLAUDE_EFFORT = 'low';
    const advisory = `Sparse paths: ${'src/important/path, '.repeat(100)}`;
    expect(writeWorktreeAdvisory(advisory, 'feature/large', projectDir, sessionId)).toBe(true);

    const result = unifiedPromptDispatcher(
      input('continue', sessionId),
      createTestContext({ projectDir, sessionId }),
    );

    expect(result.hookSpecificOutput?.additionalContext).toContain(advisory.trimEnd());
    expect(existsSync(join(projectDir, '.claude', 'state', 'worktree-advisory-feature-large.large-advisory-session.md'))).toBe(false);
  });

  it('delivers identical one-time advisories on later worktree events', () => {
    const sessionId = 'repeat-advisory-session';
    const advisory = 'Use the workspace source paths.';
    const context = createTestContext({ projectDir, sessionId });

    expect(writeWorktreeAdvisory(advisory, 'feature/repeat', projectDir, sessionId)).toBe(true);
    const first = unifiedPromptDispatcher(input('continue', sessionId), context);
    expect(first.hookSpecificOutput?.additionalContext).toContain(advisory);

    expect(writeWorktreeAdvisory(advisory, 'feature/repeat', projectDir, sessionId)).toBe(true);
    const second = unifiedPromptDispatcher(input('continue', sessionId), context);
    expect(second.hookSpecificOutput?.additionalContext).toContain(advisory);
    expect(existsSync(join(projectDir, '.claude', 'state', 'worktree-advisory-feature-repeat.repeat-advisory-session.md'))).toBe(false);
  });

  it('keeps advisory updates written after a delivery snapshot', () => {
    const sessionId = 'updated-advisory-session';
    expect(writeWorktreeAdvisory('Original advice.', 'feature/update', projectDir, sessionId)).toBe(true);

    const pending = readWorktreeAdvisories(projectDir, sessionId);
    if (!pending) throw new Error('Expected a pending advisory snapshot');

    expect(writeWorktreeAdvisory('Updated advice.', 'feature/update', projectDir, sessionId)).toBe(true);
    acknowledgeWorktreeAdvisories(projectDir, pending);

    expect(readWorktreeAdvisories(projectDir, sessionId)?.content).toBe('Updated advice.');
  });
});

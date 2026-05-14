/**
 * Unit tests for lifecycle/ask-fallback-injector (#1795)
 *
 * Migrated from UserPromptSubmit → SessionStart in M104 PR-A.
 * Envelope shape now uses hookEventName: 'SessionStart' so the reminder
 * pins to the cached system-prompt prefix (instead of re-injecting every turn).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { askFallbackInjector } from '../../lifecycle/ask-fallback-injector.js';
import { NOOP_CTX } from '../../lib/context.js';
import type { HookInput } from '../../types.js';

const baseInput: HookInput = {
  hook_event: 'SessionStart',
  tool_name: '',
  session_id: 'test-session-1795',
  tool_input: {},
};

describe('ask-fallback-injector (#1795, SessionStart)', () => {
  const originalEnv = process.env.ORK_ASK_FALLBACK;
  beforeEach(() => { delete process.env.ORK_ASK_FALLBACK; });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ORK_ASK_FALLBACK;
    else process.env.ORK_ASK_FALLBACK = originalEnv;
  });

  it('returns silent success when ORK_ASK_FALLBACK is unset', () => {
    const result = askFallbackInjector(baseInput, NOOP_CTX);
    expect(result).toEqual({ continue: true, suppressOutput: true });
  });

  it('returns silent success when ORK_ASK_FALLBACK is set to something other than "text"', () => {
    process.env.ORK_ASK_FALLBACK = 'picker';
    const result = askFallbackInjector(baseInput, NOOP_CTX);
    expect(result).toEqual({ continue: true, suppressOutput: true });
  });

  it('injects fallback reminder when ORK_ASK_FALLBACK=text', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const result = askFallbackInjector(baseInput, NOOP_CTX);
    const ctx = result.hookSpecificOutput?.additionalContext;
    expect(ctx).toBeDefined();
    expect(ctx).toContain('ORK_ASK_FALLBACK=text');
    expect(ctx).toContain('Do not call AskUserQuestion');
    expect(ctx).toContain('numbered list');
    expect(ctx).toContain('orchestkit#1795');
  });

  it('uses SessionStart envelope (cached prompt-prefix, not per-turn)', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const result = askFallbackInjector(baseInput, NOOP_CTX);
    expect(result.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('case-sensitive: ORK_ASK_FALLBACK=TEXT does not trigger', () => {
    process.env.ORK_ASK_FALLBACK = 'TEXT';
    const result = askFallbackInjector(baseInput, NOOP_CTX);
    expect(result).toEqual({ continue: true, suppressOutput: true });
  });

  // --- thorough-coverage additions (#1795 cover pass) -----------------------

  it('does not match partial env values like "text-mode" or "text " (whitespace, suffix)', () => {
    for (const v of ['text-mode', 'text ', ' text', 'TextOff', 'text\n', 'plaintext']) {
      process.env.ORK_ASK_FALLBACK = v;
      const result = askFallbackInjector(baseInput, NOOP_CTX);
      expect(
        result,
        `ORK_ASK_FALLBACK="${v}" should NOT trigger (strict equality)`,
      ).toEqual({ continue: true, suppressOutput: true });
    }
  });

  it('reminder content includes a worked example with numbered options + "Reply with"', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const ctx = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext;
    expect(ctx, 'reminder must include a worked example').toBeDefined();
    expect(ctx).toMatch(/1\./);
    expect(ctx).toMatch(/2\./);
    expect(ctx).toMatch(/3\./);
    expect(ctx).toContain('Reply with');
  });

  it('reminder content tells the model to keep options to 2-4 to match picker affordances', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const ctx = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext as string;
    expect(ctx).toMatch(/2.{1,4}4/);  // matches "2-4", "2–4", or "2 to 4" — exact glyph not asserted
    expect(ctx).toContain('picker affordances');
  });

  it('reminder content tells user how to unset/restore picker mode', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const ctx = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext as string;
    expect(ctx).toContain('Unset ORK_ASK_FALLBACK');
    expect(ctx).toContain('upstream');
  });

  it('reminder wrapped in <system-reminder> tags (CC system-reminder injection contract)', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const ctx = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext as string;
    expect(ctx.startsWith('<system-reminder>')).toBe(true);
    expect(ctx.endsWith('</system-reminder>')).toBe(true);
  });

  it('input shape — works with minimal HookInput (no optional fields beyond required)', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const minimal: HookInput = {
      hook_event: 'SessionStart',
      tool_name: '',
      session_id: 'min',
      tool_input: {},
    };
    const result = askFallbackInjector(minimal, NOOP_CTX);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('SessionStart');
  });

  it('returned reminder is stable across calls (deterministic — no Date.now/random)', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    const a = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext;
    const b = askFallbackInjector(baseInput, NOOP_CTX).hookSpecificOutput?.additionalContext;
    expect(a).toBe(b);
  });

  it('hook never throws even on malformed input', () => {
    process.env.ORK_ASK_FALLBACK = 'text';
    // @ts-expect-error — testing defensive behavior on malformed input
    expect(() => askFallbackInjector({}, NOOP_CTX)).not.toThrow();
    // @ts-expect-error — testing defensive behavior on malformed input
    expect(() => askFallbackInjector(null, NOOP_CTX)).not.toThrow();
  });
});

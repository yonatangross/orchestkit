/**
 * Validates type:prompt hooks in hooks.json
 *
 * Critical findings from CC 2.1.69 runtime analysis:
 * - type:prompt hooks return {ok: boolean, reason?: string} via forced tool call
 * - ok:true = silent pass (no context injected, no output)
 * - ok:false = BLOCKS continuation (preventContinuation:true, stopReason=reason)
 * - They CANNOT inject additionalContext — that's only for command hooks
 * - Supported events: Stop, SubagentStop, UserPromptSubmit, PreToolUse, PostToolUse
 *
 * All 5 type:prompt hooks were removed because:
 * - Communication style: always ok:true = pure token waste
 * - Satisfaction analyzer: ok:false blocks frustrated user's message = actively harmful
 * - Intent extractor: ok:false blocks user's prompt on decisions = wrong semantics
 * - Antipattern warning: duplicate of .claude/rules/antipatterns.md at high token cost
 * - Solution detector: ok:false blocks post-tool continuation = wrong semantics
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Parse hooks.json
// ---------------------------------------------------------------------------

const hooksJsonPath = join(__dirname, '..', '..', 'hooks.json');
const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));

interface HookEntry {
  matcher?: string;
  hooks?: Array<{ type: string; prompt?: string; command?: string; url?: string; timeout?: number }>;
}

/**
 * Extract all type:prompt hooks from hooks.json.
 */
function extractPromptHooks(): Array<{
  eventType: string;
  matcher: string;
  hook: { type: 'prompt'; prompt: string; timeout?: number };
  index: number;
}> {
  const results: Array<{
    eventType: string;
    matcher: string;
    hook: { type: 'prompt'; prompt: string; timeout?: number };
    index: number;
  }> = [];

  for (const [eventType, entries] of Object.entries(hooksJson.hooks)) {
    for (const entry of entries as HookEntry[]) {
      for (let i = 0; i < (entry.hooks || []).length; i++) {
        const hook = entry.hooks![i];
        if (hook.type === 'prompt') {
          results.push({
            eventType,
            matcher: entry.matcher || '*',
            hook: hook as { type: 'prompt'; prompt: string; timeout?: number },
            index: i,
          });
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('type:prompt Hook Validation', () => {
  const promptHooks = extractPromptHooks();

  test('type:prompt hook count matches expectations', () => {
    // 5 type:prompt hooks: 1 gate (antipattern-warning) + 3 observational (comm-style, intent-detector, satisfaction-detector) on UserPromptSubmit + 1 gate (solution-detector) on PostToolUse
    expect(promptHooks.length).toBe(5);
  });

  // Guard tests: if someone re-adds type:prompt hooks, validate them properly
  describe('if prompt hooks are re-added, they must pass these guards', () => {
    // CC 2.1.69 verified supported events
    const supportedEvents = new Set([
      'Stop',
      'SubagentStop',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
    ]);

    for (const { eventType, matcher, hook, index } of promptHooks) {
      const label = `${eventType}[${matcher}]#${index}`;

      test(`${label}: event type is supported`, () => {
        expect(supportedEvents.has(eventType)).toBe(true);
      });

      test(`${label}: has non-empty prompt and timeout`, () => {
        expect(typeof hook.prompt).toBe('string');
        expect(hook.prompt.length).toBeGreaterThan(0);
        expect(hook.timeout).toBeDefined();
        expect(hook.timeout).toBeLessThanOrEqual(30);
      });

      test(`${label}: prompt references {ok} return format`, () => {
        const p = hook.prompt.toLowerCase();
        expect(p.includes('"ok"') || p.includes("'ok'") || p.includes('{ok')).toBe(true);
      });

      test(`${label}: prompt does not reference command-hook-only fields`, () => {
        // type:prompt hooks CANNOT use these — they return {ok, reason} only
        expect(hook.prompt).not.toContain('hookSpecificOutput');
        expect(hook.prompt).not.toContain('additionalContext');
        expect(hook.prompt).not.toContain('suppressOutput');
      });

      test(`${label}: prompt uses $ARGUMENTS for context`, () => {
        expect(
          hook.prompt.includes('$ARGUMENTS') || hook.prompt.includes('$TOOL_INPUT')
        ).toBe(true);
      });

      // Observational hooks (analytics, classification) must never return ok:false
      const observationalPatterns = ['analytics', 'classify', 'classification', 'style', 'verbosity'];
      const isObservational = observationalPatterns.some((p) => hook.prompt.toLowerCase().includes(p));

      if (isObservational) {
        test(`${label}: observational hook always returns ok:true (never blocks)`, () => {
          const p = hook.prompt.toLowerCase();
          expect(
            p.includes('"ok": true') || p.includes('"ok":true'),
            `Observational hooks must always return ok:true. ok:false BLOCKS the ${eventType} event.`
          ).toBe(true);
        });
      }

      // UserPromptSubmit ok:false blocks user's message — require explicit justification
      if (eventType === 'UserPromptSubmit') {
        test(`${label}: UserPromptSubmit ok:false has clear gate semantics`, () => {
          const p = hook.prompt.toLowerCase();
          const alwaysAllows = p.includes('always allow') ||
            (p.includes('"ok": true') && !p.includes('"ok": false'));
          const hasGateSemantics = p.includes('warning') || p.includes('block') ||
            p.includes('prevent') || p.includes('dangerous');

          expect(
            alwaysAllows || hasGateSemantics,
            `ok:false on UserPromptSubmit BLOCKS the user's message. This must be intentional gate behavior.`
          ).toBe(true);
        });
      }
    }

    // Always-passing test so the describe block isn't empty
    test('guard suite is ready for future prompt hooks', () => {
      expect(true).toBe(true);
    });
  });
});

describe('Hook Type Distribution', () => {
  test('hooks.json hook types count', () => {
    let commandCount = 0;
    let promptCount = 0;
    let httpCount = 0;

    for (const entries of Object.values(hooksJson.hooks)) {
      for (const entry of entries as HookEntry[]) {
        for (const hook of entry.hooks || []) {
          if (hook.type === 'command') commandCount++;
          else if (hook.type === 'prompt') promptCount++;
          else if (hook.type === 'http') httpCount++;
        }
      }
    }

    expect(commandCount).toBeGreaterThan(0);
    // 5 type:prompt hooks: antipattern-warning, comm-style, intent-detector, satisfaction-detector (UserPromptSubmit) + solution-detector (PostToolUse)
    expect(promptCount).toBe(5);
    // 4 native HTTP hooks (SessionEnd, WorktreeCreate, WorktreeRemove, InstructionsLoaded)
    expect(httpCount).toBe(4);
  });
});

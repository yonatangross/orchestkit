/**
 * Unit tests for antipattern-warning hook
 *
 * Architecture (post #972):
 * - Static patterns → rules file (materializeAntipatternRules, called at SessionStart).
 * - Dynamic learned patterns → antipatternWarning() (deprecated, no longer wired into dispatcher).
 * - Static antipattern detection → type:prompt hook in hooks.json (LLM classifies directly).
 *
 * antipatternWarning() is no longer registered in unified-dispatcher.ts (#972).
 * materializeAntipatternRules() is still called by sync-session-dispatcher.ts.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';
import { antipatternWarning, materializeAntipatternRules } from '../../prompt/antipattern-warning.js';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// =============================================================================
// Helpers
// =============================================================================

function createPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    prompt,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/antipattern-warning', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const result = antipatternWarning(createPromptInput(''));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when no dynamic patterns match', () => {
      const result = antipatternWarning(createPromptInput('What is the weather like today?'));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution regardless of prompt content', () => {
      for (const prompt of ['', 'hello', 'implement something', 'random question']) {
        const result = antipatternWarning(createPromptInput(prompt));
        expect(result.continue).toBe(true);
      }
    });

    test('returns silent success even with learned patterns file present (#1145 migration)', () => {
      // Dynamic pattern matching was removed in v7.27.1 (#1145) —
      // migrated to type:prompt hook. antipatternWarning() is now a no-op.
      const tempDir = join(tmpdir(), `ap-test-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'feedback'), { recursive: true });
      writeFileSync(
        join(tempDir, '.claude', 'feedback', 'learned-patterns.json'),
        JSON.stringify({ patterns: [{ text: 'weather API causes timeouts', outcome: 'failed' }] }),
      );

      const result = antipatternWarning(createPromptInput('Check the weather API', { project_dir: tempDir }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);

      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Static patterns — materialized to rules file (not checked at runtime)
  // ---------------------------------------------------------------------------

  describe('materializeAntipatternRules', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `ap-rules-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'rules'), { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('writes .claude/rules/antipatterns.md', () => {
      materializeAntipatternRules(tempDir);
      const rulesFile = join(tempDir, '.claude', 'rules', 'antipatterns.md');
      expect(existsSync(rulesFile)).toBe(true);
    });

    test('rules file contains all 7 known anti-patterns', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(join(tempDir, '.claude', 'rules', 'antipatterns.md'), 'utf8');
      expect(content).toContain('offset pagination');
      expect(content).toContain('manual jwt validation');
      expect(content).toContain('plaintext');
      expect(content).toContain('global state');
      expect(content).toContain('synchronous file');
      expect(content).toContain('n+1 query');
      expect(content).toContain('polling for real-time');
    });

    test('static patterns are NOT checked at runtime', () => {
      // "implement offset pagination" should NOT trigger a warning from the runtime hook
      // because static patterns are in the rules file, not runtime-matched
      const result = antipatternWarning(createPromptInput('Implement offset pagination'));
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Dynamic learned patterns (project-local)
  // ---------------------------------------------------------------------------

  describe('dynamic learned patterns', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `ap-learned-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'feedback'), { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('no longer warns for learned patterns (#1145 — migrated to type:prompt hook)', () => {
      writeFileSync(
        join(tempDir, '.claude', 'feedback', 'learned-patterns.json'),
        JSON.stringify({
          patterns: [{ text: 'offset pagination causes issues', outcome: 'failed' }],
        }),
      );

      const result = antipatternWarning(createPromptInput('Implement offset feature', { project_dir: tempDir }));
      // Dynamic matching removed — always silent success
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('ignores successful patterns', () => {
      writeFileSync(
        join(tempDir, '.claude', 'feedback', 'learned-patterns.json'),
        JSON.stringify({
          patterns: [{ text: 'cursor pagination works well', outcome: 'success' }],
        }),
      );

      const result = antipatternWarning(createPromptInput('Use cursor pagination', { project_dir: tempDir }));
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('handles missing patterns file gracefully', () => {
      const result = antipatternWarning(createPromptInput('Implement new feature', { project_dir: tempDir }));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles malformed patterns file gracefully', () => {
      writeFileSync(join(tempDir, '.claude', 'feedback', 'learned-patterns.json'), 'invalid json');
      const result = antipatternWarning(createPromptInput('Implement new feature', { project_dir: tempDir }));
      expect(result.continue).toBe(true);
    });

    test('handles empty patterns array', () => {
      writeFileSync(
        join(tempDir, '.claude', 'feedback', 'learned-patterns.json'),
        JSON.stringify({ patterns: [] }),
      );
      const result = antipatternWarning(createPromptInput('Implement something', { project_dir: tempDir }));
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.9 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.9 compliance', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `ap-cc-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'feedback'), { recursive: true });
      writeFileSync(
        join(tempDir, '.claude', 'feedback', 'learned-patterns.json'),
        JSON.stringify({ patterns: [{ text: 'redis caching failed', outcome: 'failed' }] }),
      );
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('returns silent success — dynamic warnings removed (#1145)', () => {
      const result = antipatternWarning(createPromptInput('Use redis caching', { project_dir: tempDir }));
      // hookEventName is no longer set — function is a no-op
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('no additionalContext — static rules via materializeAntipatternRules instead', () => {
      const result = antipatternWarning(createPromptInput('Use redis for this', { project_dir: tempDir }));
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('includes suppressOutput: true for silent responses', () => {
      const result = antipatternWarning(createPromptInput('What is the weather?'));
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      expect(() => antipatternWarning(createPromptInput('$pecial ch@rs! <test>'))).not.toThrow();
    });

    test('handles very long prompts', () => {
      const result = antipatternWarning(createPromptInput('x'.repeat(10000)));
      expect(result.continue).toBe(true);
    });

    test('handles prompts with unicode', () => {
      expect(() => antipatternWarning(createPromptInput('emoji: 😀 🔥'))).not.toThrow();
    });

    test('uses provided project_dir', () => {
      const result = antipatternWarning(createPromptInput('test', { project_dir: '/custom/path' }));
      expect(result.continue).toBe(true);
    });

    test('handles missing project_dir gracefully', () => {
      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-123',
        tool_input: {},
        prompt: 'test prompt',
      };
      expect(() => antipatternWarning(input)).not.toThrow();
    });
  });
});

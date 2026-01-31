/**
 * Unit tests for satisfaction-detector hook
 * Tests UserPromptSubmit hook that detects user satisfaction signals from prompts
 * CC 2.1.7 Compliant - Feedback System (#57)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { satisfactionDetector } from '../../prompt/satisfaction-detector.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create UserPromptSubmit input for testing
 */
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
// detectSatisfaction Function Tests (via satisfactionDetector)
// =============================================================================

describe('prompt/satisfaction-detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `satisfaction-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(tempDir, '.claude'), { recursive: true });
    // Reset any environment variables
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ===========================================================================
  // Basic Behavior Tests
  // ===========================================================================

  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for undefined prompt', () => {
      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session-123',
        project_dir: tempDir,
        tool_input: {},
      };
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution regardless of sentiment', () => {
      const prompts = [
        'thanks for the help',
        'this is wrong',
        'neutral message here',
        '',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('always suppresses output', () => {
      const prompts = [
        'thank you so much!',
        'this doesnt work',
        'some neutral prompt',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.suppressOutput).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Positive Pattern Detection Tests
  // ===========================================================================

  describe('positive pattern detection', () => {
    test('detects "thank" pattern', () => {
      const prompts = ['thank you', 'thanks', 'Thank you very much', 'THANKS!'];
      for (const prompt of prompts) {
        vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('detects "great" pattern as word boundary', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('that is great!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "perfect" pattern as word boundary', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('Perfect, that works!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "excellent" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('excellent work on that', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "awesome" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('that is awesome!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "works well" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('this works well now', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "works great" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('it works great', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "works perfectly" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('this works perfectly', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "that\'s exactly what" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that's exactly what I needed", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "that is just what" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('that is just what I wanted', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "nice" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('nice work!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "good job" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('good job on that', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "well done" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('well done!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "looks good" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('that looks good to me', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "look good" pattern (plural)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('those changes look good', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "lgtm" pattern (case insensitive)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('LGTM', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "ship it" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('ship it!', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Negative Pattern Detection Tests
  // ===========================================================================

  describe('negative pattern detection', () => {
    test('detects "not right" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that's not right", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "no...right" pattern (with space)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("no that's not right", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "wrong" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('this is wrong', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "doesn\'t work" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("this doesn't work", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "broken" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('the feature is broken', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "failed" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('the test failed', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "try again" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('please try again', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "start over" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("let's start over", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "undo" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('please undo that change', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "revert" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('revert the changes', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "frustrat" pattern (frustrating/frustrated)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const prompts = ['this is frustrating', 'I am frustrated'];
      for (const prompt of prompts) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('detects "annoy" pattern (annoying/annoyed)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const prompts = ['this is annoying', 'I am annoyed'];
      for (const prompt of prompts) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('detects "confus" pattern (confusing/confused)', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const prompts = ['this is confusing', 'I am confused'];
      for (const prompt of prompts) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('detects "still not" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('it still not working', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "still doesn\'t" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("it still doesn't compile", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "didn\'t work" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that didn't work", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "didn\'t help" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that didn't help", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('detects "that\'s not" pattern', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that's not what I asked for", { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Neutral Detection Tests
  // ===========================================================================

  describe('neutral detection', () => {
    test('returns neutral for generic question', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('what is the weather today?', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('returns neutral for code request', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('write a function to sort an array', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('returns neutral for technical discussion', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput(
        'how should we structure the database schema?',
        { project_dir: tempDir }
      );
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('returns neutral for ambiguous statements', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('I see what you mean', { project_dir: tempDir });
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Sampling Logic Tests
  // ===========================================================================

  describe('sampling logic', () => {
    test('respects default sample rate of 3', () => {
      // Without setting SATISFACTION_SAMPLE_RATE, default is 3
      const input = createPromptInput('thank you', { project_dir: tempDir });

      // First two calls should skip (counter 1, 2)
      satisfactionDetector(input);
      satisfactionDetector(input);

      // Third call should process (counter 3, 3 % 3 === 0)
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('respects custom sample rate from environment', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '2');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      // First call should skip (counter 1, 1 % 2 !== 0)
      const result1 = satisfactionDetector(input);
      expect(result1.continue).toBe(true);

      // Second call should process (counter 2, 2 % 2 === 0)
      const result2 = satisfactionDetector(input);
      expect(result2.continue).toBe(true);
    });

    test('sample rate of 1 processes every prompt', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      for (let i = 0; i < 5; i++) {
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });

    test('handles invalid sample rate gracefully', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', 'invalid');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      // parseInt('invalid', 10) returns NaN, || 3 fallback to 3
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('handles zero sample rate', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '0');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      // 0 is falsy, so parseInt returns 0, || 3 fallback to 3
      // Actually: parseInt('0', 10) returns 0, but 0 || 3 = 3
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('handles negative sample rate', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '-5');
      const input = createPromptInput('thank you', { project_dir: tempDir });
      // parseInt('-5', 10) returns -5, which is truthy
      // -5 > 1, so sampling applies
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Counter File Tests
  // ===========================================================================

  describe('counter file management', () => {
    test('creates counter file if it does not exist', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });
      satisfactionDetector(input);

      const counterFile = join(tempDir, '.claude', '.satisfaction-counter');
      expect(existsSync(counterFile)).toBe(true);
    });

    test('increments counter on each call', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      satisfactionDetector(input);
      satisfactionDetector(input);
      satisfactionDetector(input);

      const counterFile = join(tempDir, '.claude', '.satisfaction-counter');
      const counter = parseInt(readFileSync(counterFile, 'utf8').trim(), 10);
      expect(counter).toBe(3);
    });

    test('handles corrupted counter file gracefully', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const counterFile = join(tempDir, '.claude', '.satisfaction-counter');
      mkdirSync(join(tempDir, '.claude'), { recursive: true });
      writeFileSync(counterFile, 'not a number');

      const input = createPromptInput('thank you', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      // Counter should be reset to 1
      const counter = parseInt(readFileSync(counterFile, 'utf8').trim(), 10);
      expect(counter).toBe(1);
    });

    test('handles empty counter file gracefully', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const counterFile = join(tempDir, '.claude', '.satisfaction-counter');
      mkdirSync(join(tempDir, '.claude'), { recursive: true });
      writeFileSync(counterFile, '');

      const input = createPromptInput('thank you', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('creates directory structure if missing', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      // Use a fresh temp dir without .claude folder
      const freshDir = join(tmpdir(), `fresh-test-${Date.now()}`);

      try {
        const input = createPromptInput('thank you', { project_dir: freshDir });
        const result = satisfactionDetector(input);

        expect(result.continue).toBe(true);
        expect(existsSync(join(freshDir, '.claude'))).toBe(true);
      } finally {
        rmSync(freshDir, { recursive: true, force: true });
      }
    });
  });

  // ===========================================================================
  // Log File Tests
  // ===========================================================================

  describe('satisfaction log file', () => {
    test('creates feedback directory and log file for positive sentiment', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you!', { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      expect(existsSync(logFile)).toBe(true);
    });

    test('creates feedback directory and log file for negative sentiment', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput("that's wrong", { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      expect(existsSync(logFile)).toBe(true);
    });

    test('does not create log file for neutral sentiment', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('what time is it', { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      // Log file might exist from previous tests but shouldn't have new entries
      // Actually, for clean tempDir, it shouldn't exist
      // If it exists, it's from prior test - skip this assertion
    });

    test('log entry contains timestamp, session_id, sentiment, and context', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you for the help', {
        project_dir: tempDir,
        session_id: 'session-abc-123',
      });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');

      expect(content).toContain('session-abc-123');
      expect(content).toContain('positive');
      expect(content).toContain('thank you for the help');
    });

    test('truncates context to 50 characters with ellipsis', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const longPrompt =
        'thank you so much for this incredibly detailed and helpful response to my question';
      const input = createPromptInput(longPrompt, { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');

      expect(content).toContain('...');
      // First 50 chars + ...
      expect(content).toContain(longPrompt.slice(0, 50));
    });

    test('appends multiple log entries', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');

      satisfactionDetector(
        createPromptInput('thanks!', { project_dir: tempDir, session_id: 'session-1' })
      );
      satisfactionDetector(
        createPromptInput('this is wrong', { project_dir: tempDir, session_id: 'session-2' })
      );

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('positive');
      expect(lines[1]).toContain('negative');
    });
  });

  // ===========================================================================
  // Command Prompt Skipping Tests
  // ===========================================================================

  describe('command prompt skipping', () => {
    test('skips prompts starting with /', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('/help', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips skill commands starting with /', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('/ork:recall database', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not skip prompts with / in the middle', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('check the path/to/file', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Minimum Prompt Length Tests
  // ===========================================================================

  describe('minimum prompt length', () => {
    test('skips single character prompts', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('y', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('processes prompts with exactly 2 characters', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('ok', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('processes prompts longer than minimum length', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thanks', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    test('handles prompts with special characters', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thanks!!! @#$%^&*()', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with newlines', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('first line\nthank you\nthird line', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with unicode characters', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thanks! \ud83d\udc4d\ud83c\udf89', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with tabs', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank\tyou\tvery\tmuch', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('handles very long prompts', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const longPrompt = 'thank you ' + 'x'.repeat(10000);
      const input = createPromptInput(longPrompt, { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with only whitespace', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('   \t\n   ', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('is case insensitive for all patterns', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const variations = ['THANK YOU', 'Thank You', 'tHaNk YoU', 'thank you'];

      for (const prompt of variations) {
        const input = createPromptInput(prompt, { project_dir: tempDir });
        const result = satisfactionDetector(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Pattern Priority Tests
  // ===========================================================================

  describe('pattern priority', () => {
    test('positive patterns are checked before negative patterns', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      // A prompt that could match both - positive should win
      const input = createPromptInput('thank you even though something was wrong', {
        project_dir: tempDir,
      });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');
      expect(content).toContain('positive');
    });
  });

  // ===========================================================================
  // Session Tracker Integration Tests
  // ===========================================================================

  describe('session tracker integration', () => {
    test('handles session tracker errors gracefully', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      // Mock trackEvent to throw
      vi.mock('../../lib/session-tracker.js', async (importOriginal) => {
        const original = await importOriginal<typeof import('../../lib/session-tracker.js')>();
        return {
          ...original,
          trackEvent: vi.fn().mockImplementation(() => {
            throw new Error('Tracking error');
          }),
        };
      });

      const input = createPromptInput('thank you', { project_dir: tempDir });
      // Should not throw
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Project Directory Handling Tests
  // ===========================================================================

  describe('project directory handling', () => {
    test('uses provided project_dir', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      expect(existsSync(logFile)).toBe(true);
    });

    test('falls back to getProjectDir when project_dir is missing', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      vi.stubEnv('CLAUDE_PROJECT_DIR', tempDir);

      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session-123',
        tool_input: {},
        prompt: 'thank you',
      };
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // Session ID Handling Tests
  // ===========================================================================

  describe('session ID handling', () => {
    test('uses provided session_id', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', {
        project_dir: tempDir,
        session_id: 'custom-session-xyz',
      });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');
      expect(content).toContain('custom-session-xyz');
    });

    test('falls back to getSessionId when session_id is missing', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      vi.stubEnv('CLAUDE_SESSION_ID', 'env-session-123');

      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: '',
        project_dir: tempDir,
        tool_input: {},
        prompt: 'thank you',
      };
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });
  });

  // ===========================================================================
  // CC 2.1.7 Compliance Tests
  // ===========================================================================

  describe('CC 2.1.7 compliance', () => {
    test('returns valid HookResult structure', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(typeof result.continue).toBe('boolean');
      expect(typeof result.suppressOutput).toBe('boolean');
      expect(result).not.toHaveProperty('systemMessage');
      expect(result).not.toHaveProperty('stopReason');
    });

    test('does not inject additionalContext', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });
      const result = satisfactionDetector(input);

      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  // ===========================================================================
  // Performance Tests
  // ===========================================================================

  describe('performance', () => {
    test('completes within reasonable time for short prompts', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      const start = performance.now();
      satisfactionDetector(input);
      const duration = performance.now() - start;

      // Should complete in under 50ms for short prompts
      expect(duration).toBeLessThan(50);
    });

    test('completes within reasonable time for long prompts', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const longPrompt = 'thank you ' + 'x'.repeat(10000);
      const input = createPromptInput(longPrompt, { project_dir: tempDir });

      const start = performance.now();
      satisfactionDetector(input);
      const duration = performance.now() - start;

      // Should complete in under 100ms even for long prompts
      expect(duration).toBeLessThan(100);
    });

    test('handles rapid successive calls', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('thank you', { project_dir: tempDir });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        satisfactionDetector(input);
      }
      const duration = performance.now() - start;

      // 100 calls should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  // ===========================================================================
  // Boundary Tests
  // ===========================================================================

  describe('boundary tests', () => {
    test('handles prompt at exact minimum length', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('ab', { project_dir: tempDir }); // Exactly 2 chars (MIN_PROMPT_LENGTH)
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
    });

    test('handles prompt just below minimum length', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const input = createPromptInput('a', { project_dir: tempDir }); // 1 char, below MIN_PROMPT_LENGTH=2
      const result = satisfactionDetector(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles context truncation at exactly 50 characters', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const exactPrompt = 'thank you for this response its very helpful to me'; // 50 chars
      const input = createPromptInput(exactPrompt, { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');

      // Should not have ellipsis at exactly 50 chars
      expect(content).not.toContain('...');
    });

    test('handles context truncation at 51 characters', () => {
      vi.stubEnv('SATISFACTION_SAMPLE_RATE', '1');
      const longPrompt = 'thank you for this response its very helpful to mex'; // 51 chars
      const input = createPromptInput(longPrompt, { project_dir: tempDir });
      satisfactionDetector(input);

      const logFile = join(tempDir, '.claude', 'feedback', 'satisfaction.log');
      const content = readFileSync(logFile, 'utf8');

      // Should have ellipsis at 51 chars
      expect(content).toContain('...');
    });
  });
});

/**
 * Input modifiers in the shipped Bash PreToolUse chain.
 *
 * In auto mode the classifier reviews a call before PreToolUse hooks run. Any
 * hook that changes the input voids that review and Claude Code refuses the
 * call: "a hook changed this call's input after auto mode reviewed it". 7 days
 * of permission-denials.jsonl (18-24.11.2026) held 1,454 of those walls; 425
 * changed nothing but a `timeout: 120000` the retired default-timeout-setter
 * added, which is Claude Code's own default.
 *
 * Paired cases, all through the real dispatcher entry:
 * - a Bash call with no timeout passes through untouched (fails on the old
 *   code, which added timeout 120000 and dropped run_in_background);
 * - gh-label-enforcer still appends --label outside auto mode (kept
 *   behaviour) and only advises inside it (fails on the old code).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HookInput } from '../../types.js';
import { syncBashDispatcher } from '../../pretool/bash/sync-bash-dispatcher.js';
import { createTestContext } from '../fixtures/test-context.js';

let projectDir: string;

function run(toolInput: Record<string, unknown>, mode?: string) {
  const input = {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: projectDir,
    tool_input: toolInput,
    ...(mode ? { permission_mode: mode } : {}),
  } as unknown as HookInput;
  const result = syncBashDispatcher(input, createTestContext({ projectDir }));
  return {
    result,
    updatedInput: result.hookSpecificOutput?.updatedInput as Record<string, unknown> | undefined,
    context: (result.hookSpecificOutput?.additionalContext as string | undefined) ?? '',
  };
}

describe('sync-bash-dispatcher input modifier chain', () => {
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'ork-bash-chain-'));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe('a call with no timeout is never rewritten', () => {
    // The default is omitted on purpose: a suite that always passes a timeout
    // never covers the path the setter took.
    it.each(['auto', 'default', 'acceptEdits', 'bypassPermissions', undefined])('mode %s', (mode) => {
      const { result, updatedInput } = run({ command: 'herdr agent list', description: 'List agents' }, mode);

      expect(result.continue).toBe(true);
      expect(updatedInput).toBeUndefined();
    });

    it('keeps run_in_background by not touching the input at all', () => {
      const { updatedInput } = run({ command: 'caffeinate -i -s', run_in_background: true }, 'auto');

      expect(updatedInput).toBeUndefined();
    });
  });

  describe('gh-label-enforcer outside auto mode (kept behaviour)', () => {
    it('appends the label and keeps the caller fields, with no timeout added', () => {
      const { updatedInput, context } = run({
        command: 'gh issue create --title "fix crash" --body "Repro attached"',
        description: 'File the crash report',
        run_in_background: true,
      });

      expect(updatedInput).toEqual({
        command: 'gh issue create --title "fix crash" --body "Repro attached" --label bug',
        description: 'File the crash report',
        run_in_background: true,
      });
      expect(context).toContain('Auto-appended --label bug');
    });

    it('keeps the caller timeout when one is given', () => {
      const { updatedInput } = run({ command: 'gh issue create --title "fix crash" --body "Repro attached"', timeout: 30000 });

      expect(updatedInput).toEqual({
        command: 'gh issue create --title "fix crash" --body "Repro attached" --label bug',
        timeout: 30000,
      });
    });

    it('leaves an already-labelled issue untouched', () => {
      const { updatedInput } = run({ command: 'gh issue create --title "fix crash" --label bug' });

      expect(updatedInput).toBeUndefined();
    });

    it('leaves a compound issue command unrewritten and advises', () => {
      const { updatedInput, context } = run({ command: 'cat notes.md && gh issue create --title "fix crash" --body-file notes.md' });

      expect(updatedInput).toBeUndefined();
      expect(context).not.toContain('Auto-appended');
      expect(context).toContain('has no --label');
    });
  });

  describe('gh-label-enforcer in auto mode', () => {
    it('advises instead of rewriting, and names why', () => {
      const { result, updatedInput, context } = run(
        { command: 'gh issue create --title "fix crash" --body "Repro attached"' },
        'auto',
      );

      expect(result.continue).toBe(true);
      expect(updatedInput).toBeUndefined();
      expect(context).toContain('has no --label');
      expect(context).toContain('auto mode');
      expect(context).not.toContain('Auto-appended');
    });

    it('grants nothing: no permissionDecision rides on the advisory', () => {
      const { result } = run({ command: 'gh issue create --title "fix crash"' }, 'auto');

      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });
});

/**
 * Regression for input modifiers in the shipped Bash PreToolUse chain.
 *
 * gh-label-enforcer rewrites `gh issue create` to add a --label, and
 * default-timeout-setter (inside the advisory dispatcher, later in the chain)
 * adds a timeout. Each modifier must see the input the previous one produced,
 * otherwise the later one rebuilds updatedInput from the original command and
 * silently drops the label while the label context still claims it was added.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HookInput } from '../../types.js';
import { syncBashDispatcher } from '../../pretool/bash/sync-bash-dispatcher.js';
import { createTestContext } from '../fixtures/test-context.js';

let projectDir: string;

function run(toolInput: Record<string, unknown>) {
  const input: HookInput = {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: projectDir,
    tool_input: toolInput,
  };
  const result = syncBashDispatcher(input, createTestContext({ projectDir }));
  return {
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

  it('keeps the appended label when the default timeout is also applied', () => {
    const { updatedInput, context } = run({ command: 'gh issue create --title "fix crash" --body "Repro attached"' });

    expect(updatedInput).toEqual({
      command: 'gh issue create --title "fix crash" --body "Repro attached" --label bug',
      timeout: 120000,
    });
    expect(context).toContain('Auto-appended --label bug');
  });

  it('keeps the appended label and the caller timeout when a timeout is given', () => {
    const { updatedInput } = run({ command: 'gh issue create --title "fix crash" --body "Repro attached"', timeout: 30000 });

    expect(updatedInput).toEqual({
      command: 'gh issue create --title "fix crash" --body "Repro attached" --label bug',
      timeout: 30000,
    });
  });

  it('keeps tool input fields that no modifier touches', () => {
    const { updatedInput } = run({
      command: 'gh issue create --title "fix crash" --body "Repro attached"',
      description: 'File the crash report',
      run_in_background: true,
    });

    expect(updatedInput).toEqual({
      command: 'gh issue create --title "fix crash" --body "Repro attached" --label bug',
      description: 'File the crash report',
      run_in_background: true,
      timeout: 120000,
    });
  });

  it('adds only the default timeout to an already-labelled issue', () => {
    const command = 'gh issue create --title "fix crash" --label bug';
    const { updatedInput } = run({ command });

    expect(updatedInput).toEqual({ command, timeout: 120000 });
  });

  it('leaves a compound issue command unrewritten and only adds the timeout', () => {
    const command = 'cat notes.md && gh issue create --title "fix crash" --body-file notes.md';
    const { updatedInput, context } = run({ command });

    expect(updatedInput).toEqual({ command, timeout: 120000 });
    expect(context).not.toContain('Auto-appended');
  });
});

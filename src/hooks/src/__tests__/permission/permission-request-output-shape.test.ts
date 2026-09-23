/**
 * F11 / SC47: PermissionRequest auto-approve hooks must never emit a
 * PreToolUse label or permissionDecision. CC reads only
 * hookSpecificOutput.decision.behavior on this event.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import { learningTracker } from '../../permission/learning-tracker.js';
import { unifiedPermissionBashDispatcher } from '../../permission/unified-dispatcher.js';
import { outputPermissionRequestAllow, outputSilentAllow } from '../../lib/common.js';
import type { HookInput } from '../../types.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function bash(command: string): HookInput {
  return {
    hook_event_name: 'PermissionRequest',
    tool_name: 'Bash',
    tool_input: { command },
    cwd: process.cwd(),
    session_id: 'test',
  } as HookInput;
}

function writeEdit(filePath: string): HookInput {
  return {
    hook_event_name: 'PermissionRequest',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'x' },
    cwd: process.cwd(),
    session_id: 'test',
  } as HookInput;
}

function assertPermissionRequestAllow(result: {
  hookSpecificOutput?: {
    hookEventName?: string;
    permissionDecision?: string;
    decision?: { behavior?: string };
  };
}): void {
  expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionRequest');
  expect(result.hookSpecificOutput?.decision?.behavior).toBe('allow');
  expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  expect(result.hookSpecificOutput?.hookEventName).not.toBe('PreToolUse');
}


const __ORK_PAA_PREV = process.env.ORK_PERMISSION_AUTO_APPROVE;
beforeEach(() => {
  process.env.ORK_PERMISSION_AUTO_APPROVE = '1';
});
afterEach(() => {
  if (__ORK_PAA_PREV === undefined) delete process.env.ORK_PERMISSION_AUTO_APPROVE;
  else process.env.ORK_PERMISSION_AUTO_APPROVE = __ORK_PAA_PREV;
});

describe('F11 PermissionRequest output shape', () => {
  test('builder emits decision.behavior allow, not PreToolUse', () => {
    assertPermissionRequestAllow(outputPermissionRequestAllow());
  });

  test('PreToolUse builder stays on permissionDecision (callers unchanged)', () => {
    const r = outputSilentAllow();
    expect(r.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(r.hookSpecificOutput?.permissionDecision).toBe('allow');
  });

  test('auto-approve-safe-bash never labels allow as PreToolUse', () => {
    assertPermissionRequestAllow(autoApproveSafeBash(bash('git status')));
  });

  test('auto-approve-project-writes never labels allow as PreToolUse', () => {
    const filePath = path.join(process.cwd(), 'src', 'hooks', 'package.json');
    assertPermissionRequestAllow(autoApproveProjectWrites(writeEdit(filePath)));
  });

  test('unified dispatcher forwards decision.behavior allow', () => {
    assertPermissionRequestAllow(unifiedPermissionBashDispatcher(bash('git status')));
  });

  describe('learning-tracker allow path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-f11-'));
    const cachePath = path.join(tmp, 'learned-patterns-cache.json');

    beforeEach(() => {
      vi.spyOn(process, 'env', 'get').mockReturnValue({
        ...process.env,
        CLAUDE_PLUGIN_ROOT: tmp,
      } as NodeJS.ProcessEnv);
      // learning-tracker resolves cache under plugin root / home; seed via
      // the distilled cache path it prefers when present.
      fs.mkdirSync(path.join(tmp, 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, 'learned-patterns-cache.json'),
        JSON.stringify({
          schema: 'ork.learned-patterns-cache.v1',
          patterns: [{ pattern: '^echo hello$', count: 5 }],
          generatedAt: new Date().toISOString(),
        }),
      );
      void cachePath;
    });

    afterEach(() => {
      vi.restoreAllMocks();
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    test('learned allow never emits PreToolUse label', () => {
      // If the cache path does not resolve in this harness, the hook passes
      // through; that still must not emit a PreToolUse allow.
      const result = learningTracker(bash('echo hello'));
      if (result.hookSpecificOutput?.decision?.behavior === 'allow') {
        assertPermissionRequestAllow(result);
      } else {
        expect(result.hookSpecificOutput?.hookEventName).not.toBe('PreToolUse');
        expect(result.hookSpecificOutput?.permissionDecision).not.toBe('allow');
      }
    });
  });

  test('KEY_EVENTS no longer lists PermissionRequest under permissionDecision', async () => {
    const { KEY_EVENTS } = await import('../../../bin/cc-output-keys.generated.mjs');
    const pd = KEY_EVENTS.get('permissionDecision');
    expect(pd?.has('PermissionRequest')).toBe(false);
    expect(pd?.has('PreToolUse')).toBe(true);
    const decision = KEY_EVENTS.get('decision');
    expect(decision?.has('PermissionRequest')).toBe(true);
  });
});

/**
 * Async Hooks Registry Tests
 * Tests for verifying async hook configuration in hooks.json
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

interface Hook {
  type: string;
  command?: string;
  prompt?: string;
  async?: boolean;
  timeout?: number;
  once?: boolean;
}

interface HookGroup {
  matcher?: string;
  hooks: Hook[];
}

interface HooksConfig {
  description: string;
  hooks: Record<string, HookGroup[]>;
}

describe('Async Hooks Registry', () => {
  let hooksConfig: HooksConfig;

  beforeAll(() => {
    // Resolve hooks.json relative to this test file so it works regardless of cwd
    const hooksPath = path.resolve(__dirname, '..', '..', '..', 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf-8');
    hooksConfig = JSON.parse(content);
  });

  describe('Native Async Hook Configuration (Issue #653)', () => {
    it('should have unified dispatchers using native async: true', () => {
      // Issue #653: Migrated from fire-and-forget spawn pattern (run-hook-silent.mjs)
      // to native CC async: true. Eliminates per-event process spawning entirely.
      // Fixes Windows console flashing (#644) and reduces overhead from ~50ms to ~0ms per event.
      const expectedAsyncDispatchers = [
        { path: 'lifecycle/unified-dispatcher', event: 'SessionStart' },
        { path: 'posttool/unified-dispatcher', event: 'PostToolUse' },
        { path: 'stop/unified-dispatcher', event: 'Stop' },
        { path: 'subagent-stop/unified-dispatcher', event: 'SubagentStop' },
        { path: 'notification/unified-dispatcher', event: 'Notification' },
        { path: 'setup/unified-dispatcher', event: 'Setup' },
        { path: 'prompt/capture-user-intent', event: 'UserPromptSubmit' },
        { path: 'notification/sound', event: 'Notification' },
      ];

      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      for (const { path: hookPath, event } of expectedAsyncDispatchers) {
        const hook = allHooks.find(h => h.command?.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} (${event}) should exist in hooks.json`).toBeDefined();
        expect(hook?.command, `Dispatcher ${hookPath} (${event}) should use run-hook.mjs (not silent)`).toContain('run-hook.mjs');
        expect(hook?.command, `Dispatcher ${hookPath} should NOT use run-hook-silent.mjs`).not.toContain('run-hook-silent.mjs');
        expect(hook?.async, `Dispatcher ${hookPath} (${event}) should have async: true`).toBe(true);
      }
    });

    it('should have exactly 8 async hooks', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      expect(asyncHooks.length, 'Should have exactly 8 async hooks').toBe(8);
    });

    it('should NOT have async: true for blocking hooks', () => {
      const blockingHookPaths = [
        // PreToolUse - security critical
        'pretool/bash/dangerous-command-blocker',
        'pretool/write-edit/file-guard',
        // PermissionRequest - must block
        'permission/auto-approve-safe-bash',
        'permission/auto-approve-project-writes',
      ];

      const preToolHooks: Hook[] = [];
      const permissionHooks: Hook[] = [];

      if (hooksConfig.hooks.PreToolUse) {
        for (const group of hooksConfig.hooks.PreToolUse) {
          preToolHooks.push(...group.hooks);
        }
      }
      if (hooksConfig.hooks.PermissionRequest) {
        for (const group of hooksConfig.hooks.PermissionRequest) {
          permissionHooks.push(...group.hooks);
        }
      }

      const allBlockingHooks = [...preToolHooks, ...permissionHooks];
      for (const hookPath of blockingHookPaths) {
        const hook = allBlockingHooks.find(h => h.command?.includes(hookPath));
        if (hook) {
          expect(hook.async, `Blocking hook ${hookPath} should NOT have async: true`).not.toBe(true);
        }
      }
    });

    it('should NOT use run-hook-silent.mjs or stop-fire-and-forget.mjs', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const silentHooks = allHooks.filter(h => h.command?.includes('run-hook-silent.mjs'));
      expect(silentHooks.length, 'No hooks should use run-hook-silent.mjs (use async: true instead)').toBe(0);

      const stopFafHooks = allHooks.filter(h => h.command?.includes('stop-fire-and-forget.mjs'));
      expect(stopFafHooks.length, 'No hooks should use stop-fire-and-forget.mjs (use async: true instead)').toBe(0);
    });
  });

  describe('PostToolUse Matcher Safety', () => {
    const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];

    it('should NOT use wildcard "*" matcher for any async PostToolUse entry', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];
      for (const group of postToolGroups) {
        const hasAsyncHook = group.hooks.some(h => h.async === true);
        if (hasAsyncHook) {
          expect(group.matcher, 'Async PostToolUse group must not use wildcard matcher').not.toBe('*');
          expect(group.matcher, 'Async PostToolUse group must have an explicit matcher').toBeDefined();
        }
      }
    });

    it('should exclude read-only tools from async PostToolUse matchers', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];
      for (const group of postToolGroups) {
        const hasAsyncHook = group.hooks.some(h => h.async === true);
        if (hasAsyncHook && group.matcher) {
          const matchedTools = group.matcher.split('|');
          for (const readOnlyTool of READ_ONLY_TOOLS) {
            expect(matchedTools, `Async PostToolUse matcher should not include read-only tool: ${readOnlyTool}`).not.toContain(readOnlyTool);
          }
        }
      }
    });

    it('should match the expected tool set for unified-dispatcher', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];
      const dispatcherGroup = postToolGroups.find(g =>
        g.hooks.some(h => h.command?.includes('posttool/unified-dispatcher'))
      );
      expect(dispatcherGroup, 'unified-dispatcher group should exist').toBeDefined();
      expect(dispatcherGroup!.matcher).toBe('Bash|Write|Edit|Task|Skill|NotebookEdit');
    });
  });

  describe('Async Dispatcher Configuration (Issue #653)', () => {
    it('should have all async dispatchers using run-hook.mjs with async: true', () => {
      // Issue #653: Native async: true replaces fire-and-forget spawn pattern.
      // No timeout field needed — CC manages async hook lifecycle natively.
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncDispatchers = [
        'lifecycle/unified-dispatcher',
        'posttool/unified-dispatcher',
        'stop/unified-dispatcher',
        'subagent-stop/unified-dispatcher',
        'notification/unified-dispatcher',
        'setup/unified-dispatcher',
        'prompt/capture-user-intent',
        'notification/sound',
      ];

      for (const hookPath of asyncDispatchers) {
        const hook = allHooks.find(h => h.command?.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} should exist`).toBeDefined();
        expect(hook!.command, `${hookPath} should use run-hook.mjs`).toContain('run-hook.mjs');
        expect(hook!.command, `${hookPath} should NOT use run-hook-silent.mjs`).not.toContain('run-hook-silent.mjs');
        expect(hook!.async, `${hookPath} should have async: true`).toBe(true);
      }
    });
  });
});

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
  command: string;
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
    // Use process.cwd() since tests run from src/hooks directory
    const hooksPath = path.resolve(process.cwd(), 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf-8');
    hooksConfig = JSON.parse(content);
  });

  describe('Silent Hook Configuration (Issue #243)', () => {
    it('should have unified dispatchers using silent runner (not async flag)', () => {
      // Issue #243: Async hooks converted to fire-and-forget using run-hook-silent.mjs
      // This eliminates "Async hook X completed" messages while still running async work
      // in detached background processes.
      const expectedSilentDispatchers = [
        { path: 'lifecycle/unified-dispatcher', event: 'SessionStart' },
        { path: 'posttool/unified-dispatcher', event: 'PostToolUse' },
        { path: 'stop/unified-dispatcher', event: 'Stop' },
        { path: 'subagent-stop/unified-dispatcher', event: 'SubagentStop' },
        { path: 'notification/unified-dispatcher', event: 'Notification' },
        { path: 'setup/unified-dispatcher', event: 'Setup' },
      ];

      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      for (const { path: hookPath, event } of expectedSilentDispatchers) {
        const hook = allHooks.find(h => h.command.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} (${event}) should exist in hooks.json`).toBeDefined();
        expect(hook?.command, `Dispatcher ${hookPath} (${event}) should use run-hook-silent.mjs`).toContain('run-hook-silent.mjs');
        expect(hook?.async, `Dispatcher ${hookPath} (${event}) should NOT have async flag`).toBeUndefined();
      }
    });

    it('should have NO async hooks (all use silent runner)', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      expect(asyncHooks.length, 'All async hooks should be converted to silent pattern').toBe(0);
    });

    it('should NOT have async: true for blocking hooks', () => {
      const blockingHookPaths = [
        // PreToolUse - security critical
        'pretool/bash/dangerous-command-blocker',
        'pretool/bash/git-branch-protection',
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
        const hook = allBlockingHooks.find(h => h.command.includes(hookPath));
        if (hook) {
          expect(hook.async, `Blocking hook ${hookPath} should NOT have async: true`).not.toBe(true);
        }
      }
    });
  });

  describe('Async Hook Count', () => {
    it('should have exactly the expected number of async hooks (one dispatcher per event)', () => {
      let asyncCount = 0;
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          asyncCount += group.hooks.filter(h => h.async === true).length;
        }
      }

      // Issue #243: All async hooks converted to fire-and-forget silent pattern.
      // Now using run-hook-silent.mjs which spawns detached background processes.
      // No "Async hook X completed" messages are printed since hooks are now sync.
      expect(asyncCount).toBe(0);
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
        g.hooks.some(h => h.command.includes('posttool/unified-dispatcher'))
      );
      expect(dispatcherGroup, 'unified-dispatcher group should exist').toBeDefined();
      expect(dispatcherGroup!.matcher).toBe('Bash|Write|Edit|Task|Skill|NotebookEdit');
    });
  });

  describe('Silent Runner Configuration (Issue #243)', () => {
    it('should have NO timeout values (silent runner manages its own lifecycle)', () => {
      // Issue #243: Silent runner hooks don't use timeout field
      // Background processes manage their own lifecycle independently
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      // All dispatchers should use silent runner (no timeout field)
      const silentDispatchers = [
        'lifecycle/unified-dispatcher',
        'posttool/unified-dispatcher',
        'stop/unified-dispatcher',
        'subagent-stop/unified-dispatcher',
        'notification/unified-dispatcher',
        'setup/unified-dispatcher',
      ];

      for (const hookPath of silentDispatchers) {
        const hook = allHooks.find(h => h.command.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} should exist`).toBeDefined();
        expect(hook!.command, `${hookPath} should use run-hook-silent.mjs`).toContain('run-hook-silent.mjs');
        expect(hook!.timeout, `${hookPath} should NOT have timeout (silent runner)`).toBeUndefined();
      }
    });
  });
});

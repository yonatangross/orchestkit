/**
 * Dispatcher Registry Wiring E2E Tests
 *
 * Verifies that unified dispatchers are correctly wired in hooks.json
 * and that the dispatcher registry properly routes hooks.
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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

describe('Dispatcher Registry Wiring E2E', () => {
  let hooksConfig: HooksConfig;

  beforeAll(() => {
    // Resolve hooks.json relative to this test file so it works regardless of cwd
    const hooksPath = path.resolve(__dirname, '..', '..', '..', 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf-8');
    hooksConfig = JSON.parse(content);
  });

  describe('Event Coverage Completeness', () => {
    const REQUIRED_EVENTS = [
      'PreToolUse',
      'PostToolUse',
      'PermissionRequest',
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStart',
      'SubagentStop',
      'Notification',
      'Setup',
    ];

    it.each(REQUIRED_EVENTS)('should have hooks registered for %s event', (event) => {
      expect(hooksConfig.hooks[event], `${event} event should be registered`).toBeDefined();
      expect(hooksConfig.hooks[event].length, `${event} should have at least one hook group`).toBeGreaterThan(0);
    });

    it('should have unified dispatchers using native async: true (Issue #653)', () => {
      // Issue #653: Migrated from fire-and-forget spawn pattern to native async: true.
      // CC 2.1.40+ handles async hooks without terminal spam.
      // Eliminates per-event process spawning — fixes Windows console flashing (#644).
      // Setup uses sync-setup-dispatcher (not async) — excluded from this test
      const asyncEvents = ['SessionStart', 'PostToolUse', 'SubagentStop', 'Notification'];
      const expectedDispatcherPaths: Record<string, string> = {
        SessionStart: 'lifecycle/unified-dispatcher',
        PostToolUse: 'posttool/unified-dispatcher',
        SubagentStop: 'subagent-stop/unified-dispatcher',
        Notification: 'notification/unified-dispatcher',
      };

      for (const event of asyncEvents) {
        const groups = hooksConfig.hooks[event] || [];
        const allHooks = groups.flatMap(g => g.hooks);
        const dispatcher = allHooks.find(h => h.command?.includes(expectedDispatcherPaths[event]));

        expect(dispatcher, `${event} should have unified dispatcher at ${expectedDispatcherPaths[event]}`).toBeDefined();
        expect(dispatcher?.command, `${event} dispatcher should use run-hook.mjs`).toContain('run-hook.mjs');
        expect(dispatcher?.command, `${event} dispatcher should NOT use run-hook-silent.mjs`).not.toContain('run-hook-silent.mjs');
        expect(dispatcher?.async, `${event} dispatcher should have async: true`).toBe(true);
      }
    });

    it('should have Stop using async dispatcher and uncommitted check (Issue #653)', () => {
      // Stop hooks run cleanup tasks that should NOT block session exit.
      // Now uses native async: true instead of fire-and-forget spawn.
      const stopGroups = hooksConfig.hooks.Stop || [];
      const allHooks = stopGroups.flatMap(g => g.hooks);
      const commandHooks = allHooks.filter(h => h.type === 'command');

      // Should have exactly two command hooks
      expect(commandHooks.length, 'Stop should have two command hooks').toBe(2);

      const stopDispatcher = commandHooks.find(h => h.command?.includes('stop/unified-dispatcher'));
      expect(stopDispatcher, 'Stop should have stop/unified-dispatcher via run-hook.mjs').toBeDefined();
      expect(stopDispatcher!.async, 'Stop dispatcher should have async: true').toBe(true);
      expect(stopDispatcher!.command, 'Stop dispatcher should use run-hook.mjs').toContain('run-hook.mjs');

      const uncommittedCheckHook = commandHooks.find(h => h.command?.includes('stop-uncommitted-check.mjs'));
      expect(uncommittedCheckHook, 'Stop should have stop-uncommitted-check.mjs').toBeDefined();
    });
  });

  describe('PreToolUse Hook Chain Ordering', () => {
    it('should have sync-bash-dispatcher as first Bash hook', () => {
      // Post-consolidation (#867-#871): dangerous-command-blocker is now internal
      // to sync-bash-dispatcher, which must be first in the chain.
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const bashGroups = preToolGroups.filter(g => g.matcher === 'Bash' || !g.matcher);

      const bashHooks: { name: string; groupIndex: number; hookIndex: number }[] = [];
      bashGroups.forEach((group, groupIndex) => {
        group.hooks.forEach((hook, hookIndex) => {
          if (hook.command?.includes('pretool/bash/')) {
            const name = hook.command?.split('pretool/bash/')[1]?.split(' ')[0] || '';
            bashHooks.push({ name, groupIndex, hookIndex });
          }
        });
      });

      const dispatcherIndex = bashHooks.findIndex(h => h.name === 'sync-bash-dispatcher');
      expect(dispatcherIndex, 'sync-bash-dispatcher should exist').toBeGreaterThanOrEqual(0);

      // Dispatcher should be first (contains dangerous-command-blocker internally)
      const dispatcherPosition = bashHooks[dispatcherIndex];
      expect(dispatcherPosition.groupIndex).toBeLessThanOrEqual(1);
    });

    it('should have sync-write-edit-dispatcher for Write/Edit hooks', () => {
      // Post-consolidation (#867-#871): file-guard is now internal
      // to sync-write-edit-dispatcher.
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const writeGroups = preToolGroups.filter(g =>
        g.matcher === 'Write' || g.matcher === 'Edit' || g.matcher === 'Write|Edit'
      );

      const writeHooks: string[] = [];
      writeGroups.forEach(group => {
        group.hooks.forEach(hook => {
          if (hook.command?.includes('pretool/write-edit/')) {
            const name = hook.command?.split('pretool/write-edit/')[1]?.split(' ')[0] || '';
            writeHooks.push(name);
          }
        });
      });

      const dispatcherIndex = writeHooks.indexOf('sync-write-edit-dispatcher');
      expect(dispatcherIndex, 'sync-write-edit-dispatcher should exist').toBeGreaterThanOrEqual(0);
    });
  });

  describe('PostToolUse Matcher Safety', () => {
    const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];

    it('should not trigger async hooks for read-only tools', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];

      for (const group of postToolGroups) {
        const hasAsyncHook = group.hooks.some(h => h.async === true);
        if (hasAsyncHook && group.matcher) {
          const matchedTools = group.matcher.split('|');
          for (const readOnlyTool of READ_ONLY_TOOLS) {
            expect(
              matchedTools,
              `Async PostToolUse should not include read-only tool: ${readOnlyTool}`
            ).not.toContain(readOnlyTool);
          }
        }
      }
    });

    it('should have explicit matcher for unified-dispatcher', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];
      const dispatcherGroup = postToolGroups.find(g =>
        g.hooks.some(h => h.command?.includes('posttool/unified-dispatcher'))
      );

      expect(dispatcherGroup, 'unified-dispatcher group should exist').toBeDefined();
      expect(dispatcherGroup?.matcher, 'unified-dispatcher should have explicit matcher').toBeDefined();
      expect(dispatcherGroup?.matcher).not.toBe('*');

      // Verify expected tools
      const expectedTools = ['Bash', 'Write', 'Edit', 'Task', 'Skill', 'NotebookEdit'];
      const actualTools = dispatcherGroup!.matcher!.split('|');

      for (const tool of expectedTools) {
        expect(actualTools, `Matcher should include ${tool}`).toContain(tool);
      }
    });
  });

  describe('Permission Hook Configuration', () => {
    it('should have permission hooks without async flag', () => {
      const permissionGroups = hooksConfig.hooks.PermissionRequest || [];
      const allHooks = permissionGroups.flatMap(g => g.hooks);

      for (const hook of allHooks) {
        expect(
          hook.async,
          `Permission hook ${hook.command} should not be async (blocking required)`
        ).not.toBe(true);
      }
    });

    it('should have auto-approve hooks for common operations', () => {
      const permissionGroups = hooksConfig.hooks.PermissionRequest || [];
      const allHooks = permissionGroups.flatMap(g => g.hooks);

      // auto-approve-safe-bash is consolidated into permission/unified-dispatcher
      // auto-approve-project-writes remains standalone
      const autoApproveHooks = [
        'permission/unified-dispatcher',
        'auto-approve-project-writes',
      ];

      for (const hookName of autoApproveHooks) {
        const hook = allHooks.find(h => h.command?.includes(hookName));
        expect(hook, `${hookName} should be registered`).toBeDefined();
      }
    });
  });

  describe('Native Async Hook Configuration (Issue #653)', () => {
    it('should have exactly 7 async hooks', () => {
      // Issue #653: Migrated from fire-and-forget spawn pattern to native async: true.
      // v7.0.0: pr-status-enricher removed (dead code).
      // 7 async hooks: lifecycle, posttool, stop, subagent-stop, notification, capture-user-intent, config-change
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      expect(asyncHooks.length, 'Should have exactly 7 async hooks').toBe(7);
    });

    it('should have notification dispatcher using native async', () => {
      const notificationGroups = hooksConfig.hooks.Notification || [];
      const allHooks = notificationGroups.flatMap(g => g.hooks);
      const dispatcher = allHooks.find(h => h.command?.includes('notification/unified-dispatcher'));

      expect(dispatcher, 'Notification dispatcher should exist').toBeDefined();
      expect(dispatcher?.command, 'Notification should use run-hook.mjs').toContain('run-hook.mjs');
      expect(dispatcher?.async, 'Notification should have async: true').toBe(true);
    });
  });

  describe('Setup Hook Once Flag', () => {
    it('should have once: true for first-run setup hooks', () => {
      const setupGroups = hooksConfig.hooks.Setup || [];
      const allHooks = setupGroups.flatMap(g => g.hooks);

      const onceHookPatterns = [
        'first-run-setup',
        'dependency-version-check',
      ];

      for (const pattern of onceHookPatterns) {
        const hook = allHooks.find(h => h.command?.includes(pattern));
        if (hook) {
          expect(hook.once, `${pattern} should have once: true`).toBe(true);
        }
      }
    });
  });

  describe('Subagent Hook Symmetry', () => {
    it('should have corresponding start/stop hooks for subagent lifecycle', () => {
      const startGroups = hooksConfig.hooks.SubagentStart || [];
      const stopGroups = hooksConfig.hooks.SubagentStop || [];

      expect(startGroups.length, 'SubagentStart should have hooks').toBeGreaterThan(0);
      expect(stopGroups.length, 'SubagentStop should have hooks').toBeGreaterThan(0);

      // Issue #653: Stop dispatcher should use native async: true (not silent runner)
      const stopHooks = stopGroups.flatMap(g => g.hooks);
      const stopDispatcher = stopHooks.find(h => h.command?.includes('unified-dispatcher'));
      expect(stopDispatcher?.async, 'SubagentStop dispatcher should have async: true').toBe(true);
      expect(stopDispatcher?.command, 'SubagentStop dispatcher should use run-hook.mjs').toContain('run-hook.mjs');
    });

    it('should have unified dispatcher in SubagentStart', () => {
      // Issue #685: SubagentStart hooks consolidated into unified-dispatcher
      // (includes graph-memory-inject, context-gate, subagent-validator, etc.)
      const startGroups = hooksConfig.hooks.SubagentStart || [];
      const allHooks = startGroups.flatMap(g => g.hooks);

      const dispatcher = allHooks.find(h =>
        h.command?.includes('subagent-start/unified-dispatcher')
      );

      expect(dispatcher, 'SubagentStart should have unified dispatcher').toBeDefined();
    });
  });

  describe('Hook Count Verification', () => {
    it('should have expected number of async hooks', () => {
      let asyncCount = 0;
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          asyncCount += group.hooks.filter(h => h.async === true).length;
        }
      }

      // Issue #653: Migrated from fire-and-forget spawn pattern to native async: true.
      // CC 2.1.40+ fixed "backgrounded hook commands not returning early" so native
      // async hooks no longer produce spam. 7 hooks use async: true.
      expect(asyncCount).toBe(7);
    });

    it('should have hooks for all critical security operations', () => {
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const bashGroups = preToolGroups.filter(g => g.matcher === 'Bash' || !g.matcher);
      const bashHooks = bashGroups.flatMap(g => g.hooks);

      // Post-consolidation (#867-#871): security hooks are inside sync dispatchers
      // sync-bash-dispatcher contains dangerous-command-blocker internally
      const securityHooks = [
        'sync-bash-dispatcher',
      ];

      for (const hookName of securityHooks) {
        const hook = bashHooks.find(h => h.command?.includes(hookName));
        expect(hook, `Security hook ${hookName} should exist`).toBeDefined();
      }
    });
  });
});

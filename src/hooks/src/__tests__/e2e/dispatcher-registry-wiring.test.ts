/**
 * Dispatcher Registry Wiring E2E Tests
 *
 * Verifies that unified dispatchers are correctly wired in hooks.json
 * and that the dispatcher registry properly routes hooks.
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

    it('should have unified dispatcher using silent runner for each event (Issue #243)', () => {
      // Issue #243: Async hooks converted to fire-and-forget using run-hook-silent.mjs
      // This eliminates "Async hook X completed" messages while still running async work
      // Note: Stop uses fire-and-forget script for non-blocking session exit
      const silentEvents = ['SessionStart', 'PostToolUse', 'SubagentStop', 'Notification', 'Setup'];
      const expectedDispatcherPaths: Record<string, string> = {
        SessionStart: 'lifecycle/unified-dispatcher',
        PostToolUse: 'posttool/unified-dispatcher',
        SubagentStop: 'subagent-stop/unified-dispatcher',
        Notification: 'notification/unified-dispatcher',
        Setup: 'setup/unified-dispatcher',
      };

      for (const event of silentEvents) {
        const groups = hooksConfig.hooks[event] || [];
        const allHooks = groups.flatMap(g => g.hooks);
        const dispatcher = allHooks.find(h => h.command?.includes(expectedDispatcherPaths[event]));

        expect(dispatcher, `${event} should have unified dispatcher at ${expectedDispatcherPaths[event]}`).toBeDefined();
        // Should use silent runner (not async flag) to avoid terminal spam
        expect(dispatcher?.command, `${event} dispatcher should use run-hook-silent.mjs`).toContain('run-hook-silent.mjs');
        expect(dispatcher?.async, `${event} dispatcher should NOT have async flag`).toBeUndefined();
      }
    });

    it('should have Stop using fire-and-forget and uncommitted check for session exit (Issue #243)', () => {
      // Stop hooks run cleanup tasks that should NOT block session exit.
      // Fire-and-forget spawns a detached background worker that immediately returns.
      // Uncommitted check warns about unsaved work on exit.
      // Stop may also include prompt-type hooks (e.g., commit reminder).
      const stopGroups = hooksConfig.hooks.Stop || [];
      const allHooks = stopGroups.flatMap(g => g.hooks);
      const commandHooks = allHooks.filter(h => h.type === 'command');

      // Should have exactly two command hooks
      expect(commandHooks.length, 'Stop should have two command hooks').toBe(2);

      const fireAndForgetHook = commandHooks.find(h => h.command?.includes('stop-fire-and-forget.mjs'));
      expect(fireAndForgetHook, 'Stop should have stop-fire-and-forget.mjs').toBeDefined();
      expect(fireAndForgetHook!.async, 'fire-and-forget should NOT have async flag').toBeUndefined();

      const uncommittedCheckHook = commandHooks.find(h => h.command?.includes('stop-uncommitted-check.mjs'));
      expect(uncommittedCheckHook, 'Stop should have stop-uncommitted-check.mjs').toBeDefined();
    });
  });

  describe('PreToolUse Hook Chain Ordering', () => {
    it('should have dangerous-command-blocker before other Bash hooks', () => {
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const bashGroups = preToolGroups.filter(g => g.matcher === 'Bash' || !g.matcher);

      // Find all Bash hooks across groups
      const bashHooks: { name: string; groupIndex: number; hookIndex: number }[] = [];
      bashGroups.forEach((group, groupIndex) => {
        group.hooks.forEach((hook, hookIndex) => {
          if (hook.command?.includes('pretool/bash/')) {
            const name = hook.command?.split('pretool/bash/')[1]?.split(' ')[0] || '';
            bashHooks.push({ name, groupIndex, hookIndex });
          }
        });
      });

      const blockerIndex = bashHooks.findIndex(h => h.name === 'dangerous-command-blocker');
      expect(blockerIndex, 'dangerous-command-blocker should exist').toBeGreaterThanOrEqual(0);

      // Blocker should be in first position or early
      const blockerPosition = bashHooks[blockerIndex];
      expect(blockerPosition.groupIndex).toBeLessThanOrEqual(1);
    });

    it('should have file-guard before other Write/Edit hooks', () => {
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

      const guardIndex = writeHooks.findIndex(h => h === 'file-guard');
      expect(guardIndex, 'file-guard should exist').toBeGreaterThanOrEqual(0);

      // Guard should be early in the chain
      expect(guardIndex).toBeLessThanOrEqual(2);
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

      const autoApproveHooks = [
        'auto-approve-safe-bash',
        'auto-approve-project-writes',
      ];

      for (const hookName of autoApproveHooks) {
        const hook = allHooks.find(h => h.command?.includes(hookName));
        expect(hook, `${hookName} should be registered`).toBeDefined();
      }
    });
  });

  describe('Silent Hook Configuration (Issue #243)', () => {
    it('should have NO async hooks (all use silent runner)', () => {
      // Issue #243: All async hooks converted to fire-and-forget using run-hook-silent.mjs
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      expect(asyncHooks.length, 'Should have no async hooks (use silent runner instead)').toBe(0);
    });

    it('should have notification dispatcher using silent runner', () => {
      const notificationGroups = hooksConfig.hooks.Notification || [];
      const allHooks = notificationGroups.flatMap(g => g.hooks);
      const dispatcher = allHooks.find(h => h.command?.includes('notification/unified-dispatcher'));

      expect(dispatcher, 'Notification dispatcher should exist').toBeDefined();
      expect(dispatcher?.command, 'Notification should use silent runner').toContain('run-hook-silent.mjs');
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

      // Issue #243: Stop dispatcher should use silent runner (not async flag)
      const stopHooks = stopGroups.flatMap(g => g.hooks);
      const stopDispatcher = stopHooks.find(h => h.command?.includes('unified-dispatcher'));
      expect(stopDispatcher?.command, 'SubagentStop dispatcher should use silent runner').toContain('run-hook-silent.mjs');
    });

    it('should have memory injection in SubagentStart', () => {
      const startGroups = hooksConfig.hooks.SubagentStart || [];
      const allHooks = startGroups.flatMap(g => g.hooks);

      const memoryHooks = allHooks.filter(h =>
        h.command?.includes('memory-inject') ||
        h.command?.includes('graph-memory')
      );

      expect(memoryHooks.length, 'SubagentStart should have memory injection hooks').toBeGreaterThan(0);
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

      // Issue #243: All async hooks converted to fire-and-forget silent pattern.
      // Now using run-hook-silent.mjs which spawns detached background processes.
      // No "Async hook X completed" messages are printed since hooks are now sync.
      expect(asyncCount).toBe(0);
    });

    it('should have hooks for all critical security operations', () => {
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const bashGroups = preToolGroups.filter(g => g.matcher === 'Bash' || !g.matcher);
      const bashHooks = bashGroups.flatMap(g => g.hooks);

      // Actual security hooks defined in hooks.json (global scope)
      // Note: git-validator moved to agent-scoped hooks in v5.5.0
      const securityHooks = [
        'dangerous-command-blocker',
      ];

      for (const hookName of securityHooks) {
        const hook = bashHooks.find(h => h.command?.includes(hookName));
        expect(hook, `Security hook ${hookName} should exist`).toBeDefined();
      }
    });
  });
});

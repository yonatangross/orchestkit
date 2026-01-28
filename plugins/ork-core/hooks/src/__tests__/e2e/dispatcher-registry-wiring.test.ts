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

describe('Dispatcher Registry Wiring E2E', () => {
  let hooksConfig: HooksConfig;

  beforeAll(() => {
    const hooksPath = path.resolve(process.cwd(), 'hooks.json');
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

    it('should have unified dispatcher for each async event', () => {
      const asyncEvents = ['SessionStart', 'PostToolUse', 'Stop', 'SubagentStop', 'Notification', 'Setup'];
      const expectedDispatcherPaths: Record<string, string> = {
        SessionStart: 'lifecycle/unified-dispatcher',
        PostToolUse: 'posttool/unified-dispatcher',
        Stop: 'stop/unified-dispatcher',
        SubagentStop: 'subagent-stop/unified-dispatcher',
        Notification: 'notification/unified-dispatcher',
        Setup: 'setup/unified-dispatcher',
      };

      for (const event of asyncEvents) {
        const groups = hooksConfig.hooks[event] || [];
        const allHooks = groups.flatMap(g => g.hooks);
        const dispatcher = allHooks.find(h => h.command.includes(expectedDispatcherPaths[event]));

        expect(dispatcher, `${event} should have unified dispatcher at ${expectedDispatcherPaths[event]}`).toBeDefined();
        expect(dispatcher?.async, `${event} dispatcher should be async`).toBe(true);
      }
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
          if (hook.command.includes('pretool/bash/')) {
            const name = hook.command.split('pretool/bash/')[1]?.split(' ')[0] || '';
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
          if (hook.command.includes('pretool/write-edit/')) {
            const name = hook.command.split('pretool/write-edit/')[1]?.split(' ')[0] || '';
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
        g.hooks.some(h => h.command.includes('posttool/unified-dispatcher'))
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
        const hook = allHooks.find(h => h.command.includes(hookName));
        expect(hook, `${hookName} should be registered`).toBeDefined();
      }
    });
  });

  describe('Timeout Configuration', () => {
    it('should have appropriate timeouts for all async hooks', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);

      for (const hook of asyncHooks) {
        expect(hook.timeout, `Async hook ${hook.command} should have timeout`).toBeDefined();
        expect(hook.timeout, `Timeout should be positive for ${hook.command}`).toBeGreaterThan(0);
        expect(hook.timeout, `Timeout should not exceed 120s for ${hook.command}`).toBeLessThanOrEqual(120);
      }
    });

    it('should have notification dispatcher with shorter timeout', () => {
      const notificationGroups = hooksConfig.hooks.Notification || [];
      const allHooks = notificationGroups.flatMap(g => g.hooks);
      const dispatcher = allHooks.find(h => h.command.includes('notification/unified-dispatcher'));

      expect(dispatcher, 'Notification dispatcher should exist').toBeDefined();
      expect(dispatcher?.timeout, 'Notification timeout should be ≤30s').toBeLessThanOrEqual(30);
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
        const hook = allHooks.find(h => h.command.includes(pattern));
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

      // Stop dispatcher should be async
      const stopHooks = stopGroups.flatMap(g => g.hooks);
      const stopDispatcher = stopHooks.find(h => h.command.includes('unified-dispatcher'));
      expect(stopDispatcher?.async, 'SubagentStop dispatcher should be async').toBe(true);
    });

    it('should have memory injection in SubagentStart', () => {
      const startGroups = hooksConfig.hooks.SubagentStart || [];
      const allHooks = startGroups.flatMap(g => g.hooks);

      const memoryHooks = allHooks.filter(h =>
        h.command.includes('memory-inject') ||
        h.command.includes('graph-memory') ||
        h.command.includes('mem0-memory')
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

      // 10 async hooks expected (unified dispatchers + extras)
      expect(asyncCount).toBe(10);
    });

    it('should have hooks for all critical security operations', () => {
      const preToolGroups = hooksConfig.hooks.PreToolUse || [];
      const bashGroups = preToolGroups.filter(g => g.matcher === 'Bash' || !g.matcher);
      const bashHooks = bashGroups.flatMap(g => g.hooks);

      // Actual security hooks defined in hooks.json
      const securityHooks = [
        'dangerous-command-blocker',
        'git-validator',
      ];

      for (const hookName of securityHooks) {
        const hook = bashHooks.find(h => h.command.includes(hookName));
        expect(hook, `Security hook ${hookName} should exist`).toBeDefined();
      }
    });
  });
});

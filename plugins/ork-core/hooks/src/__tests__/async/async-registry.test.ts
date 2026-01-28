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

  describe('Async Hook Configuration', () => {
    it('should have async: true for all unified dispatchers', () => {
      // Post-consolidation (Issue #235): individual async hooks were absorbed
      // into unified dispatchers. Each event's async work is routed through
      // a single dispatcher entry in hooks.json.
      const expectedAsyncDispatchers = [
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

      for (const { path: hookPath, event } of expectedAsyncDispatchers) {
        const hook = allHooks.find(h => h.command.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} (${event}) should exist in hooks.json`).toBeDefined();
        expect(hook?.async, `Dispatcher ${hookPath} (${event}) should have async: true`).toBe(true);
      }
    });

    it('should have timeout configured for all async hooks', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      for (const hook of asyncHooks) {
        expect(hook.timeout, `Async hook should have timeout: ${hook.command}`).toBeDefined();
        expect(hook.timeout, `Timeout should be positive: ${hook.command}`).toBeGreaterThan(0);
      }
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

      // Post-consolidation (Issue #235): unified dispatchers
      // (lifecycle, posttool, stop, subagent-stop, notification, setup, + others)
      // Any change to this count should be deliberate.
      expect(asyncCount).toBe(10);
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

  describe('Timeout Values', () => {
    it('should have appropriate timeout values for all unified dispatchers', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      // All dispatchers and their expected timeouts
      const expectedTimeouts: Record<string, number> = {
        'lifecycle/unified-dispatcher': 60,
        'posttool/unified-dispatcher': 60,
        'stop/unified-dispatcher': 60,
        'subagent-stop/unified-dispatcher': 60,
        'notification/unified-dispatcher': 30, // Shorter: notifications are lightweight
        'setup/unified-dispatcher': 60,
      };

      for (const [hookPath, expectedTimeout] of Object.entries(expectedTimeouts)) {
        const hook = allHooks.find(h => h.command.includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} should exist`).toBeDefined();
        expect(hook!.timeout, `${hookPath} should have ${expectedTimeout}s timeout`).toBe(expectedTimeout);
      }
    });
  });
});

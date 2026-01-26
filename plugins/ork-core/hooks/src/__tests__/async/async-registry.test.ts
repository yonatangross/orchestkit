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
    it('should have async: true for all designated async hooks', () => {
      const expectedAsyncHooks = [
        // SessionStart hooks
        'lifecycle/mem0-context-retrieval',
        'lifecycle/mem0-webhook-setup',
        'lifecycle/mem0-analytics-tracker',
        'lifecycle/pattern-sync-pull',
        'lifecycle/coordination-init',
        'lifecycle/decision-sync-pull',
        'lifecycle/dependency-version-check',
        // PostToolUse analytics hooks
        'posttool/session-metrics',
        'posttool/audit-logger',
        'posttool/calibration-tracker',
        'posttool/write/code-style-learner',
        'posttool/write/naming-convention-learner',
        'posttool/bash/pattern-extractor',
        'posttool/skill/skill-usage-optimizer',
        'posttool/skill-edit-tracker',
        // Network I/O hooks
        'posttool/bash/issue-progress-commenter',
        'posttool/bash/issue-subtask-updater',
        'posttool/mem0-webhook-handler',
        'posttool/memory-bridge',
        'posttool/realtime-sync',
        'posttool/coordination-heartbeat',
        // Stop hooks
        'stop/session-patterns',
        'stop/issue-work-summary',
        'stop/calibration-persist',
        'stop/auto-save-context',
        // SubagentStop hooks
        'subagent-stop/context-publisher',
        'subagent-stop/agent-memory-store',
        'subagent-stop/feedback-loop',
        'subagent-stop/handoff-preparer',
        // Notification hooks
        'notification/desktop',
        'notification/sound',
      ];

      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      for (const hookPath of expectedAsyncHooks) {
        const hook = allHooks.find(h => h.command.includes(hookPath));
        expect(hook, `Hook ${hookPath} should exist`).toBeDefined();
        expect(hook?.async, `Hook ${hookPath} should have async: true`).toBe(true);
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
    it('should have the expected number of async hooks', () => {
      let asyncCount = 0;
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          asyncCount += group.hooks.filter(h => h.async === true).length;
        }
      }

      // We converted 20 + 11 = 31 hooks to async
      expect(asyncCount).toBeGreaterThanOrEqual(31);
    });
  });

  describe('Timeout Values', () => {
    it('should have appropriate timeout values for different hook types', () => {
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      // Notification hooks should have shorter timeout (10s)
      const notificationHooks = allHooks.filter(h =>
        h.command.includes('notification/') && h.async
      );
      for (const hook of notificationHooks) {
        expect(hook.timeout, `Notification hook should have 10s timeout`).toBe(10);
      }

      // Network I/O hooks with GitHub API should have longer timeout
      const issueWorkSummary = allHooks.find(h =>
        h.command.includes('stop/issue-work-summary')
      );
      expect(issueWorkSummary?.timeout, `issue-work-summary should have 60s timeout for network I/O`).toBe(60);
    });
  });
});

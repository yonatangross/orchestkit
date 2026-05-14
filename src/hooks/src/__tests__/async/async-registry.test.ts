/**
 * Async Hooks Registry Tests
 * Tests for verifying async hook configuration in hooks.json
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { commandPath } from '../_helpers/hook-entry.js';

interface Hook {
  type: string;
  command?: string;
  args?: string[];
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
      // After #897 slimming: capture-user-intent, settings-reload, release-notebook-trigger removed
      // v7.30.0: SessionStart dispatcher flattened — 5 individual async hooks (#1264)
      // v7.30.0: Notification dispatcher flattened — 2 individual async hooks (#1264)
      // v7.30.0: SubagentStop dispatcher flattened — 2 individual async hooks (#1264)
      // v7.30.0: TeammateIdle dispatcher flattened — 3 individual async hooks (#1264)
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      const expectedAsyncDispatchers = [
        { path: 'lifecycle/pattern-sync-pull', event: 'SessionStart' },
        { path: 'stop/handoff-writer', event: 'Stop' },
        { path: 'posttool/commit-nudge', event: 'PostToolUse' },
        { path: 'skill/redact-secrets', event: 'PostToolUse' },
        { path: 'posttool/task/team-member-start', event: 'PostToolUse' },
        { path: 'posttool/expect/fingerprint-saver', event: 'PostToolUse' },
      ];

      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      for (const { path: hookPath, event } of expectedAsyncDispatchers) {
        const hook = allHooks.find(h => commandPath(h).includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} (${event}) should exist in hooks.json`).toBeDefined();
        expect(commandPath(hook), `Dispatcher ${hookPath} (${event}) should use run-hook.mjs (not silent)`).toContain('run-hook.mjs');
        expect(commandPath(hook), `Dispatcher ${hookPath} should NOT use run-hook-silent.mjs`).not.toContain('run-hook-silent.mjs');
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
      // 8 -> 5: #897 slimming removed capture-user-intent, settings-reload, release-notebook-trigger
      // 5 -> 6: #978 — wired TeammateIdle dispatcher (async: true)
      // 6 -> 7: #1007 — added usage-summary-reporter (SessionEnd, async)
      // 7 -> 8: #1106 — added StopFailure handler (CC 2.1.78)
      // 8 -> 28: webhook-forwarder consolidated into all 20 standalone events (async: true)
      // 28 -> 29: #1256 — added webhook-forwarder to FileChanged
      // 29 -> 30: #1260 — added telemetry-sync on SessionEnd
      // 30 -> 44: v7.29.0 — decoupled forwarder to standalone async on all matcher groups
      // 44 -> 52: v7.30.0: Stop dispatcher flattened — 9 individual async hooks replace 1 dispatcher (#1264)
      // 52 -> 60: v7.30.0: SessionStart+Notification+TeammateIdle+SubagentStop dispatchers flattened — +8 individual async hooks (#1264)
      // 60 -> 66: v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      // 66 -> 68: v7.30.0: PostToolUse Agent matcher — agent-task-auto-register + webhook-forwarder
      // 68 -> 70: v7.41.1: watchdog (SubagentStop, async) + webhook-forwarder on CronCreate
      // 70 -> 74: v7.51.0 Usage-Driven Hardening — stale-import-detector, edit-history-tracker (posttool Write|Edit), subagent-scope-auditor (SubagentStop), thrash-detector (UserPromptSubmit)
      // 74 -> 75: v7.52.0 completion — metrics-bridge (async on catchall matcher)
      // 75 -> 76: v7.53.0 — posttool/design-import/auto-verify (Claude Design Bet A, #1386)
      // 76 -> 77: v7.62.0 — posttool/bash/gh-rate-limit-tracker (CC 2.1.116 follow-up, #1435)
      // 77 -> 75: M121 #1489 — metrics-dispatcher collapses webhook-forwarder+metrics-bridge on catchall
      //           from 2 async hooks.json entries into 1 sync dispatcher (context-crossing-warn
      //           was already sync; it's now inside the dispatcher too)
      // 75 -> 76: M119 #1476 — nudge-outcome-resolver added on SessionStart (async, 5s)
      // 76 -> 78: M125 Lane B — ui-change-detector (PostToolUse Write|Edit, async)
      //           + expect/snapshot-recorder (PostToolUse Skill, async)
      // 78 -> 79: M130 #1487 — lifecycle/cc-version-check (SessionStart, async)
      // 79 -> 80: ASCII Design System — posttool/ascii-lint (PostToolUse Write|Edit, async)
      // 80 -> 81: M139 #1782 — lifecycle/plugins-drift-snapshot (SessionStart, async).
      //           The companion posttool/check-plugins-drift is intentionally sync
      //           so its outputBlock can gate the next tool call; subagent-start/
      //           agent-view-titler (#1783) is also sync.
      // 81 -> 83: M140 Bundle B (#1790, #1791) — stop/goal-tracker (async) +
      //           lifecycle/goal-budget-guard (SessionEnd, async). The companion
      //           prompt/goal-tracker is SYNC (needs outputBlock + continueOnBlock).
      // 83 -> 84: M119 #1815 — lifecycle/rules-size-check (SessionStart, async)
      // 84 -> 85: M104 PR-A — lifecycle/ask-fallback-injector moved from
      //           UserPromptSubmit (sync) to SessionStart (async, 5s).
      //           Reminder now pins to cached prompt prefix instead of
      //           re-injecting on every turn.
      expect(asyncHooks.length, 'Should have exactly 85 async hooks').toBe(85);
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
        const hook = allBlockingHooks.find(h => commandPath(h).includes(hookPath));
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

      const silentHooks = allHooks.filter(h => commandPath(h).includes('run-hook-silent.mjs'));
      expect(silentHooks.length, 'No hooks should use run-hook-silent.mjs (use async: true instead)').toBe(0);

      const stopFafHooks = allHooks.filter(h => commandPath(h).includes('stop-fire-and-forget.mjs'));
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

    // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
    it('should have flattened PostToolUse matcher groups with correct structure', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];

      // Write|Edit group: auto-lint (sync) + redact-secrets, config-auditor, commit-nudge (async)
      const writeEditGroup = postToolGroups.find(g => g.matcher === 'Write|Edit');
      expect(writeEditGroup, 'Write|Edit group should exist').toBeDefined();
      const writeEditAutoLint = writeEditGroup!.hooks.find(h => commandPath(h).includes('posttool/auto-lint'));
      expect(writeEditAutoLint, 'Write|Edit should have auto-lint').toBeDefined();
      expect(writeEditAutoLint!.async, 'auto-lint should be sync (not async)').not.toBe(true);

      // Bash group: redact-secrets, commit-nudge (async)
      const bashGroup = postToolGroups.find(g => g.matcher === 'Bash');
      expect(bashGroup, 'Bash group should exist').toBeDefined();

      // Agent|TaskUpdate|TaskCreate group: team-member-start (async)
      const agentGroup = postToolGroups.find(g => g.matcher === 'Agent|TaskUpdate|TaskCreate');
      expect(agentGroup, 'Agent|TaskUpdate|TaskCreate group should exist').toBeDefined();

      // Skill group: fingerprint-saver (async)
      const skillGroup = postToolGroups.find(g => g.matcher === 'Skill');
      expect(skillGroup, 'Skill group should exist').toBeDefined();

      // Catch-all group — M121 #1489: now a single dispatcher that fans out
      // webhook-forwarder + metrics-bridge + context-crossing-warn in-process.
      const catchAllGroup = postToolGroups.find(g =>
        g.matcher === 'Bash|Write|Edit|Agent|TaskUpdate|TaskCreate|Skill|NotebookEdit'
      );
      expect(catchAllGroup, 'catch-all dispatcher group should exist').toBeDefined();
      const dispatcher = catchAllGroup!.hooks.find(h =>
        commandPath(h).includes('posttool/metrics-dispatcher'),
      );
      expect(dispatcher, 'catch-all should route to metrics-dispatcher').toBeDefined();
      // Dispatcher is sync — async fan-out happens inside via Promise.allSettled
      expect(dispatcher!.async, 'dispatcher is sync (inner handlers race async)').not.toBe(true);
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

      // v7.30.0: SessionStart, Notification, TeammateIdle, SubagentStop dispatchers flattened (#1264)
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      // Only stop remains as a unified dispatcher
      const asyncDispatchers: string[] = [];

      // Spot-check representative flattened entries
      const flattenedAsyncEntries = [
        'lifecycle/pattern-sync-pull',
        'notification/desktop',
        'subagent-stop/handoff-preparer',
        'teammate-idle/progress-reporter',
        'posttool/commit-nudge',
        'skill/redact-secrets',
        'posttool/task/team-member-start',
        'posttool/expect/fingerprint-saver',
      ];

      for (const hookPath of asyncDispatchers) {
        const hook = allHooks.find(h => commandPath(h).includes(hookPath));
        expect(hook, `Dispatcher ${hookPath} should exist`).toBeDefined();
        expect(commandPath(hook), `${hookPath} should use run-hook.mjs`).toContain('run-hook.mjs');
        expect(commandPath(hook), `${hookPath} should NOT use run-hook-silent.mjs`).not.toContain('run-hook-silent.mjs');
        expect(hook!.async, `${hookPath} should have async: true`).toBe(true);
      }

      for (const hookPath of flattenedAsyncEntries) {
        const hook = allHooks.find(h => commandPath(h).includes(hookPath));
        expect(hook, `Flattened entry ${hookPath} should exist`).toBeDefined();
        expect(hook!.async, `${hookPath} should have async: true`).toBe(true);
      }
    });
  });
});

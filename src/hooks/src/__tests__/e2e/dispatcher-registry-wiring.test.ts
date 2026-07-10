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
      // v7.30.0: SessionStart, Notification, SubagentStop, TeammateIdle dispatchers flattened — individual async hooks (#1264)
      // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      // No unified dispatchers remain for async events — all are flattened

      // Verify PostToolUse has flattened async entries instead of unified dispatcher
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];
      const postToolHooks = postToolGroups.flatMap(g => g.hooks);
      const flattenedPostToolEntries = [
        'posttool/commit-nudge',
        'skill/redact-secrets',
        'posttool/task/team-member-start',
        'posttool/expect/fingerprint-saver',
      ];
      for (const entry of flattenedPostToolEntries) {
        const hook = postToolHooks.find(h => commandPath(h).includes(entry));
        expect(hook, `PostToolUse should have flattened entry ${entry}`).toBeDefined();
        expect(hook?.async, `${entry} should have async: true`).toBe(true);
      }

      // auto-lint should be sync (blocking for formatting)
      const autoLintHook = postToolHooks.find(h => commandPath(h).includes('posttool/auto-lint'));
      expect(autoLintHook, 'PostToolUse should have auto-lint').toBeDefined();
      expect(autoLintHook?.async, 'auto-lint should NOT be async').not.toBe(true);

      // v7.30.0: SessionStart dispatcher flattened — 5 individual async hooks (#1264)
      const sessionStartGroups = hooksConfig.hooks.SessionStart || [];
      const sessionStartHooks = sessionStartGroups.flatMap(g => g.hooks);
      const flattenedSessionStartEntries = [
        'lifecycle/pattern-sync-pull',
        'lifecycle/session-env-setup',
        'lifecycle/stale-team-cleanup',
        'lifecycle/stale-cache-cleanup',
        'lifecycle/type-error-indexer',
      ];
      for (const entry of flattenedSessionStartEntries) {
        const hook = sessionStartHooks.find(h => commandPath(h).includes(entry));
        expect(hook, `SessionStart should have flattened entry ${entry}`).toBeDefined();
        expect(hook?.async, `${entry} should have async: true`).toBe(true);
      }

      // v7.30.0: Notification dispatcher flattened — 2 individual async hooks (#1264)
      const notificationGroups = hooksConfig.hooks.Notification || [];
      const notificationHooks = notificationGroups.flatMap(g => g.hooks);
      const flattenedNotificationEntries = ['notification/desktop', 'notification/sound'];
      for (const entry of flattenedNotificationEntries) {
        const hook = notificationHooks.find(h => commandPath(h).includes(entry));
        expect(hook, `Notification should have flattened entry ${entry}`).toBeDefined();
        expect(hook?.async, `${entry} should have async: true`).toBe(true);
      }

      // v7.30.0: SubagentStop dispatcher flattened — 2 individual async hooks (#1264)
      const subagentStopGroups = hooksConfig.hooks.SubagentStop || [];
      const subagentStopHooks = subagentStopGroups.flatMap(g => g.hooks);
      const flattenedSubagentStopEntries = ['subagent-stop/handoff-preparer', 'subagent-stop/feedback-loop'];
      for (const entry of flattenedSubagentStopEntries) {
        const hook = subagentStopHooks.find(h => commandPath(h).includes(entry));
        expect(hook, `SubagentStop should have flattened entry ${entry}`).toBeDefined();
        expect(hook?.async, `${entry} should have async: true`).toBe(true);
      }
    });

    it('should register subagent-stop/unified-dispatcher on SubagentStop (regression guard for #2653)', () => {
      // The unified-dispatcher is the writer for agent-usage.jsonl (activation
      // telemetry) + subagent-quality.jsonl. It was orphaned — present in source
      // but unregistered in hooks.json — from v7.30.0 until #2653 re-registered
      // it, freezing agent-usage.jsonl for ~78 days while this suite stayed
      // green (the flattened-entries test above did not assert this entry).
      // Asserting the registration directly is the guard that closes that gap.
      const subagentStopGroups = hooksConfig.hooks.SubagentStop || [];
      const subagentStopHooks = subagentStopGroups.flatMap(g => g.hooks);
      const dispatcher = subagentStopHooks.find(h =>
        commandPath(h).includes('subagent-stop/unified-dispatcher'),
      );
      expect(
        dispatcher,
        'SubagentStop MUST register subagent-stop/unified-dispatcher (agent-usage.jsonl writer)',
      ).toBeDefined();
      expect(dispatcher?.async, 'unified-dispatcher should be async: true').toBe(true);
    });

    it('should have Stop using async dispatcher and uncommitted check (Issue #653)', () => {
      // Stop hooks run cleanup tasks that should NOT block session exit.
      // Now uses native async: true instead of fire-and-forget spawn.
      const stopGroups = hooksConfig.hooks.Stop || [];
      const allHooks = stopGroups.flatMap(g => g.hooks);
      const commandHooks = allHooks.filter(h => h.type === 'command');

      // v7.30.0: Stop dispatcher flattened — 9 individual async hooks replace 1 dispatcher (#1264)
      // 11 -> 12: M140 Bundle B (#1790) — added stop/goal-tracker
      // 12 -> 13: M168 Phase 3 (#1913) — added stop/goal-convergence-emitter (events.jsonl emitter)
      // 13 -> 12: #2217 drift cleanup — removed stop/goal-convergence-emitter (CC owns goal-current.json)
      expect(commandHooks.length, 'Stop should have 12 command hooks').toBe(12);

      const uncommittedCheckHook = commandHooks.find(h => commandPath(h).includes('stop-uncommitted-check.mjs'));
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
          if (commandPath(hook).includes('pretool/bash/')) {
            const name = commandPath(hook).split('pretool/bash/')[1]?.split(' ')[0] || '';
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
          if (commandPath(hook).includes('pretool/write-edit/')) {
            const name = commandPath(hook).split('pretool/write-edit/')[1]?.split(' ')[0] || '';
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

    // v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
    it('should have explicit matchers for flattened PostToolUse groups', () => {
      const postToolGroups = hooksConfig.hooks.PostToolUse || [];

      // All PostToolUse groups must have explicit matchers (no wildcard)
      for (const group of postToolGroups) {
        expect(group.matcher, 'PostToolUse group should have explicit matcher').toBeDefined();
        expect(group.matcher).not.toBe('*');
      }

      // Catch-all webhook-forwarder group should cover all expected tools
      const catchAllGroup = postToolGroups.find(g =>
        g.matcher === 'Bash|Write|Edit|Agent|TaskUpdate|TaskCreate|Skill|NotebookEdit'
      );
      expect(catchAllGroup, 'catch-all webhook-forwarder group should exist').toBeDefined();

      const expectedTools = ['Bash', 'Write', 'Edit', 'Agent', 'TaskUpdate', 'TaskCreate', 'Skill', 'NotebookEdit'];
      const actualTools = catchAllGroup!.matcher!.split('|');
      for (const tool of expectedTools) {
        expect(actualTools, `Catch-all matcher should include ${tool}`).toContain(tool);
      }
    });
  });

  describe('Permission Hook Configuration', () => {
    it('should have permission hooks without async flag', () => {
      const permissionGroups = hooksConfig.hooks.PermissionRequest || [];
      const allHooks = permissionGroups.flatMap(g => g.hooks);

      // Permission decision hooks must be sync (blocking). Telemetry forwarders are allowed async.
      for (const hook of allHooks) {
        const isForwarder = commandPath(hook).includes('webhook-forwarder');
        if (!isForwarder) {
          expect(
            hook.async,
            `Permission hook ${hook.command} should not be async (blocking required)`
          ).not.toBe(true);
        }
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
        const hook = allHooks.find(h => commandPath(h).includes(hookName));
        expect(hook, `${hookName} should be registered`).toBeDefined();
      }
    });
  });

  describe('Native Async Hook Configuration (Issue #653)', () => {
    it('should have exactly 5 async hooks', () => {
      // After #897 slimming: 5 async hooks (lifecycle, posttool, stop, subagent-stop, notification)
      const allHooks: Hook[] = [];
      for (const eventGroups of Object.values(hooksConfig.hooks)) {
        for (const group of eventGroups) {
          allHooks.push(...group.hooks);
        }
      }

      const asyncHooks = allHooks.filter(h => h.async === true);
      // 5 -> 6: #978 — wired TeammateIdle dispatcher (async: true)
      // 6 -> 7: #1007 — added usage-summary-reporter (SessionEnd, async)
      // 7 -> 8: #1106 — added StopFailure handler (CC 2.1.78)
      // 8 -> 28: webhook-forwarder consolidated into all 20 standalone events (async: true)
      // 28 -> 29: #1256 — added webhook-forwarder to FileChanged
      // 29 -> 30: #1260 — added telemetry-sync on SessionEnd
      // 30 -> 44: v7.29.0 — webhook-forwarder decoupled from dispatchers to standalone async entries on all matcher groups
      // 44 -> 52: v7.30.0: Stop dispatcher flattened — 9 individual async hooks replace 1 dispatcher (#1264)
      // 52 -> 60: v7.30.0: SessionStart+Notification+TeammateIdle+SubagentStop dispatchers flattened — +8 individual async hooks (#1264)
      // 60 -> 66: v7.30.0: PostToolUse dispatcher flattened — per-matcher async entries + auto-lint sync (#1284)
      // 66 -> 68: v7.30.0: PostToolUse Agent matcher — agent-task-auto-register + webhook-forwarder
      // 68 -> 70: v7.41.1: watchdog (SubagentStop, async) + webhook-forwarder on CronCreate
      // 70 -> 74: v7.51.0 Usage-Driven Hardening — 4 new async hooks in hooks.json
      // 74 -> 75: v7.52.0 completion — metrics-bridge
      // 75 -> 76: v7.53.0 — posttool/design-import/auto-verify (Claude Design Bet A, #1386)
      // 76 -> 77: v7.62.0 — posttool/bash/gh-rate-limit-tracker (CC 2.1.116 follow-up, #1435)
      // 77 -> 75: M121 #1489 — metrics-dispatcher collapses webhook-forwarder+metrics-bridge on catchall
      // 75 -> 76: M119 #1476 — nudge-outcome-resolver on SessionStart
      // 76 -> 78: M125 Lane B — ui-change-detector (PostToolUse Write|Edit, async) +
      //           expect/snapshot-recorder (PostToolUse Skill, async)
      // 78 -> 79: M130 #1487 — lifecycle/cc-version-check (SessionStart, async)
      // 79 -> 80: ASCII Design System — posttool/ascii-lint (PostToolUse Write|Edit, async)
      // 80 -> 81: M139 #1782 — lifecycle/plugins-drift-snapshot (SessionStart, async)
      // 81 -> 83: M140 Bundle B — stop/goal-tracker + lifecycle/goal-budget-guard
      // 83 -> 84: M119 #1815 — lifecycle/rules-size-check (SessionStart, async)
      // 84 -> 85: M104 PR-A — lifecycle/ask-fallback-injector moved from
      //           UserPromptSubmit (sync) to SessionStart (async, 5s)
      // 85 -> 86: M104 PR-B — lifecycle/agentation-context moved from
      //           prompt/unified-dispatcher (UserPromptSubmit) to SessionStart (async, 5s)
      // 86 -> 87: M138 #1826 — lifecycle/cleanup-envelope-corruption (SessionStart, async, 5s)
      // 87 -> 88: M141 #1860 — lifecycle/hook-token-check (SessionStart, async, 5s)
      // 88 -> 89: #1885 — posttool/bash/session-heartbeat-publisher (PostToolUse[Bash], async, 5s)
      // 89 -> 90: #1884 — lifecycle/sweep-stale-worktrees (SessionStart, async, 5s)
      // 90 -> 93: M168 Phase 2 (#1912) — lifecycle/session-registrar (SessionStart, 5s),
      //           lifecycle/session-finalizer (SessionEnd, 5s), posttool/heartbeat (PostToolUse, 3s).
      //           SQLite Layer 1 session registry — replaces broken agent-watchdog (#1830).
      // 93 -> 95: M168 Phase 3 (#1913) — posttool/chain-staleness-checker (PostToolUse, 3s) +
      //           stop/goal-convergence-emitter (Stop, 3s). Layer 3 events.jsonl event-log.
      // 95 -> 96: visual-style lint extension — posttool/code-comment-glyph-warn.
      // 96 -> 100: M168 Phase 4 (#1914) — worktree/enter-registrar (WorktreeCreate, 5s),
      //            worktree/exit-finalizer (WorktreeRemove, 5s),
      //            pretool/settings-override-resolver (PreToolUse, 3s),
      //            + lifecycle/webhook-forwarder on the new PreToolUse group.
      // 100 -> 99: #2217 drift cleanup — removed stop/goal-convergence-emitter (async Stop hook)
      // 99 -> 98: #2335 — worktree/enter-registrar (async) absorbed into the SYNC
      //           worktree/worktree-provisioner (CC's WorktreeCreate contract consumes
      //           the hook's stdout as the provisioned path — provisioning can't be async).
      // 98 -> 99: posttool/write/debt-marker-tracker (PostToolUse Write/Edit, async, 5s).
      // 99 -> 100: re-registered subagent-stop/unified-dispatcher (agent-usage +
      //            subagent-quality analytics writer, orphaned since v7.30.0/#1206).
      // 100 -> 102: #959-regression fix — restored PreToolUse Skill matcher:
      //             pretool/skill/skill-tracker + lifecycle/webhook-forwarder (both async).
      // 102 -> 103: #2590 — lifecycle/telemetry-dark-check (SessionStart, async 5s).
      expect(asyncHooks.length, 'Should have exactly 103 async hooks').toBe(103);
    });

    // v7.30.0: Notification dispatcher flattened — 2 individual async hooks (#1264)
    it('should have flattened notification hooks using native async', () => {
      const notificationGroups = hooksConfig.hooks.Notification || [];
      const allHooks = notificationGroups.flatMap(g => g.hooks);

      const desktopHook = allHooks.find(h => commandPath(h).includes('notification/desktop'));
      expect(desktopHook, 'Notification desktop hook should exist').toBeDefined();
      expect(commandPath(desktopHook ?? {}), 'Notification desktop should use run-hook.mjs').toContain('run-hook.mjs');
      expect(desktopHook?.async, 'Notification desktop should have async: true').toBe(true);

      const soundHook = allHooks.find(h => commandPath(h).includes('notification/sound'));
      expect(soundHook, 'Notification sound hook should exist').toBeDefined();
      expect(soundHook?.async, 'Notification sound should have async: true').toBe(true);
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
        const hook = allHooks.find(h => commandPath(h).includes(pattern));
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

      // v7.30.0: SubagentStop dispatcher flattened — 2 individual async hooks (#1264)
      const stopHooks = stopGroups.flatMap(g => g.hooks);
      const handoffHook = stopHooks.find(h => commandPath(h).includes('subagent-stop/handoff-preparer'));
      expect(handoffHook, 'SubagentStop should have handoff-preparer').toBeDefined();
      expect(handoffHook?.async, 'SubagentStop handoff-preparer should have async: true').toBe(true);
      expect(commandPath(handoffHook ?? {}), 'SubagentStop handoff-preparer should use run-hook.mjs').toContain('run-hook.mjs');
    });

    it('should have unified dispatcher in SubagentStart', () => {
      // Issue #685: SubagentStart hooks consolidated into unified-dispatcher
      // (includes graph-memory-inject, context-gate, subagent-validator, etc.)
      const startGroups = hooksConfig.hooks.SubagentStart || [];
      const allHooks = startGroups.flatMap(g => g.hooks);

      const dispatcher = allHooks.find(h =>
        commandPath(h).includes('subagent-start/unified-dispatcher')
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

      // After #897 slimming: 5 async hooks remain
      // 5 -> 6: #978 — wired TeammateIdle dispatcher
      // 6 -> 7: #1007 — added usage-summary-reporter (SessionEnd, async)
      // 7 -> 8: #1106 — added StopFailure handler (CC 2.1.78)
      // 8 -> 28: webhook-forwarder consolidated into all 20 standalone events (async: true)
      // 28 -> 29: #1256 — added webhook-forwarder to FileChanged
      // 29 -> 30: #1260 — added telemetry-sync on SessionEnd
      // 30 -> 44: v7.29.0 — decoupled forwarder to standalone on all matcher groups
      // 44 -> 52: v7.30.0 — Stop dispatcher flattened: 9 individual async hooks replace 1 dispatcher (#1264)
      // 52 -> 60: v7.30.0 — SessionStart+Notification+TeammateIdle+SubagentStop dispatchers flattened: +8 individual async hooks (#1264)
      // 60 -> 66: v7.30.0 — PostToolUse dispatcher flattened: per-matcher async entries + auto-lint sync (#1284)
      // 66 -> 68: v7.30.0 — PostToolUse Agent matcher: agent-task-auto-register + webhook-forwarder
      // 68 -> 70: v7.41.1 — watchdog (SubagentStop, async) + webhook-forwarder on CronCreate
      // 70 -> 74: v7.51.0 Usage-Driven Hardening — 4 new async hooks
      // 74 -> 75: v7.52.0 completion — metrics-bridge
      // 75 -> 76: v7.53.0 — posttool/design-import/auto-verify (Claude Design Bet A, #1386)
      // 76 -> 77: v7.62.0 — posttool/bash/gh-rate-limit-tracker (CC 2.1.116 follow-up, #1435)
      // 77 -> 75: M121 #1489 — metrics-dispatcher collapses webhook-forwarder+metrics-bridge on catchall
      // 75 -> 76: M119 #1476 — nudge-outcome-resolver on SessionStart
      // 76 -> 78: M125 Lane B — ui-change-detector + expect/snapshot-recorder
      // 78 -> 79: M130 #1487 — lifecycle/cc-version-check (SessionStart, async)
      // 79 -> 80: ASCII Design System — posttool/ascii-lint (PostToolUse Write|Edit, async)
      // 80 -> 81: M139 #1782 — lifecycle/plugins-drift-snapshot (SessionStart, async)
      // 81 -> 83: M140 Bundle B — stop/goal-tracker + lifecycle/goal-budget-guard
      // 83 -> 84: M119 #1815 — lifecycle/rules-size-check (SessionStart, async)
      // 84 -> 85: M104 PR-A — lifecycle/ask-fallback-injector (SessionStart, async)
      // 85 -> 86: M104 PR-B — lifecycle/agentation-context (SessionStart, async)
      // 86 -> 87: M138 #1826 — lifecycle/cleanup-envelope-corruption (SessionStart, async)
      // 87 -> 88: M141 #1860 — lifecycle/hook-token-check (SessionStart, async)
      // 88 -> 89: #1885 — posttool/bash/session-heartbeat-publisher (PostToolUse[Bash], async)
      // 89 -> 90: #1884 — lifecycle/sweep-stale-worktrees (SessionStart, async)
      // 90 -> 93: M168 Phase 2 (#1912) — three new async hooks for SQLite Layer 1
      //           session registry: lifecycle/session-registrar, lifecycle/session-finalizer,
      //           posttool/heartbeat. Replaces broken agent-watchdog (#1830) liveness.
      // 93 -> 95: M168 Phase 3 (#1913) — two new async hooks for Layer 3 events.jsonl
      //           event-log: posttool/chain-staleness-checker + stop/goal-convergence-emitter.
      // 95 -> 96: visual-style lint extension — posttool/code-comment-glyph-warn.
      // 96 -> 100: M168 Phase 4 (#1914) — three new async hooks for Layer 4 worktree
      //            advisory + per-session settings overrides: worktree/enter-registrar,
      //            worktree/exit-finalizer, pretool/settings-override-resolver, plus
      //            lifecycle/webhook-forwarder on the new PreToolUse group.
      // 100 -> 99: #2217 drift cleanup — removed stop/goal-convergence-emitter (async Stop hook)
            // 99 -> 98: #2335 — worktree/enter-registrar (async) absorbed into the SYNC
      //           worktree/worktree-provisioner (CC's WorktreeCreate contract consumes
      //           the hook's stdout as the provisioned path — provisioning can't be async).
      // 98 -> 99: posttool/write/debt-marker-tracker (PostToolUse Write/Edit, async, 5s).
      // 99 -> 100: re-registered subagent-stop/unified-dispatcher (#1206 orphan fix).
      // 100 -> 102: #959-regression fix — restored PreToolUse Skill matcher:
      //             pretool/skill/skill-tracker + lifecycle/webhook-forwarder (both async).
      // 102 -> 103: #2590 — lifecycle/telemetry-dark-check (SessionStart, async 5s).
      expect(asyncCount).toBe(103);
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
        const hook = bashHooks.find(h => commandPath(h).includes(hookName));
        expect(hook, `Security hook ${hookName} should exist`).toBeDefined();
      }
    });
  });
});

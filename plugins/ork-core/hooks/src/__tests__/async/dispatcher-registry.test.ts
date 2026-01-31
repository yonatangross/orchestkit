/**
 * Dispatcher Registry Wiring Tests
 *
 * Validates that each unified dispatcher has the correct hooks registered.
 * Catches accidental hook removals that would silently disable features.
 */

import { describe, it, expect } from 'vitest';

import { registeredHookNames as posttoolHooks, registeredHookMatchers as posttoolMatchers, matchesTool } from '../../posttool/unified-dispatcher.js';
import { registeredHookNames as lifecycleHooks } from '../../lifecycle/unified-dispatcher.js';
import { registeredHookNames as stopHooks } from '../../stop/unified-dispatcher.js';
import { registeredHookNames as subagentStopHooks } from '../../subagent-stop/unified-dispatcher.js';
import { registeredHookNames as notificationHooks } from '../../notification/unified-dispatcher.js';
import { registeredHookNames as setupHooks } from '../../setup/unified-dispatcher.js';

describe('Dispatcher Registry Wiring', () => {
  describe('posttool/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      expect(posttoolHooks()).toEqual([
        'session-metrics',
        'audit-logger',
        'calibration-tracker',
        'pattern-extractor',
        'issue-progress-commenter',
        'issue-subtask-updater',
        'mem0-webhook-handler',
        'code-style-learner',
        'naming-convention-learner',
        'skill-edit-tracker',
        'coordination-heartbeat',
        'skill-usage-optimizer',
        'memory-bridge',
        'realtime-sync',
        'user-tracking',
        // GAP-011: Solution detector for problem-solution pairing
        'solution-detector',
        // Issue #243: Tool preference learner moved here to reduce async hook spam
        'tool-preference-learner',
      ]);
    });

    it('has correct matcher for each hook', () => {
      const matchers = posttoolMatchers();
      const byName = Object.fromEntries(matchers.map(m => [m.name, m.matcher]));

      // Wildcard hooks
      expect(byName['session-metrics']).toBe('*');
      expect(byName['audit-logger']).toBe('*');
      expect(byName['calibration-tracker']).toBe('*');

      // Bash hooks
      expect(byName['pattern-extractor']).toBe('Bash');
      expect(byName['issue-progress-commenter']).toBe('Bash');
      expect(byName['issue-subtask-updater']).toBe('Bash');
      expect(byName['mem0-webhook-handler']).toBe('Bash');

      // Write|Edit hooks
      expect(byName['code-style-learner']).toEqual(['Write', 'Edit']);
      expect(byName['naming-convention-learner']).toEqual(['Write', 'Edit']);
      expect(byName['skill-edit-tracker']).toEqual(['Write', 'Edit']);

      // Task hook
      expect(byName['coordination-heartbeat']).toBe('Task');

      // Skill hook
      expect(byName['skill-usage-optimizer']).toBe('Skill');

      // MCP memory hook
      expect(byName['memory-bridge']).toEqual(['mcp__mem0__add_memory', 'mcp__memory__create_entities']);

      // Multi-tool hook
      expect(byName['realtime-sync']).toEqual(['Bash', 'Write', 'Edit', 'Skill', 'Task']);

      // User tracking (Issue #245)
      expect(byName['user-tracking']).toBe('*');

      // Solution detector (GAP-011)
      expect(byName['solution-detector']).toEqual(['Bash', 'Write', 'Edit', 'Task']);
    });
  });

  describe('lifecycle/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      expect(lifecycleHooks()).toEqual([
        'mem0-context-retrieval',
        'mem0-analytics-tracker',
        'pattern-sync-pull',
        'multi-instance-init',
        'instance-heartbeat',
        'session-env-setup',
        'session-tracking',
      ]);
    });
  });

  describe('stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // Issue #243: All 29 stop hooks consolidated into unified dispatcher
      // Fire-and-forget pattern runs these in background without blocking session exit
      expect(stopHooks()).toEqual([
        // Core session hooks
        'auto-save-context',
        'session-patterns',
        'issue-work-summary',
        'calibration-persist',
        'session-profile-aggregator',
        'session-end-tracking',
        // Memory sync hooks
        'graph-queue-sync',
        'workflow-preference-learner',
        'mem0-queue-sync',
        'mem0-pre-compaction-sync',
        // Instance management hooks
        'multi-instance-cleanup',
        'cleanup-instance',
        'task-completion-check',
        // Analysis hooks
        'context-compressor',
        'auto-remember-continuity',
        'security-scan-aggregator',
        // Skill validation hooks (run at stop time)
        'coverage-check',
        'evidence-collector',
        'coverage-threshold-gate',
        'cross-instance-test-validator',
        'di-pattern-enforcer',
        'duplicate-code-detector',
        'eval-metrics-collector',
        'migration-validator',
        'review-summary-generator',
        'security-summary',
        'test-pattern-validator',
        'test-runner',
        // Heavy analysis hooks (run last)
        'full-test-suite',
      ]);
    });
  });

  describe('subagent-stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      expect(subagentStopHooks()).toEqual([
        'context-publisher',
        'handoff-preparer',
        'feedback-loop',
        'agent-memory-store',
      ]);
    });
  });

  describe('notification/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      expect(notificationHooks()).toEqual([
        'desktop',
        'sound',
      ]);
    });
  });

  describe('setup/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      expect(setupHooks()).toEqual([
        'dependency-version-check',
        'mem0-webhook-setup',
        'coordination-init',
      ]);
    });
  });

  describe('matchesTool (posttool routing logic)', () => {
    it('wildcard matches any tool name', () => {
      expect(matchesTool('Bash', '*')).toBe(true);
      expect(matchesTool('Write', '*')).toBe(true);
      expect(matchesTool('', '*')).toBe(true);
    });

    it('string matcher matches exact tool name', () => {
      expect(matchesTool('Bash', 'Bash')).toBe(true);
      expect(matchesTool('Write', 'Bash')).toBe(false);
    });

    it('string matcher is case-sensitive', () => {
      expect(matchesTool('bash', 'Bash')).toBe(false);
      expect(matchesTool('BASH', 'Bash')).toBe(false);
    });

    it('array matcher matches any element', () => {
      expect(matchesTool('Write', ['Write', 'Edit'])).toBe(true);
      expect(matchesTool('Edit', ['Write', 'Edit'])).toBe(true);
    });

    it('array matcher rejects non-members', () => {
      expect(matchesTool('Bash', ['Write', 'Edit'])).toBe(false);
      expect(matchesTool('', ['Write', 'Edit'])).toBe(false);
    });

    it('empty string tool matches only wildcard', () => {
      expect(matchesTool('', '*')).toBe(true);
      expect(matchesTool('', 'Bash')).toBe(false);
      expect(matchesTool('', ['Write', 'Edit'])).toBe(false);
    });
  });

  describe('Cross-dispatcher consistency', () => {
    it('total consolidated hook count is 62', () => {
      const total =
        posttoolHooks().length +
        lifecycleHooks().length +
        stopHooks().length +
        subagentStopHooks().length +
        notificationHooks().length +
        setupHooks().length;

      // posttool: 17, lifecycle: 7, stop: 29 (Issue #243: all stop hooks consolidated), subagent-stop: 4, notification: 2, setup: 3
      expect(total).toBe(62);
    });
  });
});

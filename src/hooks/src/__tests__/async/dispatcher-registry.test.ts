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
      // After #897 slimming: only 3 hooks remain
      expect(posttoolHooks()).toEqual([
        'redact-secrets',
        'config-change-auditor',
        'team-member-start',
      ]);
    });

    it('has correct matcher for each hook', () => {
      const matchers = posttoolMatchers();
      const byName = Object.fromEntries(matchers.map(m => [m.name, m.matcher]));

      // #909: redact-secrets expanded from Bash-only to include Write|Edit
      expect(byName['redact-secrets']).toEqual(['Bash', 'Write', 'Edit']);
      expect(byName['config-change-auditor']).toEqual(['Write', 'Edit']);
      // #902: Accept both Task and Agent tool names
      expect(byName['team-member-start']).toEqual(['Task', 'Agent']);
    });
  });

  describe('lifecycle/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming: 4 hooks (removed session-tracking, memory-metrics-collector)
      expect(lifecycleHooks()).toEqual([
        'pattern-sync-pull',
        'session-env-setup',
        'stale-team-cleanup',
        'type-error-indexer',
      ]);
    });
  });

  describe('stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming: 7 hooks remain
      expect(stopHooks()).toEqual([
        'handoff-writer',
        'task-completion-check',
        'security-scan-aggregator',
        'coverage-check',
        'evidence-collector',
        'coverage-threshold-gate',
        'cross-instance-test-validator',
      ]);
    });
  });

  describe('subagent-stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming: 2 hooks (removed context-publisher, agent-memory-store)
      expect(subagentStopHooks()).toEqual([
        'handoff-preparer',
        'feedback-loop',
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
    it('total consolidated hook count matches expected', () => {
      const total =
        posttoolHooks().length +
        lifecycleHooks().length +
        stopHooks().length +
        subagentStopHooks().length +
        notificationHooks().length +
        setupHooks().length;

      // posttool: 3, lifecycle: 4, stop: 7, subagent-stop: 2, notification: 2, setup: 1
      // After #897 slimming
      expect(total).toBe(19);
    });
  });
});

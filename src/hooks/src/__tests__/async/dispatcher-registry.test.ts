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
      // After #897 slimming + CC 2.1.71: 4 hooks + #1191 fingerprint-saver + CC 2.1.90 auto-lint: 6 hooks
      expect(posttoolHooks()).toEqual([
        'redact-secrets',
        'config-change-auditor',
        'team-member-start',
        'commit-nudge',
        'fingerprint-saver',
        'auto-lint',
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
      // CC 2.1.71: commit-nudge fires on file-modifying tools
      expect(byName['commit-nudge']).toEqual(['Write', 'Edit', 'MultiEdit', 'Bash']);
      // #1191: fingerprint-saver fires on Skill completion
      expect(byName['fingerprint-saver']).toEqual(['Skill']);
    });
  });

  describe('lifecycle/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming + stale-cache-cleanup: 5 hooks
      expect(lifecycleHooks()).toEqual([
        'pattern-sync-pull',
        'session-env-setup',
        'stale-team-cleanup',
        'stale-cache-cleanup',
        'type-error-indexer',
      ]);
    });
  });

  describe('stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming + session-summary + ledger-cleanup: 9 hooks
      expect(stopHooks()).toEqual([
        'handoff-writer',
        'session-summary',
        'task-completion-check',
        'security-scan-aggregator',
        'ledger-cleanup',
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

      // posttool: 6 (+fingerprint-saver, +auto-lint), lifecycle: 5, stop: 9 (+ledger-cleanup), subagent-stop: 2, notification: 2, setup: 1
      expect(total).toBe(25);
    });
  });
});

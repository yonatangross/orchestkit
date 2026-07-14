/**
 * Dispatcher Registry Wiring Tests
 *
 * Validates that each unified dispatcher has the correct hooks registered.
 * Catches accidental hook removals that would silently disable features.
 *
 * Dead-hook triage (#2561): the legacy posttool/lifecycle/stop/notification
 * unified-dispatchers were deleted (flattened into per-hook async entries in
 * hooks.json), so only the subagent-stop and setup dispatchers remain.
 */

import { describe, it, expect } from 'vitest';

import { registeredHookNames as subagentStopHooks } from '../../subagent-stop/unified-dispatcher.js';
import { registeredHookNames as setupHooks } from '../../setup/unified-dispatcher.js';

describe('Dispatcher Registry Wiring', () => {
  describe('subagent-stop/unified-dispatcher', () => {
    it('contains exactly the expected hooks', () => {
      // After #897 slimming: 2 hooks (removed context-publisher, agent-memory-store)
      expect(subagentStopHooks()).toEqual([
        'handoff-preparer',
        'feedback-loop',
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

  describe('Cross-dispatcher consistency', () => {
    it('total consolidated hook count matches expected', () => {
      const total = subagentStopHooks().length + setupHooks().length;

      // subagent-stop: 2, setup: 1
      expect(total).toBe(3);
    });
  });
});

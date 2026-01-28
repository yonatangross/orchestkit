/**
 * Tests for split bundle entry points
 * Verifies that each event-based bundle exports the correct hooks
 */

import { describe, test, expect } from 'vitest';

// Import all entry points
import * as permissionBundle from '../entries/permission.js';
import * as pretoolBundle from '../entries/pretool.js';
import * as posttoolBundle from '../entries/posttool.js';
import * as promptBundle from '../entries/prompt.js';
import * as lifecycleBundle from '../entries/lifecycle.js';
import * as stopBundle from '../entries/stop.js';
import * as subagentBundle from '../entries/subagent.js';
import * as notificationBundle from '../entries/notification.js';
import * as setupBundle from '../entries/setup.js';
import * as skillBundle from '../entries/skill.js';
import * as agentBundle from '../entries/agent.js';

// =============================================================================
// Entry Point Structure Tests
// =============================================================================

describe('Split Bundle Entry Points', () => {
  describe('permission bundle', () => {
    test('exports hooks registry', () => {
      expect(permissionBundle.hooks).toBeDefined();
      expect(typeof permissionBundle.hooks).toBe('object');
    });

    test('hooks registry contains permission hooks', () => {
      const hookNames = Object.keys(permissionBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('permission/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(permissionBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('pretool bundle', () => {
    test('exports hooks registry', () => {
      expect(pretoolBundle.hooks).toBeDefined();
      expect(typeof pretoolBundle.hooks).toBe('object');
    });

    test('hooks registry contains pretool hooks', () => {
      const hookNames = Object.keys(pretoolBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('pretool/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(pretoolBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('posttool bundle', () => {
    test('exports hooks registry', () => {
      expect(posttoolBundle.hooks).toBeDefined();
      expect(typeof posttoolBundle.hooks).toBe('object');
    });

    test('hooks registry contains posttool hooks', () => {
      const hookNames = Object.keys(posttoolBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('posttool/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(posttoolBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('prompt bundle', () => {
    test('exports hooks registry', () => {
      expect(promptBundle.hooks).toBeDefined();
      expect(typeof promptBundle.hooks).toBe('object');
    });

    test('hooks registry contains prompt hooks', () => {
      const hookNames = Object.keys(promptBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('prompt/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(promptBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('lifecycle bundle', () => {
    test('exports hooks registry', () => {
      expect(lifecycleBundle.hooks).toBeDefined();
      expect(typeof lifecycleBundle.hooks).toBe('object');
    });

    test('hooks registry contains lifecycle hooks', () => {
      const hookNames = Object.keys(lifecycleBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('lifecycle/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(lifecycleBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('stop bundle', () => {
    test('exports hooks registry', () => {
      expect(stopBundle.hooks).toBeDefined();
      expect(typeof stopBundle.hooks).toBe('object');
    });

    test('hooks registry contains stop hooks', () => {
      const hookNames = Object.keys(stopBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('stop/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(stopBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('subagent bundle', () => {
    test('exports hooks registry', () => {
      expect(subagentBundle.hooks).toBeDefined();
      expect(typeof subagentBundle.hooks).toBe('object');
    });

    test('hooks registry contains subagent hooks', () => {
      const hookNames = Object.keys(subagentBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name =>
        name.startsWith('subagent-start/') || name.startsWith('subagent-stop/')
      )).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(subagentBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('notification bundle', () => {
    test('exports hooks registry', () => {
      expect(notificationBundle.hooks).toBeDefined();
      expect(typeof notificationBundle.hooks).toBe('object');
    });

    test('hooks registry contains notification hooks', () => {
      const hookNames = Object.keys(notificationBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('notification/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(notificationBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('setup bundle', () => {
    test('exports hooks registry', () => {
      expect(setupBundle.hooks).toBeDefined();
      expect(typeof setupBundle.hooks).toBe('object');
    });

    test('hooks registry contains setup hooks', () => {
      const hookNames = Object.keys(setupBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('setup/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(setupBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('skill bundle', () => {
    test('exports hooks registry', () => {
      expect(skillBundle.hooks).toBeDefined();
      expect(typeof skillBundle.hooks).toBe('object');
    });

    test('hooks registry contains skill hooks', () => {
      const hookNames = Object.keys(skillBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('skill/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(skillBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });

  describe('agent bundle', () => {
    test('exports hooks registry', () => {
      expect(agentBundle.hooks).toBeDefined();
      expect(typeof agentBundle.hooks).toBe('object');
    });

    test('hooks registry contains agent hooks', () => {
      const hookNames = Object.keys(agentBundle.hooks);
      expect(hookNames.length).toBeGreaterThan(0);
      expect(hookNames.every(name => name.startsWith('agent/'))).toBe(true);
    });

    test('all hooks are functions', () => {
      Object.values(agentBundle.hooks).forEach(hook => {
        expect(typeof hook).toBe('function');
      });
    });
  });
});

// =============================================================================
// Cross-Bundle Consistency Tests
// =============================================================================

describe('Cross-Bundle Consistency', () => {
  test('no hook name collisions across bundles', () => {
    const allHookNames = new Set<string>();
    const bundles = [
      permissionBundle.hooks,
      pretoolBundle.hooks,
      posttoolBundle.hooks,
      promptBundle.hooks,
      lifecycleBundle.hooks,
      stopBundle.hooks,
      subagentBundle.hooks,
      notificationBundle.hooks,
      setupBundle.hooks,
      skillBundle.hooks,
      agentBundle.hooks,
    ];

    bundles.forEach(bundle => {
      Object.keys(bundle).forEach(hookName => {
        expect(allHookNames.has(hookName)).toBe(false);
        allHookNames.add(hookName);
      });
    });
  });

  test('total hook count matches expected', () => {
    const bundles = [
      permissionBundle.hooks,
      pretoolBundle.hooks,
      posttoolBundle.hooks,
      promptBundle.hooks,
      lifecycleBundle.hooks,
      stopBundle.hooks,
      subagentBundle.hooks,
      notificationBundle.hooks,
      setupBundle.hooks,
      skillBundle.hooks,
      agentBundle.hooks,
    ];

    const totalHooks = bundles.reduce((sum, bundle) => sum + Object.keys(bundle).length, 0);

    // Total TypeScript hook implementations across all bundles
    // Update this count when adding/removing hook implementations
    // 152 -> 157: added graph-queue-sync hook
    expect(totalHooks).toBe(160);
  });
});

// =============================================================================
// Hook Execution Tests
// =============================================================================

describe('Hook Execution Smoke Tests', () => {
  const baseInput = {
    tool_name: 'Test',
    session_id: 'test-session',
    tool_input: {},
  };

  test('permission hooks return valid HookResult', async () => {
    const resultOrPromise = permissionBundle.hooks['permission/auto-approve-safe-bash']({
      ...baseInput,
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    });

    const result = await Promise.resolve(resultOrPromise);
    expect(result).toHaveProperty('continue');
    expect(typeof result.continue).toBe('boolean');
  });

  test('pretool hooks return valid HookResult', async () => {
    const resultOrPromise = pretoolBundle.hooks['pretool/bash/git-validator']({
      ...baseInput,
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    });

    const result = await Promise.resolve(resultOrPromise);
    expect(result).toHaveProperty('continue');
    expect(typeof result.continue).toBe('boolean');
  });

  test('lifecycle hooks return valid HookResult', async () => {
    const hookName = Object.keys(lifecycleBundle.hooks)[0];
    const resultOrPromise = lifecycleBundle.hooks[hookName](baseInput);

    const result = await Promise.resolve(resultOrPromise);
    expect(result).toHaveProperty('continue');
    expect(typeof result.continue).toBe('boolean');
  });

  test('stop hooks return valid HookResult', async () => {
    const hookName = Object.keys(stopBundle.hooks)[0];
    const resultOrPromise = stopBundle.hooks[hookName](baseInput);

    const result = await Promise.resolve(resultOrPromise);
    expect(result).toHaveProperty('continue');
    expect(typeof result.continue).toBe('boolean');
  });
});

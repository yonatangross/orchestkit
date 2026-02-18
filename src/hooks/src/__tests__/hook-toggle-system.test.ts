/**
 * Hook Toggle/Override System - Test Suite
 *
 * Tests the hook toggle system used by run-hook.mjs:
 * 1. loadOverrides(projectDir) - reads .claude/hook-overrides.json
 * 2. isHookDisabled(hookName, overrides) - checks disabled array
 * 3. HookOverrides type - schema validation
 * 4. Integration flows - full override lifecycle
 *
 * Since run-hook.mjs is ESM and hard to unit test directly,
 * we mirror its pure functions and test the logic patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs before importing it
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookOverrides, HookInput } from '../types.js';

// =============================================================================
// Replicate the pure functions from run-hook.mjs for testability
// =============================================================================

/**
 * Load hook overrides from .claude/hook-overrides.json
 * Returns null if file doesn't exist or is invalid
 * (mirrors run-hook.mjs loadOverrides)
 */
function loadOverrides(projectDir: string): HookOverrides | null {
  const overridesPath = join(projectDir, '.claude', 'hook-overrides.json');
  if (!existsSync(overridesPath)) return null;
  try {
    return JSON.parse(readFileSync(overridesPath, 'utf-8') as string);
  } catch {
    return null;
  }
}

/**
 * Security-critical hooks that CANNOT be disabled via hook-overrides.json.
 * (mirrors run-hook.mjs SECURITY_HOOKS)
 */
const SECURITY_HOOKS = new Set([
  'pretool/bash/dangerous-command-blocker',
  'pretool/bash/compound-command-validator',
  'pretool/write-edit/file-guard',
  'pretool/Write/security-pattern-validator',
  'skill/redact-secrets',
]);

/**
 * Check if a hook is disabled via overrides.
 * Security-critical hooks in SECURITY_HOOKS cannot be disabled.
 * (mirrors run-hook.mjs isHookDisabled)
 */
function isHookDisabled(name: string, overrides: HookOverrides | null): boolean {
  if (!overrides?.disabled) return false;
  if (!Array.isArray(overrides.disabled) || !overrides.disabled.includes(name)) return false;
  if (SECURITY_HOOKS.has(name)) {
    return false;
  }
  return true;
}

// =============================================================================
// Test Utilities
// =============================================================================

function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

const SILENT_SUCCESS = { continue: true, suppressOutput: true };

// =============================================================================
// loadOverrides
// =============================================================================

describe('loadOverrides', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no overrides file exists', () => {
    // Arrange
    mockExistsSync.mockReturnValue(false);

    // Act
    const result = loadOverrides('/my/project');

    // Assert
    expect(result).toBeNull();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns parsed JSON when file exists and is valid', () => {
    // Arrange
    const overridesContent: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
      timeouts: { 'posttool/unified-dispatcher': 30 },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act
    const result = loadOverrides('/my/project');

    // Assert
    expect(result).toEqual(overridesContent);
    expect(result!.disabled).toHaveLength(2);
    expect(result!.disabled).toContain('prompt/skill-auto-suggest');
    expect(result!.timeouts).toEqual({ 'posttool/unified-dispatcher': 30 });
  });

  it('returns null when file contains invalid JSON', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ not valid json !!!');

    // Act
    const result = loadOverrides('/my/project');

    // Assert
    expect(result).toBeNull();
  });

  it('returns null when file read throws (permission error)', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    // Act
    const result = loadOverrides('/my/project');

    // Assert
    expect(result).toBeNull();
  });

  it('reads from correct path: {projectDir}/.claude/hook-overrides.json', () => {
    // Arrange
    const projectDir = '/home/user/my-project';
    const expectedPath = join(projectDir, '.claude', 'hook-overrides.json');
    mockExistsSync.mockReturnValue(false);

    // Act
    loadOverrides(projectDir);

    // Assert
    expect(mockExistsSync).toHaveBeenCalledWith(expectedPath);
  });

  it('reads file with utf-8 encoding', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"disabled":[]}');

    // Act
    loadOverrides('/proj');

    // Assert
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.any(String),
      'utf-8',
    );
  });

  it('handles empty JSON object gracefully', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');

    // Act
    const result = loadOverrides('/proj');

    // Assert
    expect(result).toEqual({});
  });

  it('handles overrides with only disabled field', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"disabled":["hook/a"]}');

    // Act
    const result = loadOverrides('/proj');

    // Assert
    expect(result).toEqual({ disabled: ['hook/a'] });
    expect(result!.timeouts).toBeUndefined();
  });

  it('handles overrides with only timeouts field', () => {
    // Arrange
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"timeouts":{"hook/a":10}}');

    // Act
    const result = loadOverrides('/proj');

    // Assert
    expect(result).toEqual({ timeouts: { 'hook/a': 10 } });
    expect(result!.disabled).toBeUndefined();
  });
});

// =============================================================================
// isHookDisabled
// =============================================================================

describe('isHookDisabled', () => {
  it('returns false when overrides is null', () => {
    // Act & Assert
    expect(isHookDisabled('prompt/skill-auto-suggest', null)).toBe(false);
  });

  it('returns false when overrides has no disabled field', () => {
    // Arrange
    const overrides: HookOverrides = { timeouts: { 'hook/a': 10 } };

    // Act & Assert
    expect(isHookDisabled('prompt/skill-auto-suggest', overrides)).toBe(false);
  });

  it('returns false when disabled is not an array', () => {
    // Arrange - simulate malformed config where disabled is a non-array value
    const overrides = { disabled: 'not-an-array' } as unknown as HookOverrides;

    // Act & Assert
    expect(isHookDisabled('some/hook', overrides)).toBe(false);
  });

  it('returns false when disabled is a number (wrong type)', () => {
    // Arrange
    const overrides = { disabled: 42 } as unknown as HookOverrides;

    // Act & Assert
    expect(isHookDisabled('some/hook', overrides)).toBe(false);
  });

  it('returns false when disabled is an object (wrong type)', () => {
    // Arrange
    const overrides = { disabled: { key: 'value' } } as unknown as HookOverrides;

    // Act & Assert
    expect(isHookDisabled('some/hook', overrides)).toBe(false);
  });

  it('returns false when hook is not in disabled list', () => {
    // Arrange
    const overrides: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
    };

    // Act & Assert
    expect(isHookDisabled('pretool/bash/dangerous-command-blocker', overrides)).toBe(false);
  });

  it('returns true when hook name matches exactly', () => {
    // Arrange
    const overrides: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
    };

    // Act & Assert
    expect(isHookDisabled('prompt/skill-auto-suggest', overrides)).toBe(true);
    expect(isHookDisabled('prompt/antipattern-warning', overrides)).toBe(true);
  });

  it('returns false for partial name matches', () => {
    // Arrange - "pretool/bash" should NOT match "pretool/bash/dangerous-command-blocker"
    const overrides: HookOverrides = {
      disabled: ['pretool/bash'],
    };

    // Act & Assert
    expect(isHookDisabled('pretool/bash/dangerous-command-blocker', overrides)).toBe(false);
  });

  it('returns false for suffix matches (reverse partial)', () => {
    // Arrange - "dangerous-command-blocker" should NOT match full path
    const overrides: HookOverrides = {
      disabled: ['pretool/bash/dangerous-command-blocker'],
    };

    // Act & Assert
    expect(isHookDisabled('dangerous-command-blocker', overrides)).toBe(false);
  });

  it('handles empty disabled array', () => {
    // Arrange
    const overrides: HookOverrides = { disabled: [] };

    // Act & Assert
    expect(isHookDisabled('any/hook', overrides)).toBe(false);
  });

  it('is case-sensitive for hook names', () => {
    // Arrange
    const overrides: HookOverrides = {
      disabled: ['prompt/Skill-Auto-Suggest'],
    };

    // Act & Assert
    expect(isHookDisabled('prompt/skill-auto-suggest', overrides)).toBe(false);
    expect(isHookDisabled('prompt/Skill-Auto-Suggest', overrides)).toBe(true);
  });

  it('handles disabled with undefined value', () => {
    // Arrange
    const overrides: HookOverrides = { disabled: undefined };

    // Act & Assert
    expect(isHookDisabled('any/hook', overrides)).toBe(false);
  });
});

// =============================================================================
// HookOverrides Type Validation
// =============================================================================

describe('HookOverrides type', () => {
  it('accepts valid overrides with disabled string array', () => {
    // Arrange & Assert (compile-time check + runtime validation)
    const overrides: HookOverrides = {
      disabled: ['hook/a', 'hook/b', 'hook/c'],
    };

    expect(overrides.disabled).toBeInstanceOf(Array);
    expect(overrides.disabled!.every((item) => typeof item === 'string')).toBe(true);
  });

  it('accepts valid overrides with timeouts as Record<string, number>', () => {
    // Arrange
    const overrides: HookOverrides = {
      timeouts: {
        'posttool/unified-dispatcher': 30,
        'prompt/skill-auto-suggest': 5,
      },
    };

    // Assert
    expect(overrides.timeouts).toBeDefined();
    const entries = Object.entries(overrides.timeouts!);
    expect(entries.every(([key, val]) => typeof key === 'string' && typeof val === 'number')).toBe(
      true,
    );
  });

  it('accepts full overrides with both fields', () => {
    // Arrange
    const overrides: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
      timeouts: {
        'posttool/unified-dispatcher': 30,
      },
    };

    // Assert
    expect(overrides.disabled).toHaveLength(2);
    expect(overrides.timeouts!['posttool/unified-dispatcher']).toBe(30);
  });

  it('accepts empty overrides (both fields optional)', () => {
    // Arrange
    const overrides: HookOverrides = {};

    // Assert
    expect(overrides.disabled).toBeUndefined();
    expect(overrides.timeouts).toBeUndefined();
  });
});

// =============================================================================
// Integration-Style Tests
// =============================================================================

describe('Hook Toggle Integration', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Simulate the runHook flow from run-hook.mjs:
   * 1. Load overrides from project dir
   * 2. Check if hook is disabled
   * 3. Return whether hook should execute
   */
  function shouldHookExecute(hookName: string, projectDir: string): boolean {
    const overrides = loadOverrides(projectDir);
    if (isHookDisabled(hookName, overrides)) {
      return false; // Hook skipped (silent success)
    }
    return true; // Hook executes normally
  }

  it('skips execution when overrides file disables the hook', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const hookName = 'prompt/skill-auto-suggest';
    const overridesContent: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act
    const shouldExecute = shouldHookExecute(hookName, projectDir);

    // Assert
    expect(shouldExecute).toBe(false);
  });

  it('executes normally when no overrides file exists', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const hookName = 'pretool/bash/dangerous-command-blocker';
    mockExistsSync.mockReturnValue(false);

    // Act
    const shouldExecute = shouldHookExecute(hookName, projectDir);

    // Assert
    expect(shouldExecute).toBe(true);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('executes normally when overrides exist but do not disable this hook', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const hookName = 'pretool/bash/dangerous-command-blocker';
    const overridesContent: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest'],
      timeouts: { 'posttool/unified-dispatcher': 30 },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act
    const shouldExecute = shouldHookExecute(hookName, projectDir);

    // Assert
    expect(shouldExecute).toBe(true);
  });

  it('skips execution for each hook in the disabled list', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const overridesContent: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning', 'posttool/unified-dispatcher'],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act & Assert - all disabled hooks should be skipped
    expect(shouldHookExecute('prompt/skill-auto-suggest', projectDir)).toBe(false);
    expect(shouldHookExecute('prompt/antipattern-warning', projectDir)).toBe(false);
    expect(shouldHookExecute('posttool/unified-dispatcher', projectDir)).toBe(false);

    // Non-disabled hooks should still execute
    expect(shouldHookExecute('pretool/bash/dangerous-command-blocker', projectDir)).toBe(true);
    expect(shouldHookExecute('permission/auto-approve-safe-bash', projectDir)).toBe(true);
  });

  it('handles corrupted overrides file gracefully (hook still executes)', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const hookName = 'prompt/skill-auto-suggest';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('CORRUPT DATA {{{');

    // Act - corrupted file should not block hook execution
    const shouldExecute = shouldHookExecute(hookName, projectDir);

    // Assert
    expect(shouldExecute).toBe(true);
  });

  it('handles overrides file with empty disabled array (hook still executes)', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const overridesContent: HookOverrides = { disabled: [] };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act
    const shouldExecute = shouldHookExecute('prompt/skill-auto-suggest', projectDir);

    // Assert
    expect(shouldExecute).toBe(true);
  });

  it('reads overrides from correct project directory path', () => {
    // Arrange
    const projectDir = '/workspace/my-app';
    const expectedPath = join(projectDir, '.claude', 'hook-overrides.json');
    mockExistsSync.mockReturnValue(false);

    // Act
    shouldHookExecute('any/hook', projectDir);

    // Assert
    expect(mockExistsSync).toHaveBeenCalledWith(expectedPath);
  });

  it('timeout overrides are preserved in loaded config', () => {
    // Arrange
    const projectDir = '/home/user/project';
    const overridesContent: HookOverrides = {
      disabled: [],
      timeouts: {
        'posttool/unified-dispatcher': 30,
        'prompt/skill-auto-suggest': 5,
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act
    const overrides = loadOverrides(projectDir);

    // Assert
    expect(overrides).not.toBeNull();
    expect(overrides!.timeouts!['posttool/unified-dispatcher']).toBe(30);
    expect(overrides!.timeouts!['prompt/skill-auto-suggest']).toBe(5);
  });
});

// =============================================================================
// SECURITY_HOOKS Allowlist (#686)
// =============================================================================

describe('SECURITY_HOOKS allowlist', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function shouldHookExecute(name: string, projectDir: string): boolean {
    const overrides = loadOverrides(projectDir);
    if (isHookDisabled(name, overrides)) {
      return false;
    }
    return true;
  }

  it('prevents disabling security-critical hooks via overrides', () => {
    // Arrange — all security hooks listed in disabled
    const overridesContent: HookOverrides = {
      disabled: [
        'pretool/bash/dangerous-command-blocker',
        'pretool/bash/compound-command-validator',
        'pretool/write-edit/file-guard',
        'pretool/Write/security-pattern-validator',
        'skill/redact-secrets',
      ],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act & Assert — every security hook must still execute
    for (const hookName of SECURITY_HOOKS) {
      expect(shouldHookExecute(hookName, '/proj')).toBe(true);
    }
  });

  it('still allows disabling non-security hooks', () => {
    // Arrange
    const overridesContent: HookOverrides = {
      disabled: ['prompt/skill-auto-suggest', 'prompt/antipattern-warning'],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Act & Assert
    expect(shouldHookExecute('prompt/skill-auto-suggest', '/proj')).toBe(false);
    expect(shouldHookExecute('prompt/antipattern-warning', '/proj')).toBe(false);
  });

  it('isHookDisabled returns false for every SECURITY_HOOKS member even when in disabled list', () => {
    const overrides: HookOverrides = {
      disabled: [...SECURITY_HOOKS],
    };

    for (const hookName of SECURITY_HOOKS) {
      expect(isHookDisabled(hookName, overrides)).toBe(false);
    }
  });

  it('mixed overrides: security hooks protected, non-security hooks disabled', () => {
    // Arrange — mix of security and non-security hooks
    const overridesContent: HookOverrides = {
      disabled: [
        'pretool/bash/dangerous-command-blocker',
        'prompt/skill-auto-suggest',
        'skill/redact-secrets',
        'posttool/unified-dispatcher',
      ],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(overridesContent));

    // Security hooks still execute
    expect(shouldHookExecute('pretool/bash/dangerous-command-blocker', '/proj')).toBe(true);
    expect(shouldHookExecute('skill/redact-secrets', '/proj')).toBe(true);

    // Non-security hooks are disabled
    expect(shouldHookExecute('prompt/skill-auto-suggest', '/proj')).toBe(false);
    expect(shouldHookExecute('posttool/unified-dispatcher', '/proj')).toBe(false);
  });

  it('SECURITY_HOOKS set contains exactly the expected hooks', () => {
    const expected = [
      'pretool/bash/dangerous-command-blocker',
      'pretool/bash/compound-command-validator',
      'pretool/write-edit/file-guard',
      'pretool/Write/security-pattern-validator',
      'skill/redact-secrets',
    ];
    expect(SECURITY_HOOKS.size).toBe(expected.length);
    for (const name of expected) {
      expect(SECURITY_HOOKS.has(name)).toBe(true);
    }
  });
});

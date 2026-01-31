/**
 * Tests for the runtime input validation system
 *
 * Part 1: TypeScript validator module (src/lib/input-validator.ts)
 *   - validateHookInput: 3-level validation (shape, tool_input, event-specific)
 *   - formatValidationMessage: Human-readable output
 *   - isValidInput: Quick boolean check
 *
 * Part 2: run-hook.mjs inline validateInput mirror
 *   - Ensures parity with the TypeScript module for the subset it covers
 */

import { describe, test, expect } from 'vitest';
import {
  validateHookInput,
  formatValidationMessage,
  isValidInput,
} from '../lib/input-validator.js';
import type { ValidationResult } from '../lib/input-validator.js';

// =============================================================================
// Part 1: TypeScript validator module
// =============================================================================

describe('validateHookInput', () => {
  // ---------------------------------------------------------------------------
  // Level 1 — Input shape validation
  // ---------------------------------------------------------------------------
  describe('Level 1: Input shape', () => {
    test('returns valid:false when input is null', () => {
      const result = validateHookInput(null, 'pretool/bash/test');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('null');
    });

    test('returns valid:false when input is undefined', () => {
      const result = validateHookInput(undefined, 'pretool/bash/test');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('undefined');
    });

    test('returns valid:false when input is a string', () => {
      const result = validateHookInput('hello', 'pretool/bash/test');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('string');
    });

    test('returns valid:false when input is a number', () => {
      const result = validateHookInput(42, 'pretool/bash/test');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('number');
    });

    test('returns valid:false when input is an array', () => {
      const result = validateHookInput([1, 2, 3], 'pretool/bash/test');
      expect(result.valid).toBe(false);
      // Arrays have typeof 'object', so the error message reflects that
      expect(result.errors).toHaveLength(1);
    });

    test('returns valid:true when input is an empty object {}', () => {
      const result = validateHookInput({}, 'lifecycle/session-start');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('returns valid:true when input is a properly structured HookInput', () => {
      const input = {
        tool_name: 'Bash',
        session_id: 'session-123',
        tool_input: { command: 'ls -la' },
      };
      const result = validateHookInput(input, 'pretool/bash/dangerous-command-blocker');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Level 2 — tool_input validation
  // ---------------------------------------------------------------------------
  describe('Level 2: tool_input validation', () => {
    test('returns error when tool_input is a string', () => {
      const result = validateHookInput(
        { tool_name: 'Bash', tool_input: 'invalid' },
        'pretool/bash/test',
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('tool_input');
      expect(result.errors[0]).toContain('string');
    });

    test('returns error when tool_input is a number', () => {
      const result = validateHookInput(
        { tool_name: 'Bash', tool_input: 99 },
        'pretool/bash/test',
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('tool_input');
      expect(result.errors[0]).toContain('number');
    });

    test('returns error when tool_input is an array', () => {
      const result = validateHookInput(
        { tool_name: 'Bash', tool_input: ['a', 'b'] },
        'pretool/bash/test',
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('tool_input');
      expect(result.errors[0]).toContain('array');
    });

    test('returns error when tool_input is null', () => {
      const result = validateHookInput(
        { tool_name: 'Bash', tool_input: null },
        'pretool/bash/test',
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('tool_input');
    });

    test('returns valid when tool_input is an object', () => {
      const result = validateHookInput(
        { tool_name: 'Bash', tool_input: { command: 'echo hi' } },
        'pretool/bash/test',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('returns valid when tool_input is undefined (optional)', () => {
      const result = validateHookInput(
        { tool_name: 'Bash' },
        'lifecycle/session-start',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Level 3 — Event-specific validation (by hook name prefix)
  // ---------------------------------------------------------------------------
  describe('Level 3: Event-specific validation', () => {
    // -- pretool hooks --
    describe('pretool hooks', () => {
      const hookName = 'pretool/bash/dangerous-command-blocker';

      test('warns when tool_name is missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('tool_name'))).toBe(true);
      });

      test('no warning when tool_name is present', () => {
        const result = validateHookInput({ tool_name: 'Bash' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });

      test('no warning when tool_name is empty string (valid edge case)', () => {
        const result = validateHookInput({ tool_name: '' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });
    });

    // -- posttool hooks --
    describe('posttool hooks', () => {
      const hookName = 'posttool/unified-error-handler';

      test('warns when tool_name is missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('tool_name'))).toBe(true);
      });
    });

    // -- permission hooks --
    describe('permission hooks', () => {
      const hookName = 'permission/auto-approve-safe-bash';

      test('warns when tool_name is missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('tool_name'))).toBe(true);
      });
    });

    // -- prompt hooks --
    describe('prompt hooks', () => {
      const hookName = 'prompt/skill-auto-suggest';

      test('warns when prompt field is missing AND tool_input is missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('prompt'))).toBe(true);
      });

      test('no warning when prompt is present', () => {
        const result = validateHookInput({ prompt: 'help me' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });
    });

    // -- subagent hooks --
    describe('subagent hooks', () => {
      const hookName = 'subagent-stop/retry-handler';

      test('warns when subagent_type, agent_type, and tool_input are all missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(
          result.warnings.some((w) => w.includes('subagent_type') || w.includes('agent_type')),
        ).toBe(true);
      });

      test('no warning when subagent_type is present', () => {
        const result = validateHookInput({ subagent_type: 'code-review' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });

      test('no warning when agent_type is present', () => {
        const result = validateHookInput({ agent_type: 'code-review' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });
    });

    // -- notification hooks --
    describe('notification hooks', () => {
      const hookName = 'notification/unified-dispatcher';

      test('warns when message field is missing', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('message'))).toBe(true);
      });

      test('no warning when message is present', () => {
        const result = validateHookInput({ message: 'hello' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });

      test('no warning when message is empty string', () => {
        const result = validateHookInput({ message: '' }, hookName);
        expect(result.warnings).toHaveLength(0);
      });
    });

    // -- stop/setup/lifecycle hooks (lenient) --
    describe('stop/setup/lifecycle hooks (lenient)', () => {
      test.each([
        ['stop/mem0-pre-compaction-sync'],
        ['setup/unified-dispatcher'],
        ['lifecycle/session-context-loader'],
      ])('%s: no warnings with minimal input', (hookName) => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });
    });

    // -- skill hooks --
    describe('skill hooks', () => {
      const hookName = 'skill/redact-secrets';

      test('warns when tool_name is missing (skill hooks are tool-based)', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('tool_name'))).toBe(true);
      });
    });

    // -- agent hooks --
    describe('agent hooks', () => {
      const hookName = 'agent/security-command-audit';

      test('warns when tool_name is missing (agent hooks are tool-based)', () => {
        const result = validateHookInput({}, hookName);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('tool_name'))).toBe(true);
      });
    });

    // -- unknown prefix --
    describe('unknown prefix', () => {
      test('returns valid:true with no errors/warnings for unknown hook prefix', () => {
        const result = validateHookInput({}, 'custom-unknown/my-hook');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
    });
  });
});

// =============================================================================
// formatValidationMessage
// =============================================================================

describe('formatValidationMessage', () => {
  test('returns undefined when valid with no warnings', () => {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    expect(formatValidationMessage(result, 'pretool/test')).toBeUndefined();
  });

  test('returns error string when validation failed', () => {
    const result: ValidationResult = {
      valid: false,
      errors: ['Input must be an object, got null'],
      warnings: [],
    };
    const msg = formatValidationMessage(result, 'pretool/test');
    expect(msg).toBeDefined();
    expect(msg).toContain('failed');
    expect(msg).toContain('Input must be an object');
  });

  test('returns warning string when valid with warnings', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: ['Missing tool_name for tool-based hook'],
    };
    const msg = formatValidationMessage(result, 'pretool/test');
    expect(msg).toBeDefined();
    expect(msg).toContain('warnings');
    expect(msg).toContain('Missing tool_name');
  });

  test('returns combined string when both errors and warnings present', () => {
    const result: ValidationResult = {
      valid: false,
      errors: ['tool_input must be an object, got string'],
      warnings: ['Missing tool_name for tool-based hook'],
    };
    const msg = formatValidationMessage(result, 'pretool/test');
    expect(msg).toBeDefined();
    expect(msg).toContain('failed');
    expect(msg).toContain('warnings');
    expect(msg).toContain('|');
  });

  test('includes hook name in the message', () => {
    const result: ValidationResult = {
      valid: false,
      errors: ['something went wrong'],
      warnings: [],
    };
    const msg = formatValidationMessage(result, 'posttool/unified-error-handler');
    expect(msg).toContain('posttool/unified-error-handler');
  });
});

// =============================================================================
// isValidInput
// =============================================================================

describe('isValidInput', () => {
  test('returns true for plain objects', () => {
    expect(isValidInput({})).toBe(true);
    expect(isValidInput({ tool_name: 'Bash' })).toBe(true);
    expect(isValidInput({ a: 1, b: 'two' })).toBe(true);
  });

  test('returns false for null', () => {
    expect(isValidInput(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isValidInput(undefined)).toBe(false);
  });

  test('returns false for array', () => {
    expect(isValidInput([1, 2, 3])).toBe(false);
  });

  test('returns false for string', () => {
    expect(isValidInput('hello')).toBe(false);
  });

  test('returns false for number', () => {
    expect(isValidInput(42)).toBe(false);
  });
});

// =============================================================================
// Part 2: run-hook.mjs inline validateInput function (mirrored)
// =============================================================================

/**
 * Mirror of the inline validateInput function from run-hook.mjs.
 * This is the Level-1-only shape gate that runs in the ESM entrypoint.
 * Full validation (Levels 2-3) is handled by the TS input-validator module.
 */
function validateInput(
  input: unknown,
  _hookName: string,
): { valid: boolean; errors: string[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: [`Input must be an object, got ${input === null ? 'null' : typeof input}`],
    };
  }
  return { valid: true, errors: [] };
}

describe('run-hook.mjs validateInput (mirrored — Level 1 shape gate only)', () => {
  describe('rejects non-object inputs', () => {
    test.each([
      ['null', null, 'null'],
      ['undefined', undefined, 'undefined'],
      ['string', 'hello', 'string'],
      ['number', 42, 'number'],
      ['array', [1, 2], 'object'],
    ])('rejects %s input', (_label, input, _typeHint) => {
      const result = validateInput(input, 'pretool/test');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('accepts object inputs', () => {
    test('accepts empty object', () => {
      const result = validateInput({}, 'lifecycle/test');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('accepts object with tool_input (no Level 2 check)', () => {
      // JS shape gate deliberately does NOT check tool_input type —
      // that's the TS module's job
      const result = validateInput({ tool_input: 'bad' }, 'pretool/test');
      expect(result.valid).toBe(true);
    });

    test('accepts object without tool_name (no Level 3 check)', () => {
      // JS shape gate deliberately does NOT warn about missing fields —
      // that's the TS module's job
      const result = validateInput({}, 'pretool/test');
      expect(result.valid).toBe(true);
    });
  });

  // -- Cross-module parity: Level 1 agreement --
  describe('Level 1 parity with TypeScript module', () => {
    test('both modules agree on null input rejection', () => {
      const tsResult = validateHookInput(null, 'pretool/test');
      const jsResult = validateInput(null, 'pretool/test');
      expect(jsResult.valid).toBe(tsResult.valid);
      expect(jsResult.errors[0]).toBe(tsResult.errors[0]);
    });

    test('both modules agree on valid object acceptance', () => {
      const input = { tool_name: 'Bash', tool_input: { command: 'ls' } };
      const tsResult = validateHookInput(input, 'pretool/test');
      const jsResult = validateInput(input, 'pretool/test');
      expect(jsResult.valid).toBe(tsResult.valid);
      expect(jsResult.errors).toEqual(tsResult.errors);
    });

    test('JS passes string tool_input but TS rejects it (intentional split)', () => {
      const input = { tool_name: 'Bash', tool_input: 'bad' };
      const tsResult = validateHookInput(input, 'pretool/test');
      const jsResult = validateInput(input, 'pretool/test');
      // JS shape gate passes (it's an object at the top level)
      expect(jsResult.valid).toBe(true);
      // TS full validator rejects (tool_input must be an object)
      expect(tsResult.valid).toBe(false);
    });

    test('JS has no warnings but TS warns on missing tool_name (intentional split)', () => {
      const tsResult = validateHookInput({}, 'pretool/test');
      const jsResult = validateInput({}, 'pretool/test');
      // Both pass (warnings don't block)
      expect(jsResult.valid).toBe(true);
      expect(tsResult.valid).toBe(true);
      // TS produces warnings, JS does not
      expect(tsResult.warnings).toHaveLength(1);
    });
  });
});

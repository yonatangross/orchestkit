/**
 * Unit tests for redact-secrets hook
 * Tests detection of potential secrets in command output
 *
 * WARNING HOOK: Prints warnings to stderr, always returns continue: true
 * CC 2.1.7 Compliant
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
}));

import { redactSecrets } from '../../skill/redact-secrets.js';
import { outputSilentSuccess } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for PostToolUse (Bash output)
 */
function createPostBashInput(
  output: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      command: 'some command',
    },
    tool_result: output,
    ...overrides,
  };
}

// =============================================================================
// Redact Secrets Tests
// =============================================================================

describe('redact-secrets', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - all paths must return continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for clean output', () => {
      // Arrange
      const input = createPostBashInput('Normal output without secrets');

      // Act
      const result = redactSecrets(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true even when secrets detected', () => {
      // Arrange
      const input = createPostBashInput('API key: sk-1234567890abcdefghijklmn');

      // Act
      const result = redactSecrets(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for empty output', () => {
      // Arrange
      const input = createPostBashInput('');

      // Act
      const result = redactSecrets(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('always calls outputSilentSuccess', () => {
      // Arrange
      const input = createPostBashInput('sk-1234567890abcdefghijklmn');

      // Act
      redactSecrets(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // OpenAI API key detection
  // ---------------------------------------------------------------------------

  describe('OpenAI API key detection', () => {
    test.each([
      ['sk-1234567890abcdefghijklmn'], // Standard OpenAI key
      ['sk-abcdefghijABCDEFGHIJ1234567890'], // Mixed case
      ['export OPENAI_API_KEY=sk-1234567890abcdefghijklmn'],
      ['OPENAI_API_KEY="sk-1234567890abcdefghijklmn"'],
      ['  sk-1234567890abcdefghijklmn  '], // Whitespace
      ['Multiple keys sk-aaaaaaaaaaaaaaaaaaaaa and sk-bbbbbbbbbbbbbbbbbbbbb'],
    ])('detects OpenAI key in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key detected')
      );
    });

    test('does not flag short sk- prefix', () => {
      // Arrange
      const input = createPostBashInput('sk-short'); // Too short

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GitHub PAT detection
  // ---------------------------------------------------------------------------

  describe('GitHub PAT detection', () => {
    test.each([
      ['ghp_1234567890abcdefghijklmnopqrstuvwxyz'], // Standard GitHub PAT
      ['ghp_ABCDEFGHIJ1234567890abcdefghijklmnop'], // Mixed case
      ['GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz'],
      ['export GH_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwxyz"'],
    ])('detects GitHub PAT in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key detected')
      );
    });

    test('does not flag incomplete ghp_ prefix', () => {
      // Arrange
      const input = createPostBashInput('ghp_short'); // Too short

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // AWS Access Key detection
  // ---------------------------------------------------------------------------

  describe('AWS Access Key detection', () => {
    test.each([
      ['AKIAIOSFODNN7EXAMPLE'], // Standard AWS Access Key
      ['AKIA1234567890ABCDEF'],
      ['AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'],
      ['export AWS_ACCESS_KEY="AKIAIOSFODNN7EXAMPLE"'],
    ])('detects AWS Access Key in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key detected')
      );
    });

    test('does not flag partial AKIA prefix', () => {
      // Arrange
      const input = createPostBashInput('AKIA1234'); // Too short

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Slack token detection
  // ---------------------------------------------------------------------------

  describe('Slack token detection', () => {
    test.each([
      ['xoxb-1234567890-abcdefghij'], // Bot token
      ['xoxp-9876543210-zyxwvutsrq'], // User token
      ['xoxa-1234567890-refresh'], // App token
      ['xoxr-1234567890-refresh'], // Refresh token
      ['xoxs-1234567890-session'], // Session token
      ['SLACK_TOKEN=xoxb-1234567890-abcdefghij'],
    ])('detects Slack token in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key detected')
      );
    });

    test('does not flag invalid xox prefix', () => {
      // Arrange
      const input = createPostBashInput('xoxz-invalid'); // Invalid prefix

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Generic password detection
  // ---------------------------------------------------------------------------

  describe('password detection', () => {
    test.each([
      ['password: "mysecretpassword"'],
      ['password = "secret123"'],
      ["password: 'test123'"],
      ["PASSWORD = 'admin'"],
      ['Password:"hunter2"'],
      ['db_password: "database123"'],
    ])('detects password pattern in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('hardcoded credential')
      );
    });

    test('does not flag password in documentation', () => {
      // Arrange
      const input = createPostBashInput('The password field should not be empty');

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Generic secret detection
  // ---------------------------------------------------------------------------

  describe('secret detection', () => {
    test.each([
      ['secret: "mysecretvalue"'],
      ['secret = "shh123"'],
      ["secret: 'donttellanyone'"],
      ["SECRET = 'classified'"],
      ['api_secret: "abc123"'],
    ])('detects secret pattern in: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('hardcoded credential')
      );
    });

    test('does not flag SECRET_KEY without space (implementation limitation)', () => {
      // Arrange - The pattern /secret\s*[:=]\s*/ requires space around operators
      // SECRET_KEY="value" doesn't match because there's no space between secret and =
      const input = createPostBashInput('SECRET_KEY="very_secret"');

      // Act
      redactSecrets(input);

      // Assert - Current implementation does not catch this pattern
      // This is a known limitation of the regex pattern
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('does not flag secret in documentation', () => {
      // Arrange
      const input = createPostBashInput('Keep this secret safe');

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple secrets detection
  // ---------------------------------------------------------------------------

  describe('multiple secrets detection', () => {
    test('warns once per pattern type', () => {
      // Arrange - Multiple API keys
      const output = `
        OPENAI_KEY=sk-1234567890abcdefghijklmn
        BACKUP_KEY=sk-zyxwvutsrqponmlkjihgfed
      `;
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert - Only one warning for API keys
      const apiKeyWarnings = stderrSpy.mock.calls.filter(
        (call) => (call[0] as string).includes('API key')
      );
      expect(apiKeyWarnings.length).toBe(1);
    });

    test('warns for different pattern types', () => {
      // Arrange - Both API key and password
      const output = `
        OPENAI_KEY=sk-1234567890abcdefghijklmn
        password: "secret123"
      `;
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert - Warnings for both types
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key')
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('hardcoded credential')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles undefined tool_result', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: { command: 'echo test' },
      };

      // Act & Assert
      expect(() => redactSecrets(input)).not.toThrow();
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('handles output field as fallback', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: { command: 'echo test' },
        output: 'sk-1234567890abcdefghijklmn',
      } as any;

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key')
      );
    });

    test('handles very long output', () => {
      // Arrange
      const longOutput = 'x'.repeat(100000) + 'sk-1234567890abcdefghijklmn';
      const input = createPostBashInput(longOutput);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key')
      );
    });

    test('handles multiline output', () => {
      // Arrange
      const multilineOutput = `
        Line 1
        Line 2
        OPENAI_KEY=sk-1234567890abcdefghijklmn
        Line 4
      `;
      const input = createPostBashInput(multilineOutput);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key')
      );
    });

    test('handles special characters in output', () => {
      // Arrange
      const output = 'password: "pass\nword\twith\rspecial"';
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      // Should detect despite special characters
      expect(stderrSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Warning message format
  // ---------------------------------------------------------------------------

  describe('warning message format', () => {
    test('API key warning uses GitHub Actions annotation', () => {
      // Arrange
      const input = createPostBashInput('sk-1234567890abcdefghijklmn');

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith('::warning::Potential API key detected in output - verify redaction\n');
    });

    test('credential warning uses GitHub Actions annotation', () => {
      // Arrange
      const input = createPostBashInput('password: "secret"');

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalledWith('::warning::Potential hardcoded credential in output\n');
    });
  });

  // ---------------------------------------------------------------------------
  // False positive prevention
  // ---------------------------------------------------------------------------

  describe('false positive prevention', () => {
    test.each([
      ['This is a normal sentence without secrets'],
      ['The user sk-ipped the validation'], // 'sk-' in word
      ['AKIAKI is not a real key'], // AKIA in word
      ['The password field is required'], // Documentation
      ['secret sauce recipe'], // Common phrase
      ['xoxo hugs and kisses'], // Similar to xox but not token
    ])('does not flag clean output: %s', (output) => {
      // Arrange
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('does not flag masked secrets', () => {
      // Arrange
      const output = 'OPENAI_KEY=sk-***REDACTED***';
      const input = createPostBashInput(output);

      // Act
      redactSecrets(input);

      // Assert
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern coverage
  // ---------------------------------------------------------------------------

  describe('pattern coverage', () => {
    test('covers all API key patterns', () => {
      // Test each API key pattern individually
      const patterns = [
        { name: 'OpenAI', example: 'sk-1234567890abcdefghijklmn' },
        { name: 'GitHub', example: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz' },
        { name: 'AWS', example: 'AKIAIOSFODNN7EXAMPLE' },
        { name: 'Slack', example: 'xoxb-1234567890-abcdef' },
      ];

      for (const { name, example } of patterns) {
        // Arrange
        vi.clearAllMocks();
        stderrSpy.mockClear();
        const input = createPostBashInput(example);

        // Act
        redactSecrets(input);

        // Assert
        expect(stderrSpy).toHaveBeenCalled();
      }
    });

    test('covers all secret patterns', () => {
      // Test each secret pattern individually
      const patterns = [
        'password: "test"',
        'password = "test"',
        'secret: "test"',
        'secret = "test"',
      ];

      for (const pattern of patterns) {
        // Arrange
        vi.clearAllMocks();
        stderrSpy.mockClear();
        const input = createPostBashInput(pattern);

        // Act
        redactSecrets(input);

        // Assert
        expect(stderrSpy).toHaveBeenCalled();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Return value consistency
  // ---------------------------------------------------------------------------

  describe('return value consistency', () => {
    test('returns same structure regardless of secrets', () => {
      // Arrange
      const cleanInput = createPostBashInput('clean output');
      const secretInput = createPostBashInput('sk-1234567890abcdefghijklmn');

      // Act
      const cleanResult = redactSecrets(cleanInput);
      const secretResult = redactSecrets(secretInput);

      // Assert
      expect(cleanResult).toEqual(secretResult);
      expect(cleanResult).toEqual({ continue: true, suppressOutput: true });
    });

    test('suppressOutput is always true', () => {
      // Arrange
      const input = createPostBashInput('sk-1234567890abcdefghijklmn');

      // Act
      const result = redactSecrets(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });
  });
});

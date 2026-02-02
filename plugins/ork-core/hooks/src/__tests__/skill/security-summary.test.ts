/**
 * Unit tests for security-summary hook
 * Tests security scan summary generation on skill stop event
 *
 * Focus: Log file creation, security content format, error handling
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getLogDir: vi.fn(() => '/test/logs'),
}));

import { securitySummary } from '../../skill/security-summary.js';
import { outputSilentSuccess, getLogDir } from '../../lib/common.js';
import { appendFileSync, mkdirSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for skill stop event
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Stop',
    session_id: 'test-session-123',
    tool_input: {},
    hook_event: 'Stop',
    ...overrides,
  };
}

// =============================================================================
// Security Summary Tests
// =============================================================================

describe('security-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:45.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - All paths return continue: true
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true on successful execution', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when mkdirSync fails', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true when appendFileSync fails', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns suppressOutput: true for silent operation', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('always calls outputSilentSuccess', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Directory creation
  // ---------------------------------------------------------------------------

  describe('directory creation', () => {
    test('creates log directory with recursive option', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });

    test('uses log directory from getLogDir', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(getLogDir).mockReturnValue('/security/logs');

      // Act
      securitySummary(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith('/security/logs', { recursive: true });
    });

    test('handles EEXIST errors gracefully', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        const err = new Error('EEXIST');
        (err as NodeJS.ErrnoException).code = 'EEXIST';
        throw err;
      });

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(appendFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Log file writing
  // ---------------------------------------------------------------------------

  describe('log file writing', () => {
    test('writes to security-summary.log file in log directory', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const calls = vi.mocked(appendFileSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toContain('security-summary.log');
    });

    test('appends content with trailing newline', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent.endsWith('\n')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Log content - Security focus
  // ---------------------------------------------------------------------------

  describe('log content - security focus', () => {
    test('includes Security Scan Complete header', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Security Scan Complete');
    });

    test('includes formatted timestamp', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('[2024-01-15 10:30:45]');
    });

    test('includes Critical/High vulnerabilities guidance', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Critical/High vulnerabilities');
      expect(writtenContent).toContain('fix immediately');
    });

    test('includes dependency CVE guidance', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Dependency CVEs');
      expect(writtenContent).toContain('update packages');
    });

    test('includes hardcoded secrets guidance', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Hardcoded secrets');
      expect(writtenContent).toContain('env vars');
    });

    test('includes OWASP Top 10 guidance', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('OWASP Top 10');
    });
  });

  // ---------------------------------------------------------------------------
  // Log content - Next steps
  // ---------------------------------------------------------------------------

  describe('log content - next steps', () => {
    test('includes triage step', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Triage findings by severity');
    });

    test('includes issue creation step', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Create issues for critical/high');
    });

    test('includes dependency update step', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Update dependencies with CVEs');
    });

    test('next steps are numbered 1-3', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('1.');
      expect(writtenContent).toContain('2.');
      expect(writtenContent).toContain('3.');
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp formatting
  // ---------------------------------------------------------------------------

  describe('timestamp formatting', () => {
    test.each([
      ['2024-01-01T00:00:00.000Z', '2024-01-01 00:00:00'],
      ['2024-12-31T23:59:59.999Z', '2024-12-31 23:59:59'],
      ['2024-06-15T12:30:45.123Z', '2024-06-15 12:30:45'],
      ['2024-02-29T08:15:30.500Z', '2024-02-29 08:15:30'],
    ])('formats timestamp %s as %s', (isoTime, expected) => {
      // Arrange
      vi.setSystemTime(new Date(isoTime));
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain(`[${expected}]`);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('silently ignores mkdirSync permission errors', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      // Act & Assert
      expect(() => securitySummary(input)).not.toThrow();
    });

    test('silently ignores appendFileSync write errors', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      // Act & Assert
      expect(() => securitySummary(input)).not.toThrow();
    });

    test('silently ignores read-only filesystem errors', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('EROFS: read-only file system');
      });
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('EROFS: read-only file system');
      });

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('attempts write even after mkdir failure', () => {
      // Arrange
      const input = createStopInput();
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('mkdir failed');
      });

      // Act
      securitySummary(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty input object', () => {
      // Arrange
      const input = createStopInput({});

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Stop',
        session_id: 'test',
        tool_input: {},
      };

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles various log directory paths', () => {
      // Arrange
      const paths = [
        '/var/log/security',
        '/tmp/security-logs',
        '/home/user/.claude/security',
        'C:\\Security\\Logs',
        '/opt/orchestkit/logs',
      ];

      for (const path of paths) {
        vi.mocked(getLogDir).mockReturnValue(path);
        vi.clearAllMocks();
        const input = createStopInput();

        // Act
        securitySummary(input);

        // Assert
        expect(appendFileSync).toHaveBeenCalledWith(
          `${path}/security-summary.log`,
          expect.any(String),
        );
      }
    });

    test('handles session_id variations', () => {
      // Arrange
      const sessionIds = ['', 'short', 'very-long-session-id-with-many-parts-123456'];

      for (const sessionId of sessionIds) {
        const input = createStopInput({ session_id: sessionId });

        // Act
        const result = securitySummary(input);

        // Assert
        expect(result.continue).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Hook integration
  // ---------------------------------------------------------------------------

  describe('hook integration', () => {
    test('works with all HookInput fields populated', () => {
      // Arrange
      const input = createStopInput({
        session_id: 'full-session-id',
        project_dir: '/my/security/project',
        hook_event: 'Stop',
        tool_name: 'Stop',
      });

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('result has correct HookResult structure', () => {
      // Arrange
      const input = createStopInput();

      // Act
      const result = securitySummary(input);

      // Assert
      expect(result).toMatchObject({
        continue: true,
        suppressOutput: true,
      });
    });

    test('ignores input entirely (uses _input pattern)', () => {
      // Arrange
      const inputWithData = createStopInput({
        tool_input: { file_path: '/some/file.ts', content: 'malicious content' },
      });

      // Act
      const result = securitySummary(inputWithData);

      // Assert
      expect(result.continue).toBe(true);
      // Content is not affected by input data
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(writtenContent).not.toContain('malicious');
    });
  });

  // ---------------------------------------------------------------------------
  // Content completeness
  // ---------------------------------------------------------------------------

  describe('content completeness', () => {
    test('log content includes all security categories', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;

      // Security categories
      expect(writtenContent).toContain('vulnerabilities');
      expect(writtenContent).toContain('CVEs');
      expect(writtenContent).toContain('secrets');
      expect(writtenContent).toContain('OWASP');
    });

    test('log has proper structure with sections', () => {
      // Arrange
      const input = createStopInput();

      // Act
      securitySummary(input);

      // Assert
      const writtenContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;

      // Has review section
      expect(writtenContent).toContain('Review findings for:');

      // Has next steps section
      expect(writtenContent).toContain('Next steps:');
    });
  });
});

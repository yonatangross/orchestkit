/**
 * Unit tests for migration-validator hook
 * Tests validation of alembic migration files
 *
 * WARNING HOOK: Returns context on validation failures (not blocking)
 * CC 2.1.7 Compliant
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  logHook: vi.fn(),
}));

import { migrationValidator } from '../../skill/migration-validator.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write tool
 */
function createWriteInput(
  filePath: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      file_path: filePath,
    },
    ...overrides,
  };
}

/**
 * Create valid migration content
 */
function createValidMigration(options: {
  revision?: string;
  hasUpgrade?: boolean;
  hasDowngrade?: boolean;
} = {}): string {
  const {
    revision = 'abc123',
    hasUpgrade = true,
    hasDowngrade = true,
  } = options;

  const parts: string[] = [
    '"""Migration description"""',
    '',
    'from alembic import op',
    'import sqlalchemy as sa',
    '',
    `revision = "${revision}"`,
    'down_revision = "def456"',
    '',
  ];

  if (hasUpgrade) {
    parts.push(
      'def upgrade():',
      '    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True))',
      ''
    );
  }

  if (hasDowngrade) {
    parts.push(
      'def downgrade():',
      '    op.drop_table("users")',
      ''
    );
  }

  return parts.join('\n');
}

// =============================================================================
// Migration Validator Tests
// =============================================================================

describe('migration-validator', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(createValidMigration());
    vi.mocked(execSync).mockReturnValue('');
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid migrations', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001_initial.py');

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true even for invalid migrations (warning only)', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001_initial.py');
      vi.mocked(readFileSync).mockReturnValue('# Empty migration');

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for non-migration files', () => {
      // Arrange
      const input = createWriteInput('/test/project/app/models.py');

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // File path filtering
  // ---------------------------------------------------------------------------

  describe('file path filtering', () => {
    test.each([
      ['/test/project/alembic/versions/001_initial.py', true],
      ['/test/project/backend/alembic/versions/002_add_users.py', true],
      ['/app/alembic/versions/v1.py', true],
      ['/test/project/app/models.py', false],
      ['/test/project/alembic/env.py', false],
      ['/test/project/versions/file.py', false],
      ['/test/project/alembic/versions/README.md', false],
      ['', false],
    ])('file path %s should trigger validation: %s', (filePath, shouldTrigger) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      migrationValidator(input);

      // Assert
      if (shouldTrigger && filePath) {
        expect(stderrSpy).toHaveBeenCalled();
      } else {
        expect(outputSilentSuccess).toHaveBeenCalled();
      }
    });

    test('returns silent success for empty file_path', () => {
      // Arrange
      const input = createWriteInput('');

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('uses CC_TOOL_FILE_PATH env var as fallback', () => {
      // Arrange
      const originalEnv = process.env.CC_TOOL_FILE_PATH;
      process.env.CC_TOOL_FILE_PATH = '/test/project/alembic/versions/migration.py';
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {},
      };

      // Act
      migrationValidator(input);

      // Assert
      expect(stderrSpy).toHaveBeenCalled();

      // Cleanup
      process.env.CC_TOOL_FILE_PATH = originalEnv;
    });
  });

  // ---------------------------------------------------------------------------
  // File existence check
  // ---------------------------------------------------------------------------

  describe('file existence check', () => {
    test('returns silent success when file does not exist', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Upgrade function validation
  // ---------------------------------------------------------------------------

  describe('upgrade function validation', () => {
    test('passes when upgrade function exists', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue(createValidMigration());

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('Missing upgrade');
    });

    test('fails when upgrade function is missing', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue(createValidMigration({ hasUpgrade: false }));

      // Act
      migrationValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('validation failed')
      );
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Missing upgrade()');
    });
  });

  // ---------------------------------------------------------------------------
  // Downgrade function validation
  // ---------------------------------------------------------------------------

  describe('downgrade function validation', () => {
    test('passes when downgrade function exists', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue(createValidMigration());

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('Missing downgrade');
    });

    test('fails when downgrade function is missing', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue(createValidMigration({ hasDowngrade: false }));

      // Act
      migrationValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Missing downgrade()');
    });
  });

  // ---------------------------------------------------------------------------
  // Revision ID validation
  // ---------------------------------------------------------------------------

  describe('revision ID validation', () => {
    test('passes when revision ID exists', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue(createValidMigration());

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('Missing revision');
    });

    test('fails when revision ID is missing', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      const contentWithoutRevision = `
def upgrade():
    pass

def downgrade():
    pass
`;
      vi.mocked(readFileSync).mockReturnValue(contentWithoutRevision);

      // Act
      migrationValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Missing revision ID');
    });

    test.each([
      ['revision = "abc123"', true],
      ['revision = \'abc123\'', true],
      ["revision = 'abc123'", true],
    ])('recognizes revision format: %s', (revisionLine, isValid) => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      const content = `
${revisionLine}
def upgrade():
    pass
def downgrade():
    pass
`;
      vi.mocked(readFileSync).mockReturnValue(content);

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      if (isValid) {
        expect(stderrOutput).not.toContain('Missing revision');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Python syntax validation
  // ---------------------------------------------------------------------------

  describe('Python syntax validation', () => {
    test('passes when Python syntax is valid', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(execSync).mockReturnValue(''); // No error

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('python3 -m py_compile'),
        expect.any(Object)
      );
    });

    test('fails when Python syntax is invalid', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('SyntaxError: invalid syntax');
      });

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Python syntax error');
    });

    test('includes file path in py_compile command', () => {
      // Arrange
      const filePath = '/test/project/alembic/versions/001_initial.py';
      const input = createWriteInput(filePath);

      // Act
      migrationValidator(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        `python3 -m py_compile "${filePath}"`,
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple validation errors
  // ---------------------------------------------------------------------------

  describe('multiple validation errors', () => {
    test('reports all validation errors', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue('# Empty file');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('SyntaxError');
      });

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Missing upgrade()');
      expect(stderrOutput).toContain('Missing downgrade()');
      expect(stderrOutput).toContain('Missing revision ID');
      expect(stderrOutput).toContain('Python syntax error');
    });

    test('first error is logged', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue('# Empty file');

      // Act
      migrationValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'migration-validator',
        expect.stringContaining('BLOCKED')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Output formatting
  // ---------------------------------------------------------------------------

  describe('output formatting', () => {
    test('uses GitHub Actions group syntax', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001_init.py');

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('::group::');
      expect(stderrOutput).toContain('::endgroup::');
    });

    test('includes filename in group header', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001_add_users.py');

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('001_add_users.py');
    });

    test('uses ::error:: annotation for failures', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue('# Empty');

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('::error::');
    });

    test('shows success message for valid migration', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Migration file is valid');
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('returns context when readFileSync fails', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('validation failed')
      );
    });

    test('handles empty file content', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue('');

      // Act
      const result = migrationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('Missing upgrade');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles migration with async functions (detected as valid)', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      const asyncContent = `
revision = "abc123"
async def upgrade():
    pass
async def downgrade():
    pass
`;
      vi.mocked(readFileSync).mockReturnValue(asyncContent);

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      // The pattern 'def upgrade' is found in 'async def upgrade' so it's valid
      expect(stderrOutput).toContain('Migration file is valid');
    });

    test('handles indented function definitions', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      const indentedContent = `
revision = "abc123"

    def upgrade():
        pass

    def downgrade():
        pass
`;
      vi.mocked(readFileSync).mockReturnValue(indentedContent);

      // Act
      migrationValidator(input);

      // Assert
      // Should still find the functions even with weird indentation
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('Missing upgrade');
    });

    test('handles revision with single quotes', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      const content = `
revision = 'abc123'
def upgrade():
    pass
def downgrade():
    pass
`;
      vi.mocked(readFileSync).mockReturnValue(content);

      // Act
      migrationValidator(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('Missing revision');
    });

    test('py_compile has 10 second timeout', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');

      // Act
      migrationValidator(input);

      // Assert
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 10000 })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Context output
  // ---------------------------------------------------------------------------

  describe('context output', () => {
    test('includes file path in context message', () => {
      // Arrange
      const filePath = '/test/project/alembic/versions/001_add_users.py';
      const input = createWriteInput(filePath);
      vi.mocked(readFileSync).mockReturnValue('# Invalid');

      // Act
      migrationValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining(filePath)
      );
    });

    test('mentions stderr for details', () => {
      // Arrange
      const input = createWriteInput('/test/project/alembic/versions/001.py');
      vi.mocked(readFileSync).mockReturnValue('# Invalid');

      // Act
      migrationValidator(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('stderr')
      );
    });
  });
});

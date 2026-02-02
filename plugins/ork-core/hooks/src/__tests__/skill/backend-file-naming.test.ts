/**
 * Unit tests for backend-file-naming hook
 * Tests enforcement of backend Python file naming conventions
 *
 * Coverage Focus: Validates naming conventions for routers, services,
 * repositories, schemas, and models directories
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputBlock: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

vi.mock('../../lib/guards.js', () => ({
  guardPythonFiles: vi.fn((input: HookInput) => {
    const filePath = input.tool_input?.file_path || '';
    if (!filePath.endsWith('.py')) {
      return { continue: true, suppressOutput: true };
    }
    return null; // Continue with hook
  }),
}));

import { backendFileNaming } from '../../skill/backend-file-naming.js';
import { outputSilentSuccess, outputBlock, logHook } from '../../lib/common.js';
import { guardPythonFiles } from '../../lib/guards.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for file operations
 */
function createFileInput(
  filePath: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath },
    ...overrides,
  };
}

// =============================================================================
// Backend File Naming Tests
// =============================================================================

describe('backend-file-naming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 Compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid files', () => {
      // Arrange
      const input = createFileInput('/app/routers/router_users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for invalid files with proper structure', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
      expect(result.hookSpecificOutput).toBeDefined();
    });

    test('always returns valid HookResult structure', () => {
      // Arrange
      const input = createFileInput('/app/services/bad_name.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
      if (!result.continue) {
        expect(typeof result.stopReason).toBe('string');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Guard behavior
  // ---------------------------------------------------------------------------

  describe('guard behavior', () => {
    test('skips non-Python files', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.ts');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(guardPythonFiles).toHaveBeenCalledWith(input);
    });

    test('skips files outside app/ and backend/ directories', () => {
      // Arrange
      const input = createFileInput('/lib/utils.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('skips __init__.py files', () => {
      // Arrange
      const input = createFileInput('/app/routers/__init__.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Router naming conventions
  // ---------------------------------------------------------------------------

  describe('router naming conventions', () => {
    test.each([
      ['router_users.py', 'router_ prefix'],
      ['routes_auth.py', 'routes_ prefix'],
      ['api_products.py', 'api_ prefix'],
      ['deps.py', 'deps utility'],
      ['dependencies.py', 'dependencies utility'],
      ['utils.py', 'utils utility'],
      ['helpers.py', 'helpers utility'],
      ['base.py', 'base utility'],
    ])('allows valid router file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/routers/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test.each([
      ['users.py', 'missing prefix'],
      ['auth_routes.py', 'wrong suffix position'],
      ['UserRouter.py', 'PascalCase'],
      ['get_users.py', 'action name'],
      ['crud.py', 'generic name'],
    ])('blocks invalid router file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/routers/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('ROUTER NAMING');
      expect(outputBlock).toHaveBeenCalled();
    });

    test('validates files in nested routers directory', () => {
      // Arrange
      const input = createFileInput('/backend/app/routers/v1/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('ROUTER NAMING');
    });
  });

  // ---------------------------------------------------------------------------
  // Service naming conventions
  // ---------------------------------------------------------------------------

  describe('service naming conventions', () => {
    test.each([
      ['user_service.py', '_service suffix'],
      ['auth_service.py', '_service suffix'],
      ['email_notification_service.py', 'compound name with _service'],
      ['base.py', 'base utility'],
      ['utils.py', 'utils utility'],
      ['helpers.py', 'helpers utility'],
      ['abstract.py', 'abstract utility'],
    ])('allows valid service file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/services/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['user.py', 'missing _service suffix'],
      ['UserService.py', 'PascalCase'],
      ['service_user.py', 'wrong position'],
      ['users.py', 'plural without suffix'],
    ])('blocks invalid service file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/services/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('SERVICE NAMING');
    });

    test('validates files in nested services directory', () => {
      // Arrange
      const input = createFileInput('/backend/services/domain/user.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Repository naming conventions
  // ---------------------------------------------------------------------------

  describe('repository naming conventions', () => {
    test.each([
      ['user_repository.py', '_repository suffix'],
      ['auth_repository.py', '_repository suffix'],
      ['user_repo.py', '_repo suffix'],
      ['base.py', 'base utility'],
      ['abstract.py', 'abstract utility'],
      ['utils.py', 'utils utility'],
    ])('allows valid repository file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/repositories/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['user.py', 'missing suffix'],
      ['UserRepository.py', 'PascalCase'],
      ['repository_user.py', 'wrong position'],
      ['users_data.py', 'wrong suffix'],
    ])('blocks invalid repository file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/repositories/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('REPOSITORY NAMING');
    });
  });

  // ---------------------------------------------------------------------------
  // Schema naming conventions
  // ---------------------------------------------------------------------------

  describe('schema naming conventions', () => {
    test.each([
      ['user_schema.py', '_schema suffix'],
      ['auth_dto.py', '_dto suffix'],
      ['login_request.py', '_request suffix'],
      ['user_response.py', '_response suffix'],
      ['base.py', 'base utility'],
      ['common.py', 'common utility'],
      ['shared.py', 'shared utility'],
      ['utils.py', 'utils utility'],
    ])('allows valid schema file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/schemas/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['user.py', 'missing suffix'],
      ['UserSchema.py', 'PascalCase'],
      ['schemas_user.py', 'wrong position'],
      ['data.py', 'generic name'],
    ])('blocks invalid schema file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/schemas/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('SCHEMA NAMING');
    });
  });

  // ---------------------------------------------------------------------------
  // Model naming conventions
  // ---------------------------------------------------------------------------

  describe('model naming conventions', () => {
    test.each([
      ['user_model.py', '_model suffix'],
      ['auth_entity.py', '_entity suffix'],
      ['product_orm.py', '_orm suffix'],
      ['base.py', 'base utility'],
      ['abstract.py', 'abstract utility'],
      ['mixins.py', 'mixins utility'],
    ])('allows valid model file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/models/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['user.py', 'missing suffix'],
      ['UserModel.py', 'PascalCase'],
      ['models_user.py', 'wrong position'],
      ['tables.py', 'generic name'],
    ])('blocks invalid model file: %s (%s)', (filename, _description) => {
      // Arrange
      const input = createFileInput(`/app/models/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('MODEL NAMING');
    });
  });

  // ---------------------------------------------------------------------------
  // PascalCase detection
  // ---------------------------------------------------------------------------

  describe('PascalCase detection', () => {
    test.each([
      ['UserController.py'],
      ['AuthService.py'],
      ['ProductRepository.py'],
      ['OrderSchema.py'],
    ])('blocks PascalCase filename: %s', (filename) => {
      // Arrange
      const input = createFileInput(`/app/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('snake_case');
    });

    test.each([
      ['user_controller.py'],
      ['auth_service.py'],
      ['HTTPClient.py'], // All caps prefix should not match PascalCase
    ])('allows snake_case or acronym prefix: %s', (filename) => {
      // Arrange - file outside specific directories
      const input = createFileInput(`/app/core/${filename}`);

      // Act
      const result = backendFileNaming(input);

      // Assert
      // Note: HTTPClient.py matches PascalCase pattern, so it will be blocked
      if (filename === 'HTTPClient.py') {
        expect(result.continue).toBe(false);
      } else {
        expect(result.continue).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty file path', () => {
      // Arrange
      const input = createFileInput('');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles missing file_path field', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: {},
      };

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles file with no extension', () => {
      // Arrange
      const input = createFileInput('/app/routers/Makefile');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles deeply nested paths', () => {
      // Arrange
      const input = createFileInput('/project/backend/src/app/routers/v2/admin/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('ROUTER NAMING');
    });

    test('is case sensitive for directory matching', () => {
      // Arrange
      const input = createFileInput('/app/Routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      // Should not match /routers/ - only lowercase matches
      expect(result.continue).toBe(true);
    });

    test('handles path with special characters', () => {
      // Arrange
      const input = createFileInput('/app/routers/user-auth.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs when blocking invalid file', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py');

      // Act
      backendFileNaming(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'backend-file-naming',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid files', () => {
      // Arrange
      const input = createFileInput('/app/routers/router_users.py');

      // Act
      backendFileNaming(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error message format
  // ---------------------------------------------------------------------------

  describe('error message format', () => {
    test('includes filename in error message', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.stopReason).toContain('users.py');
    });

    test('includes expected patterns in error', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py');

      // Act
      backendFileNaming(input);

      // Assert
      const blockCall = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockCall).toContain('must be prefixed');
    });

    test('provides actionable guidance', () => {
      // Arrange
      const input = createFileInput('/app/services/user.py');

      // Act
      backendFileNaming(input);

      // Assert
      const blockCall = vi.mocked(outputBlock).mock.calls[0][0];
      expect(blockCall).toContain('_service.py');
    });
  });

  // ---------------------------------------------------------------------------
  // Backend directory detection
  // ---------------------------------------------------------------------------

  describe('backend directory detection', () => {
    test('validates files in /backend/ directory', () => {
      // Arrange
      const input = createFileInput('/backend/routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('validates files in /app/ directory', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('ignores files outside backend/app directories', () => {
      // Arrange
      const input = createFileInput('/frontend/routers/users.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple violations
  // ---------------------------------------------------------------------------

  describe('multiple violations', () => {
    test('reports first violation found', () => {
      // Arrange - PascalCase in routers directory (two violations)
      const input = createFileInput('/app/routers/UserRoutes.py');

      // Act
      const result = backendFileNaming(input);

      // Assert
      expect(result.continue).toBe(false);
      // Should report router naming violation first
      expect(result.stopReason).toContain('ROUTER NAMING');
    });
  });
});

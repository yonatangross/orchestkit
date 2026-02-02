/**
 * Unit tests for structure-location-validator hook
 * Tests file structure and location validation (BLOCKING hook)
 *
 * Focus: Nesting depth, barrel files, component/hook locations, Python patterns
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputBlock: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  logHook: vi.fn(),
}));

vi.mock('../../lib/guards.js', () => ({
  guardCodeFiles: vi.fn(() => null), // Default: allow through
}));

import { structureLocationValidator } from '../../skill/structure-location-validator.js';
import { outputSilentSuccess, outputBlock, logHook } from '../../lib/common.js';
import { guardCodeFiles } from '../../lib/guards.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write/Edit tools
 */
function createWriteInput(
  filePath: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    tool_input: {
      file_path: filePath,
      content: '// test content',
    },
    ...overrides,
  };
}

// =============================================================================
// Structure Location Validator Tests
// =============================================================================

describe('structure-location-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardCodeFiles).mockReturnValue(null); // Reset guard
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance - Returns continue on all valid paths
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid file paths', () => {
      // Arrange
      const input = createWriteInput('/project/src/services/user.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for structure violations', () => {
      // Arrange - hook in wrong location
      const input = createWriteInput('/project/src/services/useAuth.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('returns suppressOutput: true for silent success', () => {
      // Arrange
      const input = createWriteInput('/project/src/services/api.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('skips processing when guard returns early', () => {
      // Arrange
      vi.mocked(guardCodeFiles).mockReturnValue({ continue: true, suppressOutput: true });
      const input = createWriteInput('/project/README.md');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Self-guard behavior
  // ---------------------------------------------------------------------------

  describe('self-guard behavior', () => {
    test('calls guardCodeFiles for filtering', () => {
      // Arrange
      const input = createWriteInput('/project/src/file.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(guardCodeFiles).toHaveBeenCalledWith(input);
    });

    test('returns guard result when guard returns early', () => {
      // Arrange
      const guardResult = { continue: true, suppressOutput: true };
      vi.mocked(guardCodeFiles).mockReturnValue(guardResult);
      const input = createWriteInput('/project/image.png');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result).toEqual(guardResult);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty/missing file path
  // ---------------------------------------------------------------------------

  describe('empty/missing file path', () => {
    test('returns silent success for empty file path', () => {
      // Arrange
      const input = createWriteInput('');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for missing file_path field', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test',
        tool_input: { content: 'test' },
      };

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Nesting depth validation (max 4 levels)
  // ---------------------------------------------------------------------------

  describe('nesting depth validation', () => {
    test.each([
      ['/project/src/a/file.ts', 2, true],
      ['/project/src/a/b/file.ts', 3, true],
      ['/project/src/a/b/c/file.ts', 4, true],
      ['/project/app/a/b/c/file.ts', 4, true],
    ])('allows path %s with depth %d', (filePath, _depth, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      ['/project/src/a/b/c/d/file.ts', 5],
      ['/project/src/a/b/c/d/e/file.ts', 6],
      ['/project/app/a/b/c/d/file.ts', 5],
      ['/project/src/level1/level2/level3/level4/level5/file.ts', 6],
    ])('blocks path %s with depth %d (exceeds max 4)', (filePath, depth) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('NESTING'),
      );
    });

    test('includes depth numbers in error message', () => {
      // Arrange
      const input = createWriteInput('/project/src/a/b/c/d/e/file.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('levels'),
      );
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('max: 4'),
      );
    });

    test('does not check depth for files outside src/ and app/', () => {
      // Arrange
      const input = createWriteInput('/project/lib/a/b/c/d/e/file.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Barrel file validation (index.ts discouraged)
  // ---------------------------------------------------------------------------

  describe('barrel file validation', () => {
    test.each([
      '/project/src/components/index.ts',
      '/project/src/utils/index.tsx',
      '/project/src/hooks/index.js',
    ])('blocks barrel file: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('BARREL'),
      );
    });

    test('allows index.ts in app/ directory (Next.js routing)', () => {
      // Arrange
      const input = createWriteInput('/project/app/dashboard/index.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows index.ts in node_modules/', () => {
      // Arrange
      const input = createWriteInput('/project/node_modules/react/index.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows index.ts in dist/', () => {
      // Arrange
      const input = createWriteInput('/project/dist/index.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows index.ts in build/', () => {
      // Arrange
      const input = createWriteInput('/project/build/index.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // React component location validation
  // ---------------------------------------------------------------------------

  describe('React component location validation', () => {
    test.each([
      ['/project/src/components/Button.tsx', true],
      ['/project/src/features/auth/LoginForm.tsx', true],
      ['/project/app/dashboard/Dashboard.tsx', true],
      ['/project/pages/home/HomePage.tsx', true],
    ])('allows component in correct location: %s', (filePath, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      '/project/src/utils/Button.tsx',
      '/project/src/services/UserCard.tsx',
      '/project/src/lib/Modal.jsx',
      '/project/src/helpers/Dialog.tsx',
    ])('blocks component in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('COMPONENT'),
      );
    });

    test('error message suggests correct locations', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/Button.tsx');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('components/'),
      );
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('features/'),
      );
    });

    test('non-PascalCase files are not treated as components', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/buttonHelpers.tsx');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom hook location validation
  // ---------------------------------------------------------------------------

  describe('custom hook location validation', () => {
    test.each([
      ['/project/src/hooks/useAuth.ts', true],
      ['/project/src/hooks/auth/useLogin.ts', true],
      ['/project/src/features/auth/hooks/useSession.tsx', true],
    ])('allows hook in correct location: %s', (filePath, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      '/project/src/utils/useAuth.ts',
      '/project/src/services/useApi.ts',
      '/project/src/components/useModal.tsx',
      '/project/src/lib/useForm.ts',
    ])('blocks hook in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('HOOK'),
      );
    });

    test('error message suggests hooks/ directory', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/useAuth.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('hooks/'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Python router file validation
  // ---------------------------------------------------------------------------

  describe('Python router file validation', () => {
    test.each([
      ['/project/app/routers/router_users.py', true],
      ['/project/backend/routers/routes_auth.py', true],
      ['/project/src/routers/api_items.py', true],
    ])('allows router in correct location: %s', (filePath, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      '/project/app/router_users.py',
      '/project/app/api/routes_auth.py',
      '/project/src/handlers/api_items.py',
    ])('blocks router in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('ROUTER'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Python service file validation
  // ---------------------------------------------------------------------------

  describe('Python service file validation', () => {
    test.each([
      ['/project/app/services/user_service.py', true],
      ['/project/backend/services/auth_service.py', true],
    ])('allows service in correct location: %s', (filePath, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      '/project/app/user_service.py',
      '/project/app/handlers/auth_service.py',
      '/project/src/utils/data_service.py',
    ])('blocks service in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('SERVICE'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Python repository file validation
  // ---------------------------------------------------------------------------

  describe('Python repository file validation', () => {
    test.each([
      ['/project/app/repositories/user_repository.py', true],
      ['/project/backend/repositories/auth_repo.py', true],
    ])('allows repository in correct location: %s', (filePath, expected) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(expected);
    });

    test.each([
      '/project/app/user_repository.py',
      '/project/app/data/auth_repo.py',
      '/project/src/utils/item_repository.py',
    ])('blocks repository in wrong location: %s', (filePath) => {
      // Arrange
      const input = createWriteInput(filePath);

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('REPOSITORY'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs block events', () => {
      // Arrange
      const input = createWriteInput('/project/src/utils/useAuth.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'structure-location-validator',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid paths', () => {
      // Arrange
      const input = createWriteInput('/project/src/services/api.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles paths with multiple src/ segments', () => {
      // Arrange
      const input = createWriteInput('/project/src/archived/src/file.ts');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles paths without filename', () => {
      // Arrange
      const input = createWriteInput('/project/src/');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles Windows-style paths', () => {
      // Arrange
      const input = createWriteInput('C:\\project\\src\\utils\\Button.tsx');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      // Path parsing uses forward slashes, so Windows paths need normalization
      expect(result.continue).toBe(true);
    });

    test('only reports first error when multiple violations exist', () => {
      // Arrange - deep nesting AND wrong location
      const input = createWriteInput('/project/src/a/b/c/d/e/useAuth.ts');

      // Act
      structureLocationValidator(input);

      // Assert
      expect(outputBlock).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern precedence
  // ---------------------------------------------------------------------------

  describe('pattern precedence', () => {
    test('nesting depth is checked for src/ and app/ paths', () => {
      // Arrange
      const srcInput = createWriteInput('/project/src/a/b/c/d/e/file.ts');
      const appInput = createWriteInput('/project/app/a/b/c/d/e/file.ts');

      // Act
      const srcResult = structureLocationValidator(srcInput);
      const appResult = structureLocationValidator(appInput);

      // Assert
      expect(srcResult.continue).toBe(false);
      expect(appResult.continue).toBe(false);
    });

    test('multiple TypeScript rules can apply to same file', () => {
      // Arrange - PascalCase file that could be component
      const input = createWriteInput('/project/src/Button.tsx');

      // Act
      const result = structureLocationValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('COMPONENT'),
      );
    });
  });
});

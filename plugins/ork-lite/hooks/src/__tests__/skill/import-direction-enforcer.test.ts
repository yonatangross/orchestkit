/**
 * Unit tests for import-direction-enforcer hook
 * Tests enforcement of unidirectional architecture import rules
 *
 * BLOCKING HOOK: Returns continue: false on violations
 * CC 2.1.7 Compliant
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
  guardCodeFiles: vi.fn(() => null), // null = continue, not null = skip
}));

import { importDirectionEnforcer } from '../../skill/import-direction-enforcer.js';
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
  content: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      file_path: filePath,
      content: content,
    },
    ...overrides,
  };
}

// =============================================================================
// Import Direction Enforcer Tests
// =============================================================================

describe('import-direction-enforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardCodeFiles).mockReturnValue(null); // Default: pass guard
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid imports', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/src/features/auth/index.ts',
        'import { Button } from "@/components/Button"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for invalid imports', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/src/shared/utils.ts',
        'import { Feature } from "@/features/auth"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('block result has proper hookSpecificOutput', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/src/lib/api.ts',
        'import { AppLayout } from "@/app/layout"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.hookSpecificOutput).toMatchObject({
        permissionDecision: 'deny',
        permissionDecisionReason: expect.any(String),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Guard behavior
  // ---------------------------------------------------------------------------

  describe('guard behavior', () => {
    test('respects guardCodeFiles result when it returns skip', () => {
      // Arrange
      const skipResult = { continue: true, suppressOutput: true };
      vi.mocked(guardCodeFiles).mockReturnValue(skipResult);
      const input = createWriteInput('/test/project/README.md', 'Some content');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result).toEqual(skipResult);
      expect(outputBlock).not.toHaveBeenCalled();
    });

    test('continues processing when guardCodeFiles returns null', () => {
      // Arrange
      vi.mocked(guardCodeFiles).mockReturnValue(null);
      const input = createWriteInput(
        '/test/project/src/shared/utils.ts',
        'import { valid } from "./helper"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Missing/empty input handling
  // ---------------------------------------------------------------------------

  describe('missing/empty input handling', () => {
    test('returns silent success for missing file_path', () => {
      // Arrange
      const input = createWriteInput('', 'some content');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for missing content', () => {
      // Arrange
      const input = createWriteInput('/test/project/src/lib/utils.ts', '');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns silent success for undefined file_path', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: { content: 'some code' },
      };

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Layer detection
  // ---------------------------------------------------------------------------

  describe('layer detection', () => {
    test.each([
      ['/src/shared/utils.ts', 'shared'],
      ['/src/lib/api.ts', 'lib'],
      ['/src/utils/helpers.ts', 'utils'],
      ['/src/components/Button.tsx', 'components'],
      ['/src/hooks/useAuth.ts', 'hooks'],
      ['/src/features/auth/index.ts', 'features'],
      ['/src/app/layout.tsx', 'app'],
      ['/src/pages/home.tsx', 'app'],
    ])('detects TypeScript layer for path %s as %s', (path, _layer) => {
      // Arrange
      const input = createWriteInput(path, 'export const x = 1;');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test.each([
      ['/backend/repositories/user.py', 'repositories'],
      ['/backend/services/auth.py', 'services'],
      ['/backend/routers/api.py', 'routers'],
    ])('detects Python layer for path %s as %s', (path, _layer) => {
      // Arrange - Paths without /app/ to avoid TS layer detection
      const input = createWriteInput(path, 'from app.models import User');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns silent success for unrecognized layer', () => {
      // Arrange
      const input = createWriteInput('/random/path/file.ts', 'import something');

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript import rules - BLOCKING violations
  // ---------------------------------------------------------------------------

  describe('TypeScript import violations', () => {
    test.each([
      ['shared', '/src/shared/utils.ts', 'import { Auth } from "@/features/auth"'],
      ['shared', '/src/shared/utils.ts', 'import { Layout } from "@/app/layout"'],
      ['lib', '/src/lib/api.ts', 'import { Feature } from "@/features/feat"'],
      ['lib', '/src/lib/api.ts', 'import { Page } from "@/app/page"'],
      ['utils', '/src/utils/helpers.ts', 'import { Auth } from "@/features/auth"'],
      ['utils', '/src/utils/helpers.ts', 'import { App } from "@/app/main"'],
    ])('%s layer blocks import from features/app: %s', (layer, path, content) => {
      // Arrange
      const input = createWriteInput(path, content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalled();
    });

    test.each([
      ['components', '/src/components/Button.tsx', 'import { Auth } from "@/features/auth"'],
      ['components', '/src/components/Modal.tsx', 'import { Layout } from "@/app/layout"'],
      ['hooks', '/src/hooks/useData.ts', 'import { Feature } from "@/features/data"'],
      ['hooks', '/src/hooks/useAuth.ts', 'import { Page } from "@/app/page"'],
    ])('%s layer blocks import from features/app: %s', (layer, path, content) => {
      // Arrange
      const input = createWriteInput(path, content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('features layer blocks import from app', () => {
      // Arrange
      const input = createWriteInput(
        '/src/features/auth/index.ts',
        'import { Layout } from "@/app/layout"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('cannot import from app');
    });

    test('features layer allows import from components', () => {
      // Arrange
      const input = createWriteInput(
        '/src/features/auth/AuthForm.tsx',
        'import { Button } from "@/components/Button"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TypeScript/JavaScript import rules - ALLOWED imports
  // ---------------------------------------------------------------------------

  describe('TypeScript allowed imports', () => {
    test.each([
      ['shared -> utils', '/src/shared/api.ts', 'import { format } from "./format"'],
      ['lib -> shared', '/src/lib/client.ts', 'import { API_URL } from "@/shared/config"'],
      ['components -> lib', '/src/components/Btn.tsx', 'import { api } from "@/lib/api"'],
      ['hooks -> components', '/src/hooks/useForm.ts', 'import { Input } from "@/components/Input"'],
      ['features -> components', '/src/features/auth/Auth.tsx', 'import { Btn } from "@/components/Btn"'],
      ['features -> hooks', '/src/features/auth/Auth.tsx', 'import { useAuth } from "@/hooks/useAuth"'],
      ['features -> lib', '/src/features/data/Data.tsx', 'import { api } from "@/lib/api"'],
      ['app -> features', '/src/app/page.tsx', 'import { Auth } from "@/features/auth"'],
      ['app -> components', '/src/app/layout.tsx', 'import { Nav } from "@/components/Nav"'],
    ])('allows %s import', (desc, path, content) => {
      // Arrange
      const input = createWriteInput(path, content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputBlock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Import path variations
  // ---------------------------------------------------------------------------

  describe('import path variations', () => {
    test('detects @/ alias imports', () => {
      // Arrange
      const input = createWriteInput(
        '/src/shared/utils.ts',
        'import { Auth } from "@/features/auth"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('detects relative imports with ../', () => {
      // Arrange
      const input = createWriteInput(
        '/src/shared/utils.ts',
        'import { Auth } from "../features/auth"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles double quote imports', () => {
      // Arrange
      const input = createWriteInput(
        '/src/lib/api.ts',
        'import { Layout } from "@/app/layout"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles single quote imports', () => {
      // Arrange
      const input = createWriteInput(
        '/src/lib/api.ts',
        "import { Layout } from '@/app/layout'"
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Python import rules - BLOCKING violations
  // ---------------------------------------------------------------------------

  describe('Python import violations', () => {
    test('repositories cannot import from services', () => {
      // Arrange - Path must include /repositories/ and not /app/ (which triggers TS layer)
      const input = createWriteInput(
        '/backend/repositories/user.py',
        'from app.services.auth import AuthService'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('repositories');
    });

    test('repositories cannot import from routers', () => {
      // Arrange
      const input = createWriteInput(
        '/backend/repositories/user.py',
        'from app.routers.api import router'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('services cannot import from routers (with module name)', () => {
      // Arrange - Pattern requires `routers.[a-z]` (lowercase module name)
      // Path must be /services/ and .py file, not /app/ (which triggers TS layer)
      const input = createWriteInput(
        '/backend/services/auth.py',
        'from app.routers.users import router'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('services');
    });
  });

  // ---------------------------------------------------------------------------
  // Python import rules - ALLOWED imports
  // ---------------------------------------------------------------------------

  describe('Python allowed imports', () => {
    test('services can import deps from routers', () => {
      // Arrange - Use path without /app/ to avoid TS layer detection
      const input = createWriteInput(
        '/backend/services/auth.py',
        'from app.routers.deps import get_db'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('services can import dependencies from routers', () => {
      // Arrange
      const input = createWriteInput(
        '/backend/services/auth.py',
        'from app.routers.dependencies import get_current_user'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('routers can import from services', () => {
      // Arrange
      const input = createWriteInput(
        '/backend/routers/user.py',
        'from app.services.auth import AuthService'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('services can import from repositories', () => {
      // Arrange
      const input = createWriteInput(
        '/backend/services/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Feature-scoped components/hooks (nested in features/)
  // ---------------------------------------------------------------------------

  describe('feature-scoped paths', () => {
    test('components nested in features/ are treated as features layer', () => {
      // Arrange - /features/auth/components/ should be features, not components
      const input = createWriteInput(
        '/src/features/auth/components/LoginForm.tsx',
        'import { something } from "@/components/Button"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true); // features can import from components
    });

    test('hooks nested in features/ are treated as features layer', () => {
      // Arrange
      const input = createWriteInput(
        '/src/features/auth/hooks/useLogin.ts',
        'import { useForm } from "@/hooks/useForm"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(true); // features can import from hooks
    });
  });

  // ---------------------------------------------------------------------------
  // File extension handling
  // ---------------------------------------------------------------------------

  describe('file extension handling', () => {
    test.each(['.ts', '.tsx', '.js', '.jsx'])(
      'applies TypeScript rules to %s files',
      (ext) => {
        // Arrange
        const input = createWriteInput(
          `/src/shared/utils${ext}`,
          'import { Feature } from "@/features/auth"'
        );

        // Act
        const result = importDirectionEnforcer(input);

        // Assert
        expect(result.continue).toBe(false);
      }
    );

    test('applies Python rules to .py files', () => {
      // Arrange - Pattern requires `from (app\.)?services` and path without /app/
      const input = createWriteInput(
        '/backend/repositories/user.py',
        'from app.services.auth import AuthService'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  describe('logging', () => {
    test('logs blocked imports', () => {
      // Arrange
      const input = createWriteInput(
        '/src/shared/utils.ts',
        'import { Auth } from "@/features/auth"'
      );

      // Act
      importDirectionEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'import-direction-enforcer',
        expect.stringContaining('BLOCKED')
      );
    });

    test('does not log allowed imports', () => {
      // Arrange
      const input = createWriteInput(
        '/src/features/auth/Auth.tsx',
        'import { Button } from "@/components/Button"'
      );

      // Act
      importDirectionEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles multiline imports', () => {
      // Arrange
      const content = `
import {
  Feature,
  AnotherFeature
} from "@/features/auth"
`;
      const input = createWriteInput('/src/shared/utils.ts', content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles multiple imports in same file', () => {
      // Arrange
      const content = `
import { valid } from "@/lib/utils"
import { Feature } from "@/features/auth"
`;
      const input = createWriteInput('/src/shared/api.ts', content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('first error is reported in stopReason', () => {
      // Arrange
      const content = `
import { Feature } from "@/features/auth"
import { Layout } from "@/app/layout"
`;
      const input = createWriteInput('/src/shared/api.ts', content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('shared/');
    });

    test('handles tool_result as content source', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Edit',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {
          file_path: '/src/shared/utils.ts',
        },
        tool_result: 'import { Feature } from "@/features/auth"',
      };

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('stopReason includes filename', () => {
      // Arrange
      const input = createWriteInput(
        '/src/lib/api.ts',
        'import { Feature } from "@/features/auth"'
      );

      // Act
      const result = importDirectionEnforcer(input);

      // Assert
      expect(result.stopReason).toContain('api.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // Comment and string handling
  // ---------------------------------------------------------------------------

  describe('comment handling', () => {
    test('detects imports in comments (current behavior)', () => {
      // Arrange - Note: Current implementation does not skip comments
      const content = `
// import { Feature } from "@/features/auth"
`;
      const input = createWriteInput('/src/shared/utils.ts', content);

      // Act
      const result = importDirectionEnforcer(input);

      // Assert - Current implementation blocks even commented imports
      expect(result.continue).toBe(false);
    });
  });
});

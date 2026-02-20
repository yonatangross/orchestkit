/**
 * Unit tests for backend-layer-validator hook
 * Tests enforcement of FastAPI layer separation architecture
 *
 * Coverage Focus: Validates that routers don't access DB directly,
 * services don't throw HTTP exceptions, repositories stay isolated
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
  lineContainsAll: (content: string, ...terms: string[]) => content.split('\n').some(line => terms.every(t => line.includes(t))),
  lineContainsAllCI: (content: string, ...terms: string[]) => content.split('\n').some(line => { const lower = line.toLowerCase(); return terms.every(t => lower.includes(t.toLowerCase())); }),
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

import { backendLayerValidator } from '../../skill/backend-layer-validator.js';
import { logHook } from '../../lib/common.js';
import { guardPythonFiles } from '../../lib/guards.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for file operations with content
 */
function createFileInput(
  filePath: string,
  content: string,
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content },
    ...overrides,
  };
}

// =============================================================================
// Backend Layer Validator Tests
// =============================================================================

describe('backend-layer-validator', () => {
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
    test('returns continue: true for valid layer code', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends
from app.services.user_service import UserService

router = APIRouter()

@router.get("/users")
async def get_users(service: UserService = Depends(get_user_service)):
    return await service.get_all_users()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for layer violations with proper structure', () => {
      // Arrange
      const content = `
from fastapi import APIRouter
from sqlalchemy import select

router = APIRouter()

@router.get("/users")
async def get_users(db: AsyncSession):
    result = db.execute(select(User))
    return result.scalars().all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBeDefined();
    });

    test('always returns valid HookResult structure', () => {
      // Arrange
      const input = createFileInput('/app/routers/test.py', 'from sqlalchemy import Column');

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // Guard behavior
  // ---------------------------------------------------------------------------

  describe('guard behavior', () => {
    test('skips non-Python files', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.ts', 'db.execute()');

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(guardPythonFiles).toHaveBeenCalledWith(input);
    });

    test('skips when file_path is empty', () => {
      // Arrange
      const input = createFileInput('', 'db.execute()');

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('skips when content is empty', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py', '');

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Router layer violations
  // ---------------------------------------------------------------------------

  describe('router layer violations', () => {
    test.each([
      ['db.add(user)', 'add'],
      ['db.delete(user)', 'delete'],
      ['db.commit()', 'commit'],
      ['db.flush()', 'flush'],
      ['db.rollback()', 'rollback'],
      ['db.refresh(user)', 'refresh'],
      ['db.execute(query)', 'execute'],
      ['db.scalar(query)', 'scalar'],
    ])('blocks direct database operation: %s', (code, _operation) => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

@router.post("/users")
async def create_user(db: AsyncSession):
    user = User(name="test")
    ${code}
    return user
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('DATABASE');
    });

    test('blocks SQLAlchemy imports in routers', () => {
      // Arrange
      const content = `
from fastapi import APIRouter
from sqlalchemy import select, Column, Integer

router = APIRouter()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('IMPORT');
      expect(result.stopReason).toContain('SQLAlchemy');
    });

    test('allows routers that use services correctly', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends
from app.services.user_service import UserService

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    user_service: UserService = Depends(get_user_service)
):
    return await user_service.get_user(user_id)
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('validates nested routers directory', () => {
      // Arrange
      const content = 'from sqlalchemy import select';
      const input = createFileInput('/backend/app/routers/v1/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Service layer violations
  // ---------------------------------------------------------------------------

  describe('service layer violations', () => {
    test('blocks HTTPException in services', () => {
      // Arrange
      const content = `
from fastapi import HTTPException

class UserService:
    async def get_user(self, user_id: int):
        user = await self.repo.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
`;
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('HTTP');
      expect(result.stopReason).toContain('HTTPException');
    });

    test('blocks Request import in services', () => {
      // Arrange
      const content = `
from fastapi import Request

class UserService:
    async def process_request(self, request: Request):
        return request.headers
`;
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Request');
    });

    test('blocks Response import in services', () => {
      // Arrange
      const content = `
from fastapi import Response

class UserService:
    async def create_response(self) -> Response:
        return Response(content="OK")
`;
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('Response');
    });

    test('allows services with domain exceptions', () => {
      // Arrange
      const content = `
from app.exceptions import UserNotFoundError

class UserService:
    async def get_user(self, user_id: int):
        user = await self.repo.get(user_id)
        if not user:
            raise UserNotFoundError(user_id)
        return user
`;
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows services to use repositories', () => {
      // Arrange
      const content = `
from app.repositories.user_repository import UserRepository

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def get_all_users(self):
        return await self.repo.get_all()
`;
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Repository layer violations
  // ---------------------------------------------------------------------------

  describe('repository layer violations', () => {
    test('blocks HTTPException in repositories', () => {
      // Arrange
      const content = `
from fastapi import HTTPException

class UserRepository:
    async def get(self, user_id: int):
        user = await self.session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404)
        return user
`;
      const input = createFileInput('/app/repositories/user_repository.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('HTTP');
    });

    test('blocks service imports in repositories', () => {
      // Arrange
      const content = `
from app.services.email_service import EmailService

class UserRepository:
    def __init__(self, email_service: EmailService):
        self.email_service = email_service
`;
      const input = createFileInput('/app/repositories/user_repository.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('IMPORT');
      expect(result.stopReason).toContain('services');
    });

    test('blocks router imports in repositories', () => {
      // Arrange
      const content = `
from app.routers.users import user_router

class UserRepository:
    pass
`;
      const input = createFileInput('/app/repositories/user_repository.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('routers');
    });

    test('allows repositories with proper SQLAlchemy usage', () => {
      // Arrange
      const content = `
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self):
        result = await self.session.execute(select(User))
        return result.scalars().all()
`;
      const input = createFileInput('/app/repositories/user_repository.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles missing file_path', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'db.execute()' },
      };

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool_result instead of content', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session-123',
        tool_input: { file_path: '/app/routers/users.py' },
        tool_result: 'from sqlalchemy import select',
      } as any;

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles empty content string', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py', '');

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined content', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/app/routers/users.py' },
      };

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles multiline content without violations', () => {
      // Arrange - content that does NOT contain db.execute or similar patterns
      const content = `
from fastapi import APIRouter

router = APIRouter()

# This is a comment about database operations
# Just describing the architecture

@router.get("/")
async def root():
    return {"message": "Hello"}
`;
      const input = createFileInput('/app/routers/root.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects violations in multiline imports', () => {
      // Arrange
      const content = `
from sqlalchemy import (
    Column,
    Integer,
    String
)
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Files outside layer directories
  // ---------------------------------------------------------------------------

  describe('files outside layer directories', () => {
    test('allows database operations in non-layer files', () => {
      // Arrange
      const content = 'db.execute(query)';
      const input = createFileInput('/app/core/database.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows HTTPException in non-layer files', () => {
      // Arrange
      const content = 'from fastapi import HTTPException';
      const input = createFileInput('/app/exceptions/handlers.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs when blocking layer violation', () => {
      // Arrange
      const content = 'from sqlalchemy import select';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      backendLayerValidator(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'backend-layer-validator',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid code', () => {
      // Arrange
      const content = 'from fastapi import APIRouter';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      backendLayerValidator(input);

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
      const content = 'db.execute(query)';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.stopReason).toContain('users.py');
    });

    test('includes violation type in error', () => {
      // Arrange
      const content = 'from sqlalchemy import select';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.stopReason).toContain('IMPORT');
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern specificity
  // ---------------------------------------------------------------------------

  describe('pattern specificity', () => {
    test('does not false positive on similar method names', () => {
      // Arrange - "added" contains "add" but should not match "db.add"
      const content = `
@router.post("/users")
async def create_user(user_service: UserService = Depends()):
    # User added successfully
    return await user_service.create_user(data)
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('matches db operations with different spacing', () => {
      // Arrange
      const content = `
@router.post("/")
async def create(db):
    db.add( user )
    return user
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // First violation reported
  // ---------------------------------------------------------------------------

  describe('first violation reported', () => {
    test('reports first violation when multiple exist', () => {
      // Arrange - both SQLAlchemy import and db.execute
      const content = `
from sqlalchemy import select

@router.get("/")
async def get(db):
    result = db.execute(select(User))
    return result
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = backendLayerValidator(input);

      // Assert
      expect(result.continue).toBe(false);
      // Should report DATABASE violation first (checked before IMPORT)
      expect(result.stopReason).toContain('DATABASE');
    });
  });
});

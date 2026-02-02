/**
 * Unit tests for di-pattern-enforcer hook
 * Tests enforcement of dependency injection patterns in FastAPI routers
 *
 * Coverage Focus: Validates DI patterns for services, repositories,
 * database sessions, and async operations
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks - MUST come before imports
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { diPatternEnforcer } from '../../skill/di-pattern-enforcer.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for file operations
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
// DI Pattern Enforcer Tests
// =============================================================================

describe('di-pattern-enforcer', () => {
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
    test('returns continue: true for valid DI patterns', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends
from app.services.user_service import UserService

router = APIRouter()

@router.get("/users")
async def get_users(user_service: UserService = Depends(get_user_service)):
    return await user_service.get_all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: true for DI violations (warns instead of blocks)', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

user_service = UserService()

@router.get("/users")
async def get_users():
    return await user_service.get_all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('always returns valid HookResult structure', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py', 'router = APIRouter()');

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(typeof result.continue).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // File filtering
  // ---------------------------------------------------------------------------

  describe('file filtering', () => {
    test('skips non-routers directory files', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/services/user_service.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('skips deps.py files', () => {
      // Arrange
      const content = `
def get_user_service():
    return UserService()
`;
      const input = createFileInput('/app/routers/deps.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('skips dependencies.py files', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/routers/dependencies.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('skips __init__.py files', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/routers/__init__.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('skips non-Python files', () => {
      // Arrange
      const content = 'const service = new UserService()';
      const input = createFileInput('/app/routers/users.ts', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Direct service instantiation
  // ---------------------------------------------------------------------------

  describe('direct service instantiation', () => {
    test.each([
      ['user_service = UserService()'],
      ['auth_service = AuthService()'],
      ['email_service = EmailNotificationService()'],
      ['svc = MyCustomService()'],
    ])('detects direct service instantiation: %s', (code) => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

${code}
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('Dependency injection violation'),
      );
    });

    test('allows service with Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/users")
async def get_users(user_service: UserService = Depends(get_user_service)):
    return user_service.get_all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Direct repository instantiation
  // ---------------------------------------------------------------------------

  describe('direct repository instantiation', () => {
    test.each([
      ['user_repo = UserRepository()'],
      ['auth_repo = AuthRepo()'],
      ['product_repository = ProductRepository()'],
    ])('detects direct repository instantiation: %s', (code) => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

${code}
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Global instances
  // ---------------------------------------------------------------------------

  describe('global instances', () => {
    test.each([
      ['user_service = UserService(db)', 'service instance'],
      ['auth_repo = AuthRepository(session)', 'repo instance'],
      ['my_service = MyService()', 'service instantiation'],
    ])('detects global instance: %s', (code, _description) => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

${code}

@router.get("/")
async def root():
    return {}
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('provides guidance about global instance issues', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

user_service = UserService()

router = APIRouter()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      diPatternEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'di-pattern-enforcer',
        expect.stringContaining('BLOCKED'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Database session handling
  // ---------------------------------------------------------------------------

  describe('database session handling', () => {
    test('detects session without Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users(db: AsyncSession):
    return await db.execute(select(User))
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('allows session with Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    return await db.execute(select(User))
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects sync Session without Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
def get_users(db: Session):
    return db.query(User).all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Route handler dependency injection
  // ---------------------------------------------------------------------------

  describe('route handler dependency injection', () => {
    test('detects service parameter without Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users(user_service: UserService):
    return await user_service.get_all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('detects repository parameter without Depends', () => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

@router.post("/users")
async def create_user(user_repo: UserRepository):
    return await user_repo.create()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('allows service with Depends in route', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/users")
async def get_users(user_service: UserService = Depends(get_user_service)):
    return await user_service.get_all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Async/sync pattern detection
  // ---------------------------------------------------------------------------

  describe('async/sync pattern detection', () => {
    test('detects sync db.query in async function', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    return db.query(User).all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('allows awaited async operations', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects missing await for db.commit with AsyncSession', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.post("/users")
async def create_user(db: AsyncSession = Depends(get_db)):
    user = User(name="test")
    db.add(user)
    db.commit()
    return user
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('allows awaited db operations', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.post("/users")
async def create_user(db: AsyncSession = Depends(get_db)):
    user = User(name="test")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty file path', () => {
      // Arrange
      const input = createFileInput('', 'user_service = UserService()');

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles empty content', () => {
      // Arrange
      const input = createFileInput('/app/routers/users.py', '');

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles tool_result instead of content', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session-123',
        tool_input: { file_path: '/app/routers/users.py' },
        tool_result: 'user_service = UserService()',
      } as any;

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });

    test('handles undefined file_path', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'user_service = UserService()' },
      };

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles undefined tool_input', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: {},
      };

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging behavior
  // ---------------------------------------------------------------------------

  describe('logging behavior', () => {
    test('logs when detecting DI violation', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      diPatternEnforcer(input);

      // Assert
      expect(logHook).toHaveBeenCalledWith(
        'di-pattern-enforcer',
        expect.stringContaining('BLOCKED'),
      );
    });

    test('does not log for valid patterns', () => {
      // Arrange
      const content = `
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/")
async def root(service: UserService = Depends(get_service)):
    return {}
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      diPatternEnforcer(input);

      // Assert
      expect(logHook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Context message format
  // ---------------------------------------------------------------------------

  describe('context message format', () => {
    test('includes file path in context', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('/app/routers/users.py'),
      );
    });

    test('mentions stderr for details', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalledWith(
        expect.stringContaining('stderr'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Route decorator detection
  // ---------------------------------------------------------------------------

  describe('route decorator detection', () => {
    test.each([
      ['@router.get'],
      ['@router.post'],
      ['@router.put'],
      ['@router.patch'],
      ['@router.delete'],
    ])('validates %s route handlers', (decorator) => {
      // Arrange
      const content = `
from fastapi import APIRouter

router = APIRouter()

${decorator}("/")
async def handler(user_service: UserService):
    return {}
`;
      const input = createFileInput('/app/routers/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Nested routers directory
  // ---------------------------------------------------------------------------

  describe('nested routers directory', () => {
    test('validates files in nested routers path', () => {
      // Arrange
      const content = 'user_service = UserService()';
      const input = createFileInput('/backend/app/routers/v2/users.py', content);

      // Act
      const result = diPatternEnforcer(input);

      // Assert
      expect(outputWithContext).toHaveBeenCalled();
    });
  });
});

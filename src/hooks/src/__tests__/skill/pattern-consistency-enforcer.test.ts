/**
 * Unit tests for pattern-consistency-enforcer hook
 * Tests enforcement of established patterns across the codebase
 *
 * BLOCKING HOOK: Returns continue: false on critical violations
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
  getProjectDir: vi.fn(() => '/test/project'),
  lineContainsAll: (content: string, ...terms: string[]) => content.split('\n').some(line => terms.every(t => line.includes(t))),
  lineContainsAllCI: (content: string, ...terms: string[]) => content.split('\n').some(line => { const lower = line.toLowerCase(); return terms.every(t => lower.includes(t.toLowerCase())); }),
}));

vi.mock('../../lib/git.js', () => ({
  getRepoRoot: vi.fn(() => '/test/project'),
}));

import { patternConsistencyEnforcer } from '../../skill/pattern-consistency-enforcer.js';
import { outputSilentSuccess, outputBlock, getProjectDir } from '../../lib/common.js';
import { getRepoRoot } from '../../lib/git.js';
import { existsSync, } from 'node:fs';

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
// Pattern Consistency Enforcer Tests
// =============================================================================

describe('pattern-consistency-enforcer', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Default: patterns file exists
    vi.mocked(existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CC 2.1.7 compliance
  // ---------------------------------------------------------------------------

  describe('CC 2.1.7 compliance', () => {
    test('returns continue: true for valid patterns', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/services/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns continue: false for pattern violations', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/routers/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('returns continue: true when patterns file missing', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createWriteInput(
        '/test/project/backend/app/routers/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Early exit conditions
  // ---------------------------------------------------------------------------

  describe('early exit conditions', () => {
    test('returns silent success for empty file_path', () => {
      // Arrange
      const input = createWriteInput('', 'content');

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success for empty content', () => {
      // Arrange
      const input = createWriteInput('/test/project/file.py', '');

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('returns silent success when patterns file does not exist', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);
      const input = createWriteInput(
        '/test/project/backend/app/file.py',
        'some content'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Backend Python patterns - Clean Architecture
  // ---------------------------------------------------------------------------

  describe('backend Python - Clean Architecture', () => {
    test('blocks router importing from repository directly', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/routers/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputBlock).toHaveBeenCalledWith(
        expect.stringContaining('Pattern consistency violations')
      );
    });

    test('allows router importing from services', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/routers/user.py',
        'from app.services.user import UserService'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('blocks service importing from router', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/services/user.py',
        'from app.routers.user import get_user'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows service importing from repositories', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/services/user.py',
        'from app.repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Backend Python patterns - SQLAlchemy async
  // ---------------------------------------------------------------------------

  describe('backend Python - SQLAlchemy async', () => {
    test('blocks sync SQLAlchemy Session usage', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/services/db.py',
        `
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows async SQLAlchemy usage', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/services/db.py',
        `
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Backend Python patterns - Pydantic v2
  // ---------------------------------------------------------------------------

  describe('backend Python - Pydantic v2', () => {
    test('blocks @validator decorator (v1)', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/schemas/user.py',
        `
from pydantic import BaseModel, validator

class User(BaseModel):
    name: str

    @validator('name')
    def validate_name(cls, v):
        return v
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks @root_validator decorator (v1)', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/schemas/user.py',
        `
from pydantic import BaseModel, root_validator

class User(BaseModel):
    @root_validator
    def validate_all(cls, values):
        return values
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows @field_validator decorator (v2)', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/schemas/user.py',
        `
from pydantic import BaseModel, field_validator

class User(BaseModel):
    name: str

    @field_validator('name', mode='after')
    def validate_name(cls, v):
        return v
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Frontend TypeScript patterns - React.FC
  // ---------------------------------------------------------------------------

  describe('frontend TypeScript - React.FC', () => {
    test('blocks React.FC usage', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/Button.tsx',
        `
import React from 'react';

const Button: React.FC<ButtonProps> = ({ children }) => {
  return <button>{children}</button>;
};
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows explicit function components', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/Button.tsx',
        `
interface ButtonProps {
  children: React.ReactNode;
}

function Button({ children }: ButtonProps): React.ReactNode {
  return <button>{children}</button>;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Frontend TypeScript patterns - Zod validation
  // ---------------------------------------------------------------------------

  describe('frontend TypeScript - Zod validation', () => {
    test('blocks fetch without Zod', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/services/api.ts',
        `
async function fetchUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks axios without Zod', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/services/api.ts',
        `
import axios from 'axios';

async function fetchUser(id: string) {
  const { data } = await axios.get(\`/api/users/\${id}\`);
  return data;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows fetch with Zod validation', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/services/api.ts',
        `
import { z } from 'zod';

const UserSchema = z.object({ id: z.string(), name: z.string() });

async function fetchUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return UserSchema.parse(await response.json());
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Frontend TypeScript patterns - React 19 forms (warning only)
  // ---------------------------------------------------------------------------

  describe('frontend TypeScript - React 19 forms', () => {
    test('warns about forms without React 19 hooks', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/Form.tsx',
        `
function MyForm() {
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      <button type="submit">Submit</button>
    </form>
  );
}
`
      );

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('WARNING');
      expect(stderrOutput).toContain('useFormStatus');
    });

    test('passes when using useFormStatus', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/Form.tsx',
        `
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>Submit</button>;
}

function MyForm() {
  return (
    <form action={submitAction}>
      <SubmitButton />
    </form>
  );
}
`
      );

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('WARNING');
    });
  });

  // ---------------------------------------------------------------------------
  // Frontend TypeScript patterns - Date formatting
  // ---------------------------------------------------------------------------

  describe('frontend TypeScript - Date formatting', () => {
    test('blocks direct date formatting', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/DateDisplay.tsx',
        `
function DateDisplay({ date }: { date: Date }) {
  return <span>{new Date(date).toLocaleDateString()}</span>;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows centralized date utility', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/components/DateDisplay.tsx',
        `
import { formatDate } from '@/lib/dates';

function DateDisplay({ date }: { date: Date }) {
  return <span>{formatDate(date)}</span>;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Testing patterns - AAA pattern (warning only)
  // ---------------------------------------------------------------------------

  describe('testing patterns - AAA', () => {
    test.each([
      ['/test/project/tests/test_user.py', '# Arrange'],
      ['/test/project/src/__tests__/user.test.ts', '// Arrange'],
      ['/test/project/tests/user.spec.tsx', '// Act'],
    ])('passes test file with AAA comment: %s', (path, comment) => {
      // Arrange
      const content = `
${comment}
const user = createUser();

// Act
const result = process(user);

// Assert
expect(result).toBeDefined();
`;
      const input = createWriteInput(path, content);

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).not.toContain('AAA pattern');
    });

    test('warns about test without AAA comments', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/tests/test_user.py',
        `
def test_user_creation():
    user = create_user()
    result = process(user)
    assert result is not None
`
      );

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('WARNING');
      expect(stderrOutput).toContain('AAA pattern');
    });
  });

  // ---------------------------------------------------------------------------
  // Testing patterns - MSW vs jest.mock
  // ---------------------------------------------------------------------------

  describe('testing patterns - MSW', () => {
    test('blocks jest.mock for fetch in frontend test files', () => {
      // Arrange - Must be .test.ts file and have jest.mock...fetch pattern
      const input = createWriteInput(
        '/test/project/frontend/src/__tests__/api.test.ts',
        `
jest.mock('axios');

describe('API', () => {
  test('fetches user', async () => {
    global.fetch = jest.fn();
  });
});
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks global.fetch mocking in frontend tests', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/__tests__/api.test.ts',
        `
describe('API', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
});
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows MSW for API mocking', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/__tests__/api.test.ts',
        `
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/user', () => HttpResponse.json({ id: '1' }))
);
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Testing patterns - pytest fixtures
  // ---------------------------------------------------------------------------

  describe('testing patterns - pytest fixtures', () => {
    test('blocks unittest setUp in Python tests (class Test + setUp on same line)', () => {
      // Arrange - The pattern /class Test.*setUp/ requires both on same line
      // This is a limitation - typical unittest code has them on separate lines
      // This test verifies the current regex behavior
      const input = createWriteInput(
        '/project/tests/test_user_service.py',
        'class TestUserService: def setUp(self): pass'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('catches setUp on different line (multiline matching)', () => {
      // Arrange - Typical unittest pattern with setUp on different line
      // Regex /class Test[\s\S]{0,200}setUp/ matches across newlines
      const input = createWriteInput(
        '/project/tests/test_user_service.py',
        `
class TestUserService:
    def setUp(self):
        self.user = create_user()
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert - Now correctly catches multiline unittest patterns
      expect(result.continue).toBe(false);
    });

    test('allows pytest fixtures in Python tests', () => {
      // Arrange
      const input = createWriteInput(
        '/project/tests/test_user.py',
        `
import pytest

@pytest.fixture
def user():
    return create_user()

def test_user(user):
    assert user.name is not None
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AI Integration patterns - IDs around LLM
  // ---------------------------------------------------------------------------

  describe('AI Integration - IDs around LLM', () => {
    test('blocks database IDs in prompts', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/llm/prompts.py',
        `
def create_prompt(user):
    return f"Process user {user.id} with name {user.name}"
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows prompt without IDs', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/llm/prompts.py',
        `
def create_prompt(user):
    return f"Process user with name {user.name}"
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AI Integration patterns - Timeout protection
  // ---------------------------------------------------------------------------

  describe('AI Integration - Timeout protection', () => {
    test('blocks LLM call without timeout (Python)', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/ai/service.py',
        `
async def generate(prompt):
    response = await openai.chat.completions.create(messages=[{"content": prompt}])
    return response
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows LLM call with asyncio.timeout', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/ai/service.py',
        `
async def generate(prompt):
    async with asyncio.timeout(30):
        response = await openai.chat.completions.create(messages=[{"content": prompt}])
    return response
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows LLM call with asyncio.wait_for', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/backend/app/ai/service.py',
        `
async def generate(prompt):
    response = await asyncio.wait_for(
        openai.chat.completions.create(messages=[{"content": prompt}]),
        timeout=30
    )
    return response
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('blocks LLM call without timeout (TypeScript)', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/ai/service.ts',
        `
async function generate(prompt: string) {
  const response = await llm.complete(prompt);
  return response;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows LLM call with Promise.race', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/frontend/src/ai/service.ts',
        `
async function generate(prompt: string) {
  const response = await Promise.race([
    llm.complete(prompt),
    timeout(30000)
  ]);
  return response;
}
`
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Path detection for file types
  // ---------------------------------------------------------------------------

  describe('path detection', () => {
    test.each([
      ['/test/project/backend/app/routers/user.py', true],
      ['/test/project/api/routers/user.py', true],
      ['/test/project/app/services/user.py', false], // No backend/ or api/
      ['/test/project/backend/app/models.py', false], // Not in routers/
    ])('backend Python path detection for %s: %s', (path, shouldTrigger) => {
      // Arrange
      const input = createWriteInput(
        path,
        'from repositories.user import UserRepository'
      );

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      if (shouldTrigger && path.includes('/routers/')) {
        expect(result.continue).toBe(false);
      }
    });

    test.each([
      ['/test/project/frontend/src/App.tsx', true],
      ['/test/project/src/components/Button.tsx', true],
      ['/test/project/backend/app/main.py', false],
    ])('frontend TypeScript path detection for %s: %s', (path, isFrontend) => {
      // Arrange
      const content = 'const x: React.FC<Props> = () => null;';
      const input = createWriteInput(path, content);

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      if (isFrontend) {
        expect(result.continue).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles tool_result as content source', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Edit',
        session_id: 'test-session-123',
        project_dir: '/test/project',
        tool_input: {
          file_path: '/test/project/backend/app/routers/user.py',
        },
        tool_result: 'from repositories.user import UserRepository',
      };

      // Act
      const result = patternConsistencyEnforcer(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('uses getRepoRoot with getProjectDir fallback', () => {
      // Arrange
      vi.mocked(getRepoRoot).mockReturnValue('');
      vi.mocked(getProjectDir).mockReturnValue('/fallback/project');
      vi.mocked(existsSync).mockImplementation((path) =>
        (path as string).includes('/fallback/project')
      );

      const input = createWriteInput('/fallback/project/file.py', 'content');

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      expect(existsSync).toHaveBeenCalledWith(
        expect.stringContaining('/fallback/project')
      );
    });

    test('warning output includes file path', () => {
      // Arrange
      const input = createWriteInput(
        '/test/project/tests/test_user.py',
        'def test_user(): pass'
      );

      // Act
      patternConsistencyEnforcer(input);

      // Assert
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('test_user.py');
    });
  });
});

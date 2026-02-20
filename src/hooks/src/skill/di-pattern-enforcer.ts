/**
 * DI Pattern Enforcer Hook
 * BLOCKING: Enforce dependency injection patterns in FastAPI
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import { basename } from 'node:path';

/**
 * Enforce dependency injection patterns in FastAPI routers
 */
export function diPatternEnforcer(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || '';
  const content = input.tool_input?.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Only validate Python files in routers/
  if (!(filePath.includes('/routers/') && filePath.endsWith('.py'))) {
    return outputSilentSuccess();
  }

  // Skip deps.py and dependencies.py (these define the DI functions)
  const filename = basename(filePath);
  if (/^(deps|dependencies|__init__)\.py$/.test(filename)) {
    return outputSilentSuccess();
  }

  const errors: string[] = [];

  // Rule: No direct service/repository instantiation
  // Use line-by-line string checks to avoid ReDoS from [a-zA-Z]*Service patterns
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.includes('Service(') && /=\s*\w+Service\s*\(/.test(trimmed)) {
      errors.push('INSTANTIATION: Direct service instantiation not allowed');
      errors.push('  Use dependency injection:');
      errors.push('    service: MyService = Depends(get_my_service)');
      break;
    }
    if ((trimmed.includes('Repository(') || trimmed.includes('Repo(')) && /=\s*\w+(Repository|Repo)\s*\(/.test(trimmed)) {
      errors.push('INSTANTIATION: Direct repository instantiation not allowed');
      errors.push('  Use dependency injection:');
      errors.push('    repo: MyRepository = Depends(get_my_repository)');
      break;
    }
  }

  // Rule: No global service/repository instances
  if (/^[a-z_]+\s*=\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)\s*\(/m.test(content)) {
    errors.push('GLOBAL: Global service/repository instance not allowed');
    errors.push('  ');
    errors.push('  Global instances cause:');
    errors.push('    - Shared state between requests');
    errors.push('    - Difficult testing');
    errors.push('    - Connection pool issues');
    errors.push('  ');
    errors.push('  Use Depends() for request-scoped instances');
  }

  // Rule: Database session must use Depends()
  if ((content.includes('Session') || content.includes('AsyncSession')) && content.includes(')')) {
    if (!content.includes('= Depends')) {
      errors.push('DI: Database session must use Depends()');
      errors.push('  ');
      errors.push('  BAD:  async def get_users(db: AsyncSession):');
      errors.push('  GOOD: async def get_users(db: AsyncSession = Depends(get_db)):');
    }
  }

  // Rule: Route handlers should use Depends for typed dependencies
  if (content.includes('@router.')) {
    const hasTypedDep = content.includes('Service') || content.includes('Repository') || content.includes('Repo');
    if (hasTypedDep && !content.includes('= Depends')) {
      errors.push('DI: Service/Repository parameters must use Depends()');
      errors.push('  ');
      errors.push('  BAD:  async def create_user(user_service: UserService):');
      errors.push('  GOOD: async def create_user(user_service: UserService = Depends(get_user_service)):');
    }
  }

  // Rule: No sync DB calls in async functions
  if (/async def/.test(content)) {
    // Check for db.query() - sync SQLAlchemy 1.x pattern
    if (content.includes('db.query(')) {
      if (!content.includes('await') || !content.split('\n').some((l: string) => l.includes('await') && l.includes('db.query('))) {
        errors.push('ASYNC: Sync database call in async function');
        errors.push('  Found: db.query() (sync pattern)');
        errors.push('  ');
        errors.push('  Use async SQLAlchemy 2.0 patterns:');
        errors.push('    result = await db.execute(select(User))');
        errors.push('    users = result.scalars().all()');
      }
    }

    // Check for session methods that should be awaited
    const syncPattern = /db\.(add|delete|commit|flush|rollback|refresh)\(/;
    if (syncPattern.test(content)) {
      if (/AsyncSession/.test(content)) {
        // Check if await is used with these methods
        const lines = content.split('\n');
        for (const line of lines) {
          if (syncPattern.test(line) && !line.includes('await')) {
            errors.push('ASYNC: Missing await for async database operation');
            errors.push('  ');
            errors.push('  With AsyncSession, use await:');
            errors.push('    await db.commit()');
            errors.push('    await db.refresh(user)');
            break;
          }
        }
      }
    }
  }

  // Report errors and block
  if (errors.length > 0) {
    logHook('di-pattern-enforcer', `BLOCKED: DI violation in ${filePath}`);
    const ctx = `Dependency injection violation in ${filePath}. See stderr for details.`;
    return outputWithContext(ctx);
  }

  return outputSilentSuccess();
}

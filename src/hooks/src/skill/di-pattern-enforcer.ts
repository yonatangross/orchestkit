/**
 * DI Pattern Enforcer Hook
 * BLOCKING: Enforce dependency injection patterns in FastAPI
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';

/**
 * Enforce dependency injection patterns in FastAPI routers
 */
export function diPatternEnforcer(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || '';
  const content = input.tool_input?.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Only validate Python files in routers/
  if (!/\/routers\/.*\.py$/.test(filePath)) {
    return outputSilentSuccess();
  }

  // Skip deps.py and dependencies.py (these define the DI functions)
  const filename = filePath.split('/').pop() || '';
  if (/^(deps|dependencies|__init__)\.py$/.test(filename)) {
    return outputSilentSuccess();
  }

  const errors: string[] = [];

  // Rule: No direct service/repository instantiation
  if (/=\s*[A-Z][a-zA-Z]*Service\s*\(\s*\)/.test(content)) {
    const match = content.match(/[A-Z][a-zA-Z]*Service\s*\(\s*\)/);
    errors.push('INSTANTIATION: Direct service instantiation not allowed');
    errors.push(`  Found: ${match?.[0] || 'Service()'}`);
    errors.push('  ');
    errors.push('  Use dependency injection:');
    errors.push('    service: MyService = Depends(get_my_service)');
  }

  if (/=\s*[A-Z][a-zA-Z]*(Repository|Repo)\s*\(\s*\)/.test(content)) {
    const match = content.match(/[A-Z][a-zA-Z]*(Repository|Repo)\s*\(\s*\)/);
    errors.push('INSTANTIATION: Direct repository instantiation not allowed');
    errors.push(`  Found: ${match?.[0] || 'Repository()'}`);
    errors.push('  ');
    errors.push('  Use dependency injection:');
    errors.push('    repo: MyRepository = Depends(get_my_repository)');
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
  if (/:\s*(Async)?Session[^=]*\)/.test(content)) {
    if (!/:\s*(Async)?Session\s*=\s*Depends/.test(content)) {
      errors.push('DI: Database session must use Depends()');
      errors.push('  ');
      errors.push('  BAD:  async def get_users(db: AsyncSession):');
      errors.push('  GOOD: async def get_users(db: AsyncSession = Depends(get_db)):');
    }
  }

  // Rule: Route handlers should use Depends for typed dependencies
  if (/@router\.(get|post|put|patch|delete)/.test(content)) {
    if (/:\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)[^=)]*\)/.test(content)) {
      if (!/:\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)\s*=\s*Depends/.test(content)) {
        errors.push('DI: Service/Repository parameters must use Depends()');
        errors.push('  ');
        errors.push('  BAD:  async def create_user(user_service: UserService):');
        errors.push('  GOOD: async def create_user(user_service: UserService = Depends(get_user_service)):');
      }
    }
  }

  // Rule: No sync DB calls in async functions
  if (/async def/.test(content)) {
    // Check for db.query() - sync SQLAlchemy 1.x pattern
    if (/db\.query\(/.test(content)) {
      if (!/await.*db\.query\(/.test(content)) {
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

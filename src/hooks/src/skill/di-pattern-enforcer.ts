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
  if (content.includes('Service()') && /=\s*[A-Z]/.test(content)) {
    // Extract class name: find "XxxService()" pattern without regex backtracking
    const serviceIdx = content.indexOf('Service()');
    let className = 'Service()';
    if (serviceIdx > 0) {
      const before = content.substring(Math.max(0, serviceIdx - 50), serviceIdx + 9);
      const parts = before.split(/[^A-Za-z]/);
      const last = parts.filter((p: string) => p.endsWith('Service')).pop();
      if (last) className = `${last}()`;
    }
    errors.push('INSTANTIATION: Direct service instantiation not allowed');
    errors.push(`  Found: ${className}`);
    errors.push('  ');
    errors.push('  Use dependency injection:');
    errors.push('    service: MyService = Depends(get_my_service)');
  }

  if ((content.includes('Repository()') || content.includes('Repo()')) && /=\s*[A-Z]/.test(content)) {
    // Extract class name without regex backtracking
    const repoIdx = content.indexOf('Repository()') !== -1 ? content.indexOf('Repository()') : content.indexOf('Repo()');
    let className = 'Repository()';
    if (repoIdx > 0) {
      const before = content.substring(Math.max(0, repoIdx - 50), repoIdx + 15);
      const parts = before.split(/[^A-Za-z]/);
      const last = parts.filter((p: string) => p.endsWith('Repository') || p.endsWith('Repo')).pop();
      if (last) className = `${last}()`;
    }
    errors.push('INSTANTIATION: Direct repository instantiation not allowed');
    errors.push(`  Found: ${className}`);
    errors.push('  ');
    errors.push('  Use dependency injection:');
    errors.push('    repo: MyRepository = Depends(get_my_repository)');
  }

  // Rule: No global service/repository instances
  if ((content.includes('Service(') || content.includes('Repository(') || content.includes('Repo(')) &&
      /^[a-z_]+\s*=\s*[A-Z]/m.test(content)) {
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
    if (!/:\s*(Async)?Session\s*=\s*Depends/.test(content)) {
      errors.push('DI: Database session must use Depends()');
      errors.push('  ');
      errors.push('  BAD:  async def get_users(db: AsyncSession):');
      errors.push('  GOOD: async def get_users(db: AsyncSession = Depends(get_db)):');
    }
  }

  // Rule: Route handlers should use Depends for typed dependencies
  if (/@router\.(get|post|put|patch|delete)/.test(content)) {
    if ((content.includes('Service') || content.includes('Repository') || content.includes('Repo')) &&
        /:\s*[A-Z]/.test(content)) {
      if (!content.includes('= Depends')) {
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
      if (!(content.includes('await') && content.includes('db.query('))) {
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

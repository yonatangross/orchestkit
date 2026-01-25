/**
 * Backend Layer Validator Hook
 * BLOCKING: Enforce layer separation in FastAPI
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';
import { guardPythonFiles } from '../lib/guards.js';

/**
 * Validate FastAPI layer architecture rules
 */
export function backendLayerValidator(input: HookInput): HookResult {
  // Self-guard: Only run for Python files
  const guard = guardPythonFiles(input);
  if (guard) return guard;

  const filePath = input.tool_input.file_path;
  const content = input.tool_input.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  const errors: string[] = [];

  // Router layer violations
  if (filePath.includes('/routers/')) {
    // Rule: No direct database operations in routers
    if (/db\.(add|delete|commit|flush|rollback|refresh|execute|scalar)/.test(content)) {
      errors.push('DATABASE: Direct database operations not allowed in routers');
    }

    // Rule: No SQLAlchemy imports
    if (/^from sqlalchemy import/m.test(content)) {
      errors.push('IMPORT: SQLAlchemy imports not allowed in routers');
    }
  }

  // Service layer violations
  if (filePath.includes('/services/')) {
    // Rule: No HTTP exception handling
    if (/HTTPException\s*\(/.test(content)) {
      errors.push('HTTP: HTTPException not allowed in services - use domain exceptions');
    }

    // Rule: No FastAPI Request/Response objects
    if (/from fastapi import.*(Request|Response)/.test(content)) {
      errors.push('HTTP: Request/Response types not allowed in services');
    }
  }

  // Repository layer violations
  if (filePath.includes('/repositories/')) {
    // Rule: No HTTP exceptions
    if (/HTTPException/.test(content)) {
      errors.push('HTTP: HTTPException not allowed in repositories');
    }

    // Rule: No service/router imports
    if (/from.*(services|routers).*import/.test(content)) {
      errors.push('IMPORT: Repositories cannot import from services or routers');
    }
  }

  // Report errors
  if (errors.length > 0) {
    const filename = filePath.split('/').pop() || filePath;
    const reason = `Layer violation in ${filename}: ${errors[0]}`;
    logHook('backend-layer-validator', `BLOCKED: ${reason}`);
    return outputBlock(reason);
  }

  return outputSilentSuccess();
}

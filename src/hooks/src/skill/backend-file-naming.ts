/**
 * Backend File Naming Hook
 * BLOCKING: Backend files must follow naming conventions
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';
import { guardPythonFiles } from '../lib/guards.js';

/**
 * Validate backend Python file naming conventions
 */
export function backendFileNaming(input: HookInput): HookResult {
  // Self-guard: Only run for Python files
  const guard = guardPythonFiles(input);
  if (guard) return guard;

  const filePath = input.tool_input.file_path;
  if (!filePath) return outputSilentSuccess();

  // Skip if not in an app/ or backend/ directory
  if (!filePath.includes('/app/') && !filePath.includes('/backend/')) {
    return outputSilentSuccess();
  }

  const filename = filePath.split('/').pop() || '';
  const dirname = filePath.substring(0, filePath.lastIndexOf('/'));
  const errors: string[] = [];

  // Skip __init__.py files
  if (filename === '__init__.py') return outputSilentSuccess();

  // Router naming conventions
  if (dirname.endsWith('/routers') || dirname.includes('/routers/')) {
    const validRouterPattern = /^(router_|routes_|api_).*\.py$/;
    const utilPattern = /^(deps|dependencies|utils|helpers|base)\.py$/;
    if (!validRouterPattern.test(filename) && !utilPattern.test(filename)) {
      errors.push('ROUTER NAMING: Files in routers/ must be prefixed');
      errors.push(`  Got: ${filename}`);
      errors.push('  Expected: router_*.py, routes_*.py, api_*.py, deps.py');
    }
  }

  // Service naming conventions
  if (dirname.endsWith('/services') || dirname.includes('/services/')) {
    const validServicePattern = /_service\.py$/;
    const utilPattern = /^(base|utils|helpers|abstract)\.py$/;
    if (!validServicePattern.test(filename) && !utilPattern.test(filename)) {
      errors.push('SERVICE NAMING: Files in services/ must end with _service.py');
      errors.push(`  Got: ${filename}`);
      errors.push('  Expected: *_service.py, base.py, utils.py');
    }
  }

  // Repository naming conventions
  if (dirname.endsWith('/repositories') || dirname.includes('/repositories/')) {
    const validRepoPattern = /_(repository|repo)\.py$/;
    const utilPattern = /^(base|abstract|utils)\.py$/;
    if (!validRepoPattern.test(filename) && !utilPattern.test(filename)) {
      errors.push('REPOSITORY NAMING: Files in repositories/ must end with _repository.py');
      errors.push(`  Got: ${filename}`);
      errors.push('  Expected: *_repository.py, *_repo.py, base.py');
    }
  }

  // Schema naming conventions
  if (dirname.endsWith('/schemas') || dirname.includes('/schemas/')) {
    const validSchemaPattern = /_(schema|dto|request|response)\.py$/;
    const utilPattern = /^(base|common|shared|utils)\.py$/;
    if (!validSchemaPattern.test(filename) && !utilPattern.test(filename)) {
      errors.push('SCHEMA NAMING: Files in schemas/ must use proper suffix');
      errors.push(`  Got: ${filename}`);
      errors.push('  Expected: *_schema.py, *_dto.py, *_request.py, *_response.py');
    }
  }

  // Model naming conventions
  if (dirname.endsWith('/models') || dirname.includes('/models/')) {
    const validModelPattern = /_(model|entity|orm)\.py$/;
    const utilPattern = /^(base|abstract|mixins)\.py$/;
    if (!validModelPattern.test(filename) && !utilPattern.test(filename)) {
      errors.push('MODEL NAMING: Files in models/ must use proper suffix');
      errors.push(`  Got: ${filename}`);
      errors.push('  Expected: *_model.py, *_entity.py, *_orm.py, base.py');
    }
  }

  // General Python naming conventions - PascalCase check
  if (/^[A-Z][a-zA-Z]+\.py$/.test(filename)) {
    errors.push('NAMING: Python files should use snake_case, not PascalCase');
    errors.push(`  Got: ${filename}`);
  }

  // Report errors and block
  if (errors.length > 0) {
    const reason = `Backend naming violation in ${filename}: ${errors[0]}`;
    logHook('backend-file-naming', `BLOCKED: ${reason}`);
    return outputBlock(reason);
  }

  return outputSilentSuccess();
}

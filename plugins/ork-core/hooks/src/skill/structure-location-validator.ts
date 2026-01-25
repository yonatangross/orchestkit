/**
 * Structure Location Validator Hook
 * BLOCKING: Files must be in correct architectural locations
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';
import { guardCodeFiles } from '../lib/guards.js';

const MAX_DEPTH = 4;

/**
 * Validate file structure and location
 */
export function structureLocationValidator(input: HookInput): HookResult {
  // Self-guard: Only run for code files
  const guard = guardCodeFiles(input);
  if (guard) return guard;

  const filePath = input.tool_input.file_path || '';
  if (!filePath) return outputSilentSuccess();

  const errors: string[] = [];
  const filename = filePath.split('/').pop() || '';

  // Rule: Max nesting depth (4 levels from src/ or app/)
  if (filePath.includes('/src/') || filePath.includes('/app/')) {
    let relativePath = '';
    if (filePath.includes('/src/')) {
      relativePath = filePath.split('/src/')[1] || '';
    } else {
      relativePath = filePath.split('/app/')[1] || '';
    }

    const depth = relativePath.split('/').filter(Boolean).length;
    if (depth > MAX_DEPTH) {
      errors.push(`NESTING: Max depth exceeded - ${depth} levels (max: ${MAX_DEPTH})`);
    }
  }

  // Rule: No barrel files (index.ts that only re-export)
  if (/^index\.(ts|tsx|js)$/.test(filename)) {
    if (!filePath.includes('/app/') && !/\/(node_modules|dist|build)\//.test(filePath)) {
      errors.push('BARREL: Barrel files (index.ts) are discouraged - import directly from source');
    }
  }

  // React/TypeScript structure rules
  if (/\.(tsx|ts|jsx|js)$/.test(filePath)) {
    // Rule: React components (PascalCase) must be in components/ or features/
    if (/^[A-Z][a-zA-Z0-9]*\.(tsx|jsx)$/.test(filename)) {
      if (!/(components\/|features\/|app\/|pages\/)/.test(filePath)) {
        errors.push('COMPONENT: React components must be in components/, features/, or app/');
      }
    }

    // Rule: Custom hooks (useX) must be in hooks/ directory
    if (/^use[A-Z][a-zA-Z0-9]*\.(ts|tsx)$/.test(filename)) {
      if (!/(hooks\/|\/hooks\/)/.test(filePath)) {
        errors.push('HOOK: Custom hooks must be in hooks/ directory');
      }
    }
  }

  // FastAPI/Python structure rules
  if (filePath.endsWith('.py')) {
    const dirname = filePath.substring(0, filePath.lastIndexOf('/'));

    // Rule: Router files must be in routers/
    if (/^(router_|routes_|api_).*\.py$/.test(filename)) {
      if (!dirname.endsWith('/routers') && !dirname.endsWith('routers')) {
        errors.push('ROUTER: Router files must be in routers/ directory');
      }
    }

    // Rule: Service files must be in services/
    if (/_service\.py$/.test(filename)) {
      if (!dirname.endsWith('/services') && !dirname.endsWith('services')) {
        errors.push('SERVICE: Service files must be in services/ directory');
      }
    }

    // Rule: Repository files must be in repositories/
    if (/_(repository|repo)\.py$/.test(filename)) {
      if (!dirname.endsWith('/repositories') && !dirname.endsWith('repositories')) {
        errors.push('REPOSITORY: Repository files must be in repositories/ directory');
      }
    }
  }

  // Report errors and block
  if (errors.length > 0) {
    const reason = `Structure violation: ${errors[0]}`;
    logHook('structure-location-validator', `BLOCKED: ${reason}`);
    return outputBlock(reason);
  }

  return outputSilentSuccess();
}

/**
 * Import Direction Enforcer Hook
 * BLOCKING: Imports must follow unidirectional architecture
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../lib/common.js';
import { guardCodeFiles } from '../lib/guards.js';

/**
 * Determine the architectural layer of a file
 */
function getLayer(filePath: string): string | null {
  // TypeScript/JavaScript layers
  if (filePath.includes('/shared/')) return 'shared';
  if (filePath.includes('/lib/')) return 'lib';
  if (filePath.includes('/utils/')) return 'utils';
  if (filePath.includes('/components/') && !filePath.includes('/features/')) return 'components';
  if (filePath.includes('/hooks/') && !filePath.includes('/features/')) return 'hooks';
  if (filePath.includes('/features/')) return 'features';
  if (filePath.includes('/app/') || filePath.includes('/pages/')) return 'app';

  // Python layers
  if (filePath.includes('/repositories/')) return 'repositories';
  if (filePath.includes('/services/') && filePath.endsWith('.py')) return 'services';
  if (filePath.includes('/routers/')) return 'routers';

  return null;
}

/**
 * Enforce import direction rules
 */
export function importDirectionEnforcer(input: HookInput): HookResult {
  // Self-guard: Only run for code files
  const guard = guardCodeFiles(input);
  if (guard) return guard;

  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  const layer = getLayer(filePath);
  if (!layer) return outputSilentSuccess();

  const errors: string[] = [];

  // TypeScript/JavaScript import rules
  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    switch (layer) {
      case 'shared':
      case 'lib':
      case 'utils':
        if (/from ['"](@\/|\.\.\/)*(features|app)\//.test(content)) {
          errors.push(`${layer}/ cannot import from features/ or app/`);
        }
        break;

      case 'components':
      case 'hooks':
        if (/from ['"](@\/|\.\.\/)*(features|app)\//.test(content)) {
          errors.push(`${layer}/ cannot import from features/ or app/`);
        }
        break;

      case 'features':
        if (/from ['"](@\/|\.\.\/)*app\//.test(content)) {
          errors.push('features/ cannot import from app/');
        }
        break;
    }
  }

  // Python import rules
  if (filePath.endsWith('.py')) {
    switch (layer) {
      case 'repositories':
        if (/from (app\.)?(services|routers)/.test(content)) {
          errors.push('repositories/ cannot import from services/ or routers/');
        }
        break;

      case 'services':
        if (/from (app\.)?routers\.[a-z]/.test(content)) {
          if (!/from (app\.)?routers\.(deps|dependencies)/.test(content)) {
            errors.push('services/ cannot import from routers/');
          }
        }
        break;
    }
  }

  // Report errors
  if (errors.length > 0) {
    const filename = filePath.split('/').pop() || filePath;
    const reason = `Import direction violation in ${filename}: ${errors[0]}`;
    logHook('import-direction-enforcer', `BLOCKED: ${reason}`);
    return outputBlock(reason);
  }

  return outputSilentSuccess();
}

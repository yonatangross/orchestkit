/**
 * Pattern Consistency Enforcer Hook
 * BLOCKING: Enforce consistent patterns across all instances
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, getProjectDir } from '../lib/common.js';
import { getRepoRoot } from '../lib/git.js';

/**
 * Enforce pattern consistency across codebase
 */
export function patternConsistencyEnforcer(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  const projectRoot = getRepoRoot() || getProjectDir();
  const patternsFile = `${projectRoot}/.claude/context/knowledge/patterns/established.json`;

  // Skip if no patterns file
  if (!existsSync(patternsFile)) {
    return outputSilentSuccess();
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Backend pattern consistency (Python files)
  if (filePath.endsWith('.py') && (filePath.includes('/backend/') || filePath.includes('/api/'))) {
    // Check: Clean Architecture layers
    if (filePath.includes('/routers/')) {
      if (/from.*repositories.*import/.test(content)) {
        errors.push('PATTERN: Router imports repository directly');
        errors.push('  Established pattern: routers -> services -> repositories');
        errors.push('  Import from services/ layer instead');
      }
    }

    if (filePath.includes('/services/')) {
      if (/from.*routers.*import/.test(content)) {
        errors.push('PATTERN: Service imports router (circular dependency)');
        errors.push('  Established pattern: Services are independent of HTTP layer');
      }
    }

    // Check: Async SQLAlchemy pattern
    if (/from sqlalchemy import/.test(content)) {
      if (!/from sqlalchemy\.ext\.asyncio import/.test(content)) {
        if (/Session|sessionmaker/.test(content)) {
          errors.push('PATTERN: Using sync SQLAlchemy instead of async');
          errors.push('  Established pattern: All DB operations use async/await');
          errors.push('  Import: from sqlalchemy.ext.asyncio import AsyncSession');
        }
      }
    }

    // Check: Pydantic v2 validators
    if (/from pydantic import.*BaseModel/.test(content)) {
      if (/@validator\(/.test(content)) {
        errors.push('PATTERN: Using Pydantic v1 @validator decorator');
        errors.push('  Established pattern: Pydantic v2 with @field_validator');
        errors.push("  Update: @field_validator('field_name', mode='after')");
      }
      if (/@root_validator/.test(content)) {
        errors.push('PATTERN: Using Pydantic v1 @root_validator decorator');
        errors.push('  Established pattern: Pydantic v2 with @model_validator');
        errors.push("  Update: @model_validator(mode='after')");
      }
    }
  }

  // Frontend pattern consistency (TypeScript/JavaScript)
  if (/\.(ts|tsx|js|jsx)$/.test(filePath) && (filePath.includes('/frontend/') || filePath.includes('/src/'))) {
    // Check: React 19 function components
    if (/React\.FC</.test(content)) {
      errors.push('PATTERN: Using React.FC instead of explicit Props type');
      errors.push('  Established pattern: function Component(props: Props): React.ReactNode');
      errors.push('  Remove React.FC, use explicit function declaration');
    }

    // Check: Zod validation for API responses
    if (/fetch\(|axios\./.test(content)) {
      if (!/from ['"]zod['"]/.test(content)) {
        errors.push('PATTERN: API call without Zod validation');
        errors.push('  Established pattern: All API responses validated with Zod');
        errors.push("  Import: import { z } from 'zod'");
      }
    }

    // Check: React 19 APIs for forms
    if (/<form/.test(content)) {
      if (!/useFormStatus|useActionState|useOptimistic/.test(content)) {
        warnings.push('PATTERN: Form without React 19 form hooks');
        warnings.push('  Established pattern: Use useFormStatus for pending state');
        warnings.push('  Consider: useOptimistic for optimistic updates');
      }
    }

    // Check: Date formatting pattern
    if (/new Date.*toLocaleDateString|toLocaleString/.test(content)) {
      errors.push('PATTERN: Direct date formatting instead of centralized utility');
      errors.push('  Established pattern: Use @/lib/dates helpers');
      errors.push("  Import: import { formatDate, formatDateShort } from '@/lib/dates'");
    }
  }

  // Testing pattern consistency
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) || /test_.*\.py$/.test(filePath)) {
    // Check: AAA pattern presence
    if (!/\/\/ Arrange|\/\/ Act|\/\/ Assert|# Arrange|# Act|# Assert/i.test(content)) {
      warnings.push('PATTERN: AAA pattern comments missing');
      warnings.push('  Established pattern: Structure tests with Arrange-Act-Assert');
      warnings.push('  Add comments for clarity in complex tests');
    }

    // Check: MSW for API mocking (TypeScript)
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      if (/jest\.mock.*fetch|global\.fetch/.test(content)) {
        errors.push('PATTERN: Using jest.mock for fetch instead of MSW');
        errors.push('  Established pattern: Use MSW for API mocking');
        errors.push("  Import: import { http, HttpResponse } from 'msw'");
      }
    }

    // Check: Pytest fixtures (Python)
    if (filePath.endsWith('.py')) {
      if (/class Test.*setUp/.test(content)) {
        errors.push('PATTERN: Using unittest setUp instead of pytest fixtures');
        errors.push('  Established pattern: Use pytest fixtures');
        errors.push('  Convert: @pytest.fixture\\ndef setup_data():');
      }
    }
  }

  // AI Integration pattern consistency
  if (filePath.includes('/llm/') || filePath.includes('/ai/') || filePath.includes('/agent/')) {
    // Check: IDs flow around LLM
    if (/prompt.*\{.*id.*\}|f".*\{.*\.id\}.*"/.test(content)) {
      errors.push('PATTERN: Database IDs in LLM prompts');
      errors.push('  Established pattern: IDs flow around LLM, not through it');
      errors.push('  Pass IDs via metadata, join results after LLM processing');
    }

    // Check: Async timeout protection
    if (/await.*openai|await.*anthropic|await.*llm/.test(content)) {
      if (!/asyncio\.timeout|asyncio\.wait_for|Promise\.race/.test(content)) {
        errors.push('PATTERN: LLM call without timeout protection');
        errors.push('  Established pattern: Wrap all LLM calls with timeout');
        errors.push('  Python: async with asyncio.timeout(30):');
        errors.push('  TypeScript: await Promise.race([call, timeout])');
      }
    }
  }

  // Block on critical pattern violations
  if (errors.length > 0) {
    return outputBlock(`Pattern consistency violations detected in ${filePath}`);
  }

  // Warn about pattern drift (non-blocking)
  if (warnings.length > 0) {
    process.stderr.write('WARNING: Pattern consistency issues detected\n');
    process.stderr.write(`File: ${filePath}\n\n`);
    for (const warning of warnings) {
      process.stderr.write(`  ${warning}\n`);
    }
  }

  return outputSilentSuccess();
}

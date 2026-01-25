/**
 * Migration Validator Hook
 * Runs after Write for database-schema-designer skill
 * Validates alembic migration files
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';

/**
 * Validate alembic migration files
 */
export function migrationValidator(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || process.env.CC_TOOL_FILE_PATH || '';

  if (!filePath) return outputSilentSuccess();

  // Only check migration files
  if (!filePath.includes('alembic/versions') || !filePath.endsWith('.py')) {
    return outputSilentSuccess();
  }

  if (!existsSync(filePath)) {
    return outputSilentSuccess();
  }

  process.stderr.write(`::group::Migration Validation: ${filePath.split('/').pop()}\n`);

  const errors: string[] = [];
  let content: string;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    errors.push('Cannot read migration file');
    return outputWithContext(`Migration validation failed for ${filePath}`);
  }

  // Check for required functions
  if (!content.includes('def upgrade')) {
    errors.push('Missing upgrade() function in migration');
  }

  if (!content.includes('def downgrade')) {
    errors.push('Missing downgrade() function in migration');
  }

  // Check for revision ID
  if (!/^revision = /m.test(content)) {
    errors.push('Missing revision ID in migration');
  }

  // Validate syntax
  try {
    execSync(`python3 -m py_compile "${filePath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    errors.push('Python syntax error in migration');
  }

  // Report errors
  if (errors.length > 0) {
    process.stderr.write('::error::Migration validation failed\n');
    for (const error of errors) {
      process.stderr.write(`  - ${error}\n`);
    }
    process.stderr.write('::endgroup::\n');

    logHook('migration-validator', `BLOCKED: ${errors[0]}`);
    const ctx = `Migration validation failed for ${filePath}. See stderr for details.`;
    return outputWithContext(ctx);
  }

  process.stderr.write('Migration file is valid\n');
  process.stderr.write('::endgroup::\n');

  return outputSilentSuccess();
}

/**
 * Auto-Lint Hook - PostToolUse hook for Write/Edit
 * CC 2.1.7 Compliant
 *
 * Automatically runs linters after file writes:
 * - Python: ruff check + format (Astral toolchain)
 * - JS/TS: biome check (Rust-based)
 * - JSON/CSS: biome format
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, logHook } from '../lib/common.js';

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    default:
      return null;
  }
}

/**
 * Check if a command exists
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run auto-lint on written files
 */
export function autoLint(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only run for Write/Edit
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  // Skip internal files
  if (!filePath || filePath.includes('/.claude/') ||
      filePath.includes('/node_modules/') ||
      filePath.includes('/.git/') ||
      filePath.includes('/dist/') ||
      filePath.endsWith('.lock')) {
    return outputSilentSuccess();
  }

  // Check if file exists
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
  const fullPath = filePath.startsWith('/') ? filePath : `${projectDir}/${filePath}`;

  if (!existsSync(fullPath)) {
    return outputSilentSuccess();
  }

  // Skip if SKIP_AUTO_LINT is set
  if (process.env.SKIP_AUTO_LINT === '1') {
    return outputSilentSuccess();
  }

  const language = getLanguage(filePath);
  if (!language) {
    return outputSilentSuccess();
  }

  let lintIssues = 0;
  let fixesApplied = false;

  try {
    switch (language) {
      case 'python':
        if (commandExists('ruff')) {
          try {
            const ruffCheck = execSync(`timeout 5s ruff check --output-format=concise "${fullPath}" 2>&1`, {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            if (ruffCheck) {
              lintIssues = ruffCheck.split('\n').filter(Boolean).length;
              execSync(`timeout 5s ruff check --fix --unsafe-fixes=false "${fullPath}" 2>/dev/null`, {
                stdio: 'ignore',
              });
              fixesApplied = true;
            }
          } catch {
            // ruff check returns non-zero when issues found
          }
          try {
            execSync(`timeout 5s ruff format "${fullPath}" 2>/dev/null`, { stdio: 'ignore' });
          } catch {
            // Ignore format errors
          }
        }
        break;

      case 'typescript':
      case 'javascript':
        if (commandExists('biome')) {
          try {
            const biomeOut = execSync(`timeout 5s biome check --write "${fullPath}" 2>&1`, {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            if (biomeOut.includes('Fixed')) {
              fixesApplied = true;
            }
            if (biomeOut.includes('error')) {
              lintIssues = (biomeOut.match(/error/g) || []).length;
            }
          } catch {
            // Ignore biome errors
          }
        }
        break;

      case 'json':
      case 'css':
        if (commandExists('biome')) {
          try {
            execSync(`timeout 5s biome format --write "${fullPath}" 2>/dev/null`, {
              stdio: 'ignore',
            });
            fixesApplied = true;
          } catch {
            // Ignore format errors
          }
        }
        break;
    }
  } catch (error) {
    logHook('auto-lint', `Error: ${error}`);
  }

  // Build output message
  if (fixesApplied && lintIssues > 0) {
    const basename = filePath.split('/').pop();
    return {
      continue: true,
      systemMessage: `Auto-lint: fixed issues, ${lintIssues} remaining in ${basename}`,
    };
  }

  return outputSilentSuccess();
}

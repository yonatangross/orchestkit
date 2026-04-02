/**
 * Auto-Lint Hook - PostToolUse format-on-save for Write/Edit
 * CC 2.1.90: Safe to modify files in PostToolUse — "File content has changed" race fixed
 *
 * Automatically formats files after writes:
 * - Python: ruff check + format (Astral toolchain)
 * - JS/TS: biome check --write, falls back to prettier --write
 * - JSON/CSS: biome format --write, falls back to prettier --write
 *
 * Toggle off: SKIP_AUTO_LINT=1
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, logHook } from '../lib/common.js';
import { basename } from 'node:path';
import { assertSafeCommandName, assertSafeShellArg } from '../lib/sanitize-shell.js';

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
    assertSafeCommandName(cmd);
    execFileSync('which', [cmd], { stdio: 'ignore' });
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
  // Defense in depth: resolve relative paths even though CC >= 2.1.88 guarantees absolute
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
  const safePath = assertSafeShellArg(fullPath, 'file path');

  try {
    switch (language) {
      case 'python':
        if (commandExists('ruff')) {
          try {
            const ruffCheck = execFileSync('ruff', ['check', '--output-format=concise', safePath], {
              encoding: 'utf8',
              timeout: 5000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            if (ruffCheck) {
              lintIssues = ruffCheck.split('\n').filter(Boolean).length;
              execFileSync('ruff', ['check', '--fix', '--unsafe-fixes=false', safePath], {
                stdio: 'ignore',
                timeout: 5000,
              });
              fixesApplied = true;
            }
          } catch {
            // ruff check returns non-zero when issues found
          }
          try {
            execFileSync('ruff', ['format', safePath], { stdio: 'ignore', timeout: 5000 });
          } catch {
            // Ignore format errors
          }
        }
        break;

      case 'typescript':
      case 'javascript':
        if (commandExists('biome')) {
          try {
            const biomeOut = execFileSync('biome', ['check', '--write', safePath], {
              encoding: 'utf8',
              timeout: 5000,
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
        } else if (commandExists('prettier')) {
          try {
            execFileSync('prettier', ['--write', safePath], {
              stdio: 'ignore',
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore prettier errors
          }
        }
        break;

      case 'json':
      case 'css':
        if (commandExists('biome')) {
          try {
            execFileSync('biome', ['format', '--write', safePath], {
              stdio: 'ignore',
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore format errors
          }
        } else if (commandExists('prettier')) {
          try {
            execFileSync('prettier', ['--write', safePath], {
              stdio: 'ignore',
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore prettier errors
          }
        }
        break;
    }
  } catch (error) {
    logHook('auto-lint', `Error: ${error}`);
  }

  // Build output message
  if (fixesApplied && lintIssues > 0) {
    const fileBasename = basename(filePath);
    return {
      continue: true,
      systemMessage: `Auto-lint: fixed issues, ${lintIssues} remaining in ${fileBasename}`,
    };
  }

  return outputSilentSuccess();
}

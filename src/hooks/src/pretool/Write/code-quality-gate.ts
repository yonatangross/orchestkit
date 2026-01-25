/**
 * Code Quality Gate Hook
 * Unified code quality checks before write
 * Consolidates: complexity-gate.sh + type-check-on-save.sh
 *
 * Analyzes code quality BEFORE allowing write:
 * - Checks function length (>50 lines = warning)
 * - Checks cyclomatic complexity patterns (nested if/loops)
 * - Checks for existing type errors in the file being modified (cached results)
 *
 * CC 2.1.9 Compliant: Uses additionalContext for quality warnings
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  getProjectDir,
} from '../../lib/common.js';
import { guardCodeFiles, guardSkipInternal, runGuards } from '../../lib/guards.js';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';

// Thresholds
const MAX_FUNCTION_LINES = 50;
const MAX_NESTING_DEPTH = 4;
const MAX_CONDITIONALS_PER_FUNCTION = 10;

/**
 * Get file extension in lowercase
 */
function getFileExt(filePath: string): string {
  return extname(filePath).toLowerCase().replace('.', '');
}

/**
 * Check for long functions in the content
 */
function checkFunctionLength(content: string, ext: string): string[] {
  const warnings: string[] = [];
  const lines = content.split('\n');

  if (ext === 'py') {
    // Python: Track function definitions and line counts
    let inFunction = false;
    let functionName = '';
    let functionLines = 0;

    for (const line of lines) {
      const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      const classMatch = line.match(/^(\s*)class\s+/);

      if (defMatch) {
        // Check previous function if too long
        if (inFunction && functionLines > MAX_FUNCTION_LINES) {
          warnings.push(`Function '${functionName}' is ${functionLines} lines (max: ${MAX_FUNCTION_LINES})`);
        }

        inFunction = true;
        functionName = defMatch[2];
        functionLines = 1;
      } else if (classMatch) {
        // Class definition resets function tracking
        if (inFunction && functionLines > MAX_FUNCTION_LINES) {
          warnings.push(`Function '${functionName}' is ${functionLines} lines (max: ${MAX_FUNCTION_LINES})`);
        }
        inFunction = false;
      } else if (inFunction) {
        // Count non-empty lines in function
        if (line.trim()) {
          functionLines++;
        }
      }
    }

    // Check last function
    if (inFunction && functionLines > MAX_FUNCTION_LINES) {
      warnings.push(`Function '${functionName}' is ${functionLines} lines (max: ${MAX_FUNCTION_LINES})`);
    }
  } else if (['ts', 'tsx', 'js', 'jsx', 'go', 'java', 'rs'].includes(ext)) {
    // Brace-based languages: Count lines between braces
    let braceCount = 0;
    let functionLines = 0;
    let inFunction = false;
    let functionName = '';

    for (const line of lines) {
      // Function detection
      const funcMatch = line.match(/(?:function|func|fn)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      const constFuncMatch = line.match(/const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\(/);

      if (funcMatch) {
        functionName = funcMatch[1];
        inFunction = true;
        functionLines = 0;
        braceCount = 0;
      } else if (constFuncMatch) {
        functionName = constFuncMatch[1];
        inFunction = true;
        functionLines = 0;
        braceCount = 0;
      }

      if (inFunction) {
        // Count braces
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        braceCount += openBraces - closeBraces;

        if (line.trim()) {
          functionLines++;
        }

        // Function ended
        if (braceCount <= 0 && functionLines > 0) {
          if (functionLines > MAX_FUNCTION_LINES) {
            warnings.push(`Function '${functionName}' is ${functionLines} lines (max: ${MAX_FUNCTION_LINES})`);
          }
          inFunction = false;
        }
      }
    }
  }

  return warnings;
}

/**
 * Check for deep nesting (cyclomatic complexity indicator)
 */
function checkNestingDepth(content: string, ext: string): string[] {
  const warnings: string[] = [];
  const lines = content.split('\n');
  let maxDepth = 0;

  if (ext === 'py') {
    // Python: Count indent levels at control structures
    for (const line of lines) {
      const match = line.match(/^(\s*)(if|for|while|with|try|elif|else|except|finally)[\s:]/);
      if (match) {
        const indent = match[1].length;
        const depth = Math.floor(indent / 4); // Assume 4-space indent
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }
    }
  } else if (['ts', 'tsx', 'js', 'jsx', 'go', 'java', 'rs'].includes(ext)) {
    // Brace-based: Count brace depth at control structures
    let braceDepth = 0;
    for (const line of lines) {
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      // Check if this line has a control structure
      if (/(?:if|for|while|switch|try)\s*\(/.test(line)) {
        if (braceDepth > maxDepth) {
          maxDepth = braceDepth;
        }
      }
    }
  }

  if (maxDepth > MAX_NESTING_DEPTH) {
    warnings.push(`Deep nesting detected (depth: ${maxDepth}, max: ${MAX_NESTING_DEPTH})`);
  }

  return warnings;
}

/**
 * Count conditionals (cyclomatic complexity heuristic)
 */
function checkConditionals(content: string): string[] {
  const warnings: string[] = [];

  const ifCount = (content.match(/\b(if|elif|else if)\b/g) || []).length;
  const switchCount = (content.match(/\b(switch|match)\b/g) || []).length;
  const ternaryCount = (content.match(/\?[^:]+:/g) || []).length;

  const totalConditionals = ifCount + switchCount + ternaryCount;

  // Estimate functions
  const functionCount = Math.max((content.match(/\b(def|function|func|fn)\b/g) || []).length, 1);
  const avgConditionals = Math.floor(totalConditionals / functionCount);

  if (avgConditionals > MAX_CONDITIONALS_PER_FUNCTION) {
    warnings.push(`High cyclomatic complexity (~${avgConditionals} conditionals/function, consider refactoring)`);
  }

  return warnings;
}

/**
 * Get cached type errors for a file
 */
function getCachedTypeErrors(filePath: string, projectDir: string): string {
  const cacheFile = join(projectDir, '.claude', 'cache', 'type-errors.json');

  if (!existsSync(cacheFile)) {
    return '';
  }

  try {
    const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
    const basename = filePath.split('/').pop() || '';
    return cache[basename] || '';
  } catch {
    return '';
  }
}

/**
 * Code quality gate - analyzes quality before allowing write
 */
export function codeQualityGate(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || '';
  const projectDir = input.project_dir || getProjectDir();

  // Apply guards
  const guardResult = runGuards(input, guardCodeFiles, guardSkipInternal);
  if (guardResult !== null) {
    return guardResult;
  }

  if (!filePath || !content) {
    return outputSilentSuccess();
  }

  const ext = getFileExt(filePath);
  const allWarnings: string[] = [];

  // Run complexity checks
  allWarnings.push(...checkFunctionLength(content, ext));
  allWarnings.push(...checkNestingDepth(content, ext));
  allWarnings.push(...checkConditionals(content));

  // Check cached type errors
  const typeErrors = getCachedTypeErrors(filePath, projectDir);
  if (typeErrors) {
    allWarnings.push(typeErrors);
  }

  // Build quality message
  if (allWarnings.length > 0) {
    logHook('code-quality-gate', `Quality warnings for ${filePath}: ${allWarnings.join(', ')}`);

    let qualityMsg = `Code quality: ${allWarnings.join(' | ')}`;

    // Truncate if too long
    if (qualityMsg.length > 350) {
      qualityMsg = qualityMsg.slice(0, 347) + '...';
    }

    return outputWithContext(qualityMsg);
  }

  logHook('code-quality-gate', `No quality issues in ${filePath}`);
  return outputSilentSuccess();
}

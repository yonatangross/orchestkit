/**
 * Docstring Enforcer Hook
 * Checks if public functions have docstrings
 * For Python: checks for triple-quote docstrings
 * For TypeScript: checks for JSDoc comments
 *
 * CC 2.1.9 Enhanced: Uses additionalContext for warnings (does not block)
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
} from '../../lib/common.js';
import { guardCodeFiles, guardSkipInternal, runGuards } from '../../lib/guards.js';
import { extname } from 'node:path';

/**
 * Get file extension in lowercase
 */
function getFileExt(filePath: string): string {
  return extname(filePath).toLowerCase().replace('.', '');
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  const testPatterns = [
    /test/i,
    /spec/i,
    /__tests__/i,
    /_test\.py$/,
    /\.test\.ts$/,
    /\.spec\.ts$/,
  ];
  return testPatterns.some((p) => p.test(filePath));
}

/**
 * Find Python functions missing docstrings
 */
function findMissingPythonDocstrings(content: string): string[] {
  const missing: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match public function definitions (not starting with _)
    const funcMatch = line.match(/^(?:\s*)(?:async\s+)?def\s+([^_][a-zA-Z0-9_]*)\s*\(/);

    if (funcMatch) {
      const funcName = funcMatch[1];

      // Look for docstring on next non-empty line
      let hasDocstring = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) continue; // Skip empty lines

        if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
          hasDocstring = true;
        }
        break;
      }

      if (!hasDocstring) {
        missing.push(funcName);
        if (missing.length >= 5) break; // Limit to 5
      }
    }
  }

  return missing;
}

/**
 * Find TypeScript/JavaScript exported functions missing JSDoc
 */
function findMissingJSDoc(content: string): string[] {
  const missing: string[] = [];
  const lines = content.split('\n');

  let hasJSDoc = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1].trim() : '';

    // Check if previous line ends JSDoc
    if (prevLine.endsWith('*/')) {
      hasJSDoc = true;
    }

    // Check for exported function
    const exportMatch = line.match(
      /^export\s+(?:async\s+)?(?:function\s+([a-zA-Z][a-zA-Z0-9_]*)|const\s+([a-zA-Z][a-zA-Z0-9_]*)\s*=)/
    );

    if (exportMatch) {
      const funcName = exportMatch[1] || exportMatch[2];

      if (!hasJSDoc) {
        missing.push(funcName);
        if (missing.length >= 5) break; // Limit to 5
      }
      hasJSDoc = false;
    } else if (!line.trim().endsWith('*/')) {
      hasJSDoc = false;
    }
  }

  return missing;
}

/**
 * Docstring enforcer - warns about missing documentation
 */
export function docstringEnforcer(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || '';

  // Apply guards
  const guardResult = runGuards(input, guardCodeFiles, guardSkipInternal);
  if (guardResult !== null) {
    return guardResult;
  }

  if (!filePath || !content) {
    return outputSilentSuccess();
  }

  // Skip test files - docstrings are less critical
  if (isTestFile(filePath)) {
    return outputSilentSuccess();
  }

  const ext = getFileExt(filePath);
  let missingDocstrings: string[] = [];

  if (ext === 'py') {
    missingDocstrings = findMissingPythonDocstrings(content);
  } else if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    missingDocstrings = findMissingJSDoc(content);
  }

  if (missingDocstrings.length > 0) {
    const funcList = missingDocstrings.join(', ');
    let contextMsg: string;

    if (ext === 'py') {
      contextMsg = `Documentation: ${missingDocstrings.length} public function(s) missing docstrings: ${funcList}. Consider adding """docstrings""" for better code documentation.`;
    } else {
      contextMsg = `Documentation: ${missingDocstrings.length} exported function(s) missing JSDoc: ${funcList}. Consider adding /** JSDoc */ comments for better IDE support.`;
    }

    // Truncate if too long
    if (contextMsg.length > 200) {
      if (ext === 'py') {
        contextMsg = `Documentation: ${missingDocstrings.length} public function(s) missing docstrings. Add """docstrings""" for better documentation.`;
      } else {
        contextMsg = `Documentation: ${missingDocstrings.length} exported function(s) missing JSDoc. Add /** JSDoc */ for better IDE support.`;
      }
    }

    logHook('docstring-enforcer', `DOCSTRING_WARN: ${missingDocstrings.length} functions missing docs in ${filePath}`);
    return outputWithContext(contextMsg);
  }

  // All public functions documented - allow silently
  logHook('docstring-enforcer', `DOCSTRING_OK: All public functions documented in ${filePath}`);
  return outputSilentSuccess();
}

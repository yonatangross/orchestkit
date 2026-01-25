/**
 * Cross-Instance Test Validator Hook
 * BLOCKING: Ensure test coverage when code is split across instances
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  outputBlock,
  outputWithContext,
  getProjectDir,
} from '../lib/common.js';
import { getRepoRoot } from '../lib/git.js';

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) ||
    /test_.*\.py$/.test(filePath) ||
    /_test\.py$/.test(filePath)
  );
}

/**
 * Find corresponding test file for an implementation
 */
function findTestFile(implFile: string): string | null {
  if (/\.(ts|tsx|js|jsx)$/.test(implFile)) {
    const base = implFile.replace(/\.[^.]+$/, '');
    const ext = implFile.split('.').pop() || 'ts';

    // Check common patterns
    const patterns = [
      `${base}.test.${ext}`,
      `${base}.spec.${ext}`,
      `${base}.test.ts`,
      `${base}.test.tsx`,
    ];

    for (const pattern of patterns) {
      if (existsSync(pattern)) return pattern;
    }

    // Check __tests__ directory
    const dir = implFile.substring(0, implFile.lastIndexOf('/'));
    const filename = implFile.split('/').pop() || '';
    const baseFilename = filename.replace(/\.[^.]+$/, '');

    const testDirPatterns = [
      `${dir}/__tests__/${baseFilename}.test.${ext}`,
      `${dir}/__tests__/${baseFilename}.spec.${ext}`,
    ];

    for (const pattern of testDirPatterns) {
      if (existsSync(pattern)) return pattern;
    }
  } else if (implFile.endsWith('.py')) {
    const dir = implFile.substring(0, implFile.lastIndexOf('/'));
    const filename = implFile.split('/').pop() || '';
    const testFilename = `test_${filename}`;

    // Try same directory
    if (existsSync(`${dir}/${testFilename}`)) {
      return `${dir}/${testFilename}`;
    }

    // Try tests/ directory
    const parentDir = dir.substring(0, dir.lastIndexOf('/'));
    if (existsSync(`${parentDir}/tests/${testFilename}`)) {
      return `${parentDir}/tests/${testFilename}`;
    }
    if (existsSync(`${dir}/tests/${testFilename}`)) {
      return `${dir}/tests/${testFilename}`;
    }
  }

  return null;
}

/**
 * Extract testable units from content
 */
function extractTestableUnits(content: string, filePath: string): string[] {
  const units: string[] = [];

  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    // TypeScript/JavaScript: Extract exported functions and classes
    const matches = content.match(/export (function|class|const|async function)\s+([A-Za-z_][A-Za-z0-9_]*)/g);
    if (matches) {
      for (const match of matches) {
        const name = match.split(/\s+/).pop();
        if (name) units.push(name);
      }
    }
  } else if (filePath.endsWith('.py')) {
    // Python: Extract public functions and classes
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(def|class)\s+([A-Za-z][A-Za-z0-9_]*)/);
      if (match && match[2]) {
        units.push(match[2]);
      }
    }
  }

  return [...new Set(units)];
}

/**
 * Validate test coverage for cross-instance code
 */
export function crossInstanceTestValidator(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || '';
  const content = input.tool_input?.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Only validate implementation files (not tests)
  if (isTestFile(filePath)) return outputSilentSuccess();

  // Skip non-code files
  if (!/\.(ts|tsx|js|jsx|py)$/.test(filePath)) {
    return outputSilentSuccess();
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Find corresponding test file
  const testFile = findTestFile(filePath);

  // Extract testable units
  const testableUnits = extractTestableUnits(content, filePath);

  if (testableUnits.length > 0) {
    if (!testFile) {
      errors.push('TEST COVERAGE: No test file found for implementation');
      errors.push(`  Implementation: ${filePath}`);
      errors.push('  Expected test file:');

      if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
        const base = filePath.replace(/\.[^.]+$/, '');
        const ext = filePath.split('.').pop() || 'ts';
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        const filename = filePath.split('/').pop() || '';
        errors.push(`    - ${base}.test.${ext}`);
        errors.push(`    - ${dir}/__tests__/${filename}`);
      } else if (filePath.endsWith('.py')) {
        const filename = filePath.split('/').pop() || '';
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        errors.push(`    - ${dir}/test_${filename}`);
        errors.push(`    - ${dir.substring(0, dir.lastIndexOf('/'))}/tests/test_${filename}`);
      }

      errors.push('');
      errors.push(`  Found ${testableUnits.length} testable units:`);
      for (const unit of testableUnits.slice(0, 5)) {
        errors.push(`    - ${unit}`);
      }
    } else {
      // Test file exists - check if new units are tested
      try {
        const testContent = readFileSync(testFile, 'utf8');
        const untestedUnits: string[] = [];

        for (const unit of testableUnits) {
          // Use word boundary check
          const regex = new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (!regex.test(testContent)) {
            untestedUnits.push(unit);
          }
        }

        if (untestedUnits.length > 0) {
          warnings.push('TEST COVERAGE: New units without tests');
          warnings.push(`  Implementation: ${filePath}`);
          warnings.push(`  Test file: ${testFile}`);
          warnings.push('');
          warnings.push(`  Untested units (${untestedUnits.length}/${testableUnits.length}):`);
          for (const unit of untestedUnits.slice(0, 5)) {
            warnings.push(`    - ${unit}`);
          }
          warnings.push('');
          warnings.push('  Add tests before committing');
        }
      } catch {
        // Ignore file read errors
      }
    }
  }

  // Block on missing tests for new code
  if (errors.length > 0) {
    return outputBlock(`Missing test coverage for new code: ${errors[0]}`);
  }

  // Warn about test gaps
  if (warnings.length > 0) {
    const warningContext = warnings.join('\n');
    return outputWithContext(`Test coverage warnings detected:\n\n${warningContext}`);
  }

  return outputSilentSuccess();
}

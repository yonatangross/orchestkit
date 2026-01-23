/**
 * Coverage Threshold Gate Hook
 * BLOCKING: Coverage must meet threshold after implementation
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputBlock, getProjectDir } from '../lib/common.js';

const COVERAGE_PATHS = [
  // JavaScript/TypeScript (Jest, Vitest, c8)
  'coverage/coverage-summary.json',
  'coverage/coverage-final.json',
  '.vitest/coverage/coverage-summary.json',
  // Python (coverage.py, pytest-cov)
  'coverage.json',
  '.coverage.json',
  'htmlcov/status.json',
];

/**
 * Parse coverage from various file formats
 */
function parseCoverage(filePath: string, content: string): number | null {
  try {
    const data = JSON.parse(content);

    // Jest/Vitest coverage-summary.json format
    if (filePath.includes('coverage-summary.json')) {
      return data?.total?.lines?.pct ?? data?.total?.statements?.pct ?? null;
    }

    // coverage.py JSON format
    if (filePath.includes('coverage.json')) {
      return data?.totals?.percent_covered ?? null;
    }

    // Try generic pct field
    if (data?.total?.pct !== undefined) {
      return data.total.pct;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check coverage threshold gate
 */
export function coverageThresholdGate(_input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const threshold = parseInt(process.env.COVERAGE_THRESHOLD || '80', 10);

  // Find coverage file
  let coverageFile = '';
  let coverageContent = '';

  for (const path of COVERAGE_PATHS) {
    const fullPath = `${projectDir}/${path}`;
    if (existsSync(fullPath)) {
      coverageFile = fullPath;
      try {
        coverageContent = readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      break;
    }
  }

  // No coverage file = skip (coverage might not be configured yet)
  if (!coverageFile || !coverageContent) {
    return outputSilentSuccess();
  }

  // Parse coverage
  const coverage = parseCoverage(coverageFile, coverageContent);
  if (coverage === null) {
    return outputSilentSuccess();
  }

  // Check threshold
  const coverageInt = Math.floor(coverage);
  if (coverageInt < threshold) {
    const reason = `BLOCKED: Coverage ${coverage}% is below threshold ${threshold}%

Coverage report: ${coverageFile}

Actions required:
  1. Identify uncovered code paths
  2. Add tests for critical business logic
  3. Re-run tests with coverage:

     TypeScript: npm test -- --coverage
     Python:     pytest --cov=app --cov-report=term-missing

  4. Ensure coverage >= ${threshold}% before proceeding

Tip: Focus on testing:
  - Business logic (services, utils)
  - Edge cases and error handling
  - Critical user flows`;

    return outputBlock(reason);
  }

  return outputSilentSuccess();
}

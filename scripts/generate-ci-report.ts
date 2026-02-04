#!/usr/bin/env npx ts-node
/**
 * CI/CD Assessment Dashboard Report Generator
 *
 * Generates an interactive HTML report consolidating all CI pipeline results:
 * - Build status and errors
 * - Test results (pass/fail/skip)
 * - Lint warnings and errors
 * - Security scan findings
 * - Coverage changes
 *
 * Usage:
 *   npx ts-node scripts/generate-ci-report.ts [--output <path>]
 *
 * Environment variables:
 *   CI_BUILD_STATUS     - "success" | "failure"
 *   CI_BUILD_ERRORS     - JSON array of error messages
 *   CI_TEST_RESULTS     - JSON with { passed, failed, skipped, total }
 *   CI_LINT_RESULTS     - JSON with { errors, warnings, files }
 *   CI_SECURITY_RESULTS - JSON with { critical, high, medium, low }
 *   CI_COVERAGE         - JSON with { current, previous, delta }
 *   CI_COMMIT_SHA       - Git commit SHA
 *   CI_BRANCH           - Git branch name
 *   CI_PR_NUMBER        - Pull request number (if applicable)
 *
 * @see https://github.com/yonatangross/orchestkit/issues/317
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

// =============================================================================
// Types
// =============================================================================

interface BuildResult {
  status: 'success' | 'failure' | 'unknown';
  errors: string[];
  warnings: string[];
  duration?: number;
}

interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: Array<{ name: string; error: string; file?: string }>;
  duration?: number;
}

interface LintResult {
  errors: number;
  warnings: number;
  files: number;
  issues: Array<{ file: string; line: number; message: string; severity: 'error' | 'warning' }>;
}

interface SecurityResult {
  critical: number;
  high: number;
  medium: number;
  low: number;
  vulnerabilities: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    package: string;
    description: string;
  }>;
}

interface CoverageResult {
  current: number;
  previous: number;
  delta: number;
  files?: Array<{ file: string; coverage: number; delta: number }>;
}

interface CIReport {
  timestamp: string;
  commit: string;
  branch: string;
  prNumber?: number;
  build: BuildResult;
  tests: TestResult;
  lint: LintResult;
  security: SecurityResult;
  coverage: CoverageResult;
  overallStatus: 'success' | 'warning' | 'failure';
  score: number;
}

// =============================================================================
// Data Collection
// =============================================================================

function getEnvJson<T>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

function collectBuildResults(): BuildResult {
  const status = (process.env.CI_BUILD_STATUS as BuildResult['status']) || 'unknown';
  const errors = getEnvJson<string[]>('CI_BUILD_ERRORS', []);
  const warnings = getEnvJson<string[]>('CI_BUILD_WARNINGS', []);

  // Try to collect from npm run build output
  if (status === 'unknown') {
    try {
      execSync('npm run build 2>&1', { encoding: 'utf-8', timeout: 120000 });
      return { status: 'success', errors: [], warnings: [] };
    } catch (e: any) {
      return {
        status: 'failure',
        errors: [e.message || 'Build failed'],
        warnings: [],
      };
    }
  }

  return { status, errors, warnings };
}

function collectTestResults(): TestResult {
  const envResult = getEnvJson<TestResult>('CI_TEST_RESULTS', {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    failures: [],
  });

  if (envResult.total > 0) return envResult;

  // Try to collect from npm test output
  try {
    const output = execSync('npm test 2>&1 || true', { encoding: 'utf-8', timeout: 300000 });

    // Parse test output (basic heuristics)
    const passedMatch = output.match(/(\d+)\s*(?:passing|passed)/i);
    const failedMatch = output.match(/(\d+)\s*(?:failing|failed)/i);
    const skippedMatch = output.match(/(\d+)\s*(?:skipped|pending)/i);

    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

    return {
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      failures: [],
    };
  } catch {
    return { passed: 0, failed: 0, skipped: 0, total: 0, failures: [] };
  }
}

function collectLintResults(): LintResult {
  const envResult = getEnvJson<LintResult>('CI_LINT_RESULTS', {
    errors: 0,
    warnings: 0,
    files: 0,
    issues: [],
  });

  if (envResult.files > 0) return envResult;

  // Try to run linting
  try {
    const output = execSync('npm run lint 2>&1 || true', { encoding: 'utf-8', timeout: 120000 });

    const errorMatch = output.match(/(\d+)\s*errors?/i);
    const warningMatch = output.match(/(\d+)\s*warnings?/i);

    return {
      errors: errorMatch ? parseInt(errorMatch[1], 10) : 0,
      warnings: warningMatch ? parseInt(warningMatch[1], 10) : 0,
      files: 0,
      issues: [],
    };
  } catch {
    return { errors: 0, warnings: 0, files: 0, issues: [] };
  }
}

function collectSecurityResults(): SecurityResult {
  const envResult = getEnvJson<SecurityResult>('CI_SECURITY_RESULTS', {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    vulnerabilities: [],
  });

  if (envResult.critical + envResult.high + envResult.medium + envResult.low > 0) {
    return envResult;
  }

  // Try npm audit
  try {
    const output = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf-8',
      timeout: 60000,
    });
    const audit = JSON.parse(output);

    return {
      critical: audit.metadata?.vulnerabilities?.critical || 0,
      high: audit.metadata?.vulnerabilities?.high || 0,
      medium: audit.metadata?.vulnerabilities?.moderate || 0,
      low: audit.metadata?.vulnerabilities?.low || 0,
      vulnerabilities: [],
    };
  } catch {
    return { critical: 0, high: 0, medium: 0, low: 0, vulnerabilities: [] };
  }
}

function collectCoverageResults(): CoverageResult {
  const envResult = getEnvJson<CoverageResult>('CI_COVERAGE', {
    current: 0,
    previous: 0,
    delta: 0,
  });

  if (envResult.current > 0) return envResult;

  // Try to read coverage from common locations
  const coveragePaths = [
    'coverage/coverage-summary.json',
    'coverage/lcov-report/index.html',
    '.nyc_output/coverage-summary.json',
  ];

  for (const path of coveragePaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        if (path.endsWith('.json')) {
          const data = JSON.parse(content);
          const current = data.total?.lines?.pct || data.total?.statements?.pct || 0;
          return { current, previous: 0, delta: 0 };
        }
      } catch {
        continue;
      }
    }
  }

  return { current: 0, previous: 0, delta: 0 };
}

function getGitInfo(): { commit: string; branch: string } {
  let commit = process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || '';
  let branch = process.env.CI_BRANCH || process.env.GITHUB_REF_NAME || '';

  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      commit = 'unknown';
    }
  }

  if (!branch) {
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch {
      branch = 'unknown';
    }
  }

  return { commit: commit.slice(0, 7), branch };
}

// =============================================================================
// Report Generation
// =============================================================================

function calculateScore(report: CIReport): number {
  let score = 100;

  // Build failures: -30
  if (report.build.status === 'failure') score -= 30;

  // Test failures: -5 per failure (max -30)
  score -= Math.min(30, report.tests.failed * 5);

  // Lint errors: -2 per error (max -20)
  score -= Math.min(20, report.lint.errors * 2);

  // Security issues: -10 critical, -5 high, -2 medium
  score -= report.security.critical * 10;
  score -= report.security.high * 5;
  score -= report.security.medium * 2;

  // Coverage below 60%: -10
  if (report.coverage.current > 0 && report.coverage.current < 60) score -= 10;

  // Coverage decrease: -5
  if (report.coverage.delta < 0) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function determineOverallStatus(report: CIReport): CIReport['overallStatus'] {
  if (report.build.status === 'failure') return 'failure';
  if (report.tests.failed > 0) return 'failure';
  if (report.security.critical > 0) return 'failure';
  if (report.lint.errors > 0) return 'warning';
  if (report.security.high > 0) return 'warning';
  return 'success';
}

function generateReport(): CIReport {
  const { commit, branch } = getGitInfo();

  const report: CIReport = {
    timestamp: new Date().toISOString(),
    commit,
    branch,
    prNumber: process.env.CI_PR_NUMBER ? parseInt(process.env.CI_PR_NUMBER, 10) : undefined,
    build: collectBuildResults(),
    tests: collectTestResults(),
    lint: collectLintResults(),
    security: collectSecurityResults(),
    coverage: collectCoverageResults(),
    overallStatus: 'success',
    score: 0,
  };

  report.overallStatus = determineOverallStatus(report);
  report.score = calculateScore(report);

  return report;
}

// =============================================================================
// HTML Generation
// =============================================================================

function generateHtml(report: CIReport): string {
  const statusColor =
    report.overallStatus === 'success'
      ? '#10B981'
      : report.overallStatus === 'warning'
        ? '#F59E0B'
        : '#EF4444';

  const statusEmoji =
    report.overallStatus === 'success' ? '✅' : report.overallStatus === 'warning' ? '⚠️' : '❌';

  const grade =
    report.score >= 90
      ? 'A'
      : report.score >= 80
        ? 'B'
        : report.score >= 70
          ? 'C'
          : report.score >= 60
            ? 'D'
            : 'F';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CI Report - ${report.branch}@${report.commit}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            'ci-green': '#10B981',
            'ci-yellow': '#F59E0B',
            'ci-red': '#EF4444',
            'ci-blue': '#3B82F6',
          }
        }
      }
    }
  </script>
  <style>
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.3s ease-out forwards; }
    .card-hover { transition: all 0.2s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.3); }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div class="max-w-6xl mx-auto px-4 py-8">

    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold">CI Assessment Report</h1>
          <p class="text-gray-400 mt-1">
            <code class="bg-gray-800 px-2 py-0.5 rounded">${report.branch}</code>
            @ <code class="bg-gray-800 px-2 py-0.5 rounded">${report.commit}</code>
            ${report.prNumber ? `• PR #${report.prNumber}` : ''}
          </p>
          <p class="text-gray-500 text-sm mt-1">${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        <div class="text-right">
          <div class="text-5xl font-bold" style="color: ${statusColor}">${report.score}</div>
          <div class="text-sm text-gray-500">Score (Grade ${grade})</div>
          <div class="text-2xl mt-1">${statusEmoji} ${report.overallStatus.toUpperCase()}</div>
        </div>
      </div>
    </header>

    <!-- Summary Cards -->
    <div class="grid grid-cols-5 gap-4 mb-8">
      <!-- Build -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-800 card-hover">
        <div class="text-2xl font-bold ${report.build.status === 'success' ? 'text-ci-green' : 'text-ci-red'}">
          ${report.build.status === 'success' ? '✓' : '✗'}
        </div>
        <div class="text-sm text-gray-400">Build</div>
        ${report.build.errors.length > 0 ? `<div class="text-xs text-ci-red mt-1">${report.build.errors.length} errors</div>` : ''}
      </div>

      <!-- Tests -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-800 card-hover">
        <div class="text-2xl font-bold ${report.tests.failed > 0 ? 'text-ci-red' : 'text-ci-green'}">
          ${report.tests.passed}/${report.tests.total}
        </div>
        <div class="text-sm text-gray-400">Tests Passed</div>
        ${report.tests.failed > 0 ? `<div class="text-xs text-ci-red mt-1">${report.tests.failed} failed</div>` : ''}
        ${report.tests.skipped > 0 ? `<div class="text-xs text-ci-yellow mt-1">${report.tests.skipped} skipped</div>` : ''}
      </div>

      <!-- Lint -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-800 card-hover">
        <div class="text-2xl font-bold ${report.lint.errors > 0 ? 'text-ci-red' : report.lint.warnings > 0 ? 'text-ci-yellow' : 'text-ci-green'}">
          ${report.lint.errors + report.lint.warnings}
        </div>
        <div class="text-sm text-gray-400">Lint Issues</div>
        ${report.lint.errors > 0 ? `<div class="text-xs text-ci-red mt-1">${report.lint.errors} errors</div>` : ''}
        ${report.lint.warnings > 0 ? `<div class="text-xs text-ci-yellow mt-1">${report.lint.warnings} warnings</div>` : ''}
      </div>

      <!-- Security -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-800 card-hover">
        <div class="text-2xl font-bold ${report.security.critical > 0 ? 'text-ci-red' : report.security.high > 0 ? 'text-ci-yellow' : 'text-ci-green'}">
          ${report.security.critical + report.security.high + report.security.medium + report.security.low}
        </div>
        <div class="text-sm text-gray-400">Vulnerabilities</div>
        ${report.security.critical > 0 ? `<div class="text-xs text-ci-red mt-1">${report.security.critical} critical</div>` : ''}
        ${report.security.high > 0 ? `<div class="text-xs text-ci-yellow mt-1">${report.security.high} high</div>` : ''}
      </div>

      <!-- Coverage -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-800 card-hover">
        <div class="text-2xl font-bold ${report.coverage.current >= 80 ? 'text-ci-green' : report.coverage.current >= 60 ? 'text-ci-yellow' : 'text-ci-red'}">
          ${report.coverage.current.toFixed(1)}%
        </div>
        <div class="text-sm text-gray-400">Coverage</div>
        ${report.coverage.delta !== 0 ? `<div class="text-xs ${report.coverage.delta >= 0 ? 'text-ci-green' : 'text-ci-red'} mt-1">${report.coverage.delta >= 0 ? '+' : ''}${report.coverage.delta.toFixed(1)}%</div>` : ''}
      </div>
    </div>

    <!-- Details Sections -->
    <div class="grid grid-cols-2 gap-6">

      <!-- Build Details -->
      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 class="text-lg font-semibold mb-4">Build Status</h2>
        ${
          report.build.status === 'success'
            ? '<div class="text-ci-green">Build completed successfully</div>'
            : `
          <div class="space-y-2">
            ${report.build.errors.map((e) => `<div class="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300"><code>${e}</code></div>`).join('')}
          </div>
        `
        }
      </div>

      <!-- Test Details -->
      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 class="text-lg font-semibold mb-4">Test Results</h2>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-400">Passed</span>
            <span class="text-ci-green font-medium">${report.tests.passed}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Failed</span>
            <span class="${report.tests.failed > 0 ? 'text-ci-red' : 'text-gray-400'} font-medium">${report.tests.failed}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Skipped</span>
            <span class="${report.tests.skipped > 0 ? 'text-ci-yellow' : 'text-gray-400'} font-medium">${report.tests.skipped}</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2 mt-3">
            <div class="bg-ci-green h-2 rounded-full" style="width: ${report.tests.total > 0 ? (report.tests.passed / report.tests.total) * 100 : 0}%"></div>
          </div>
        </div>
      </div>

      <!-- Security Details -->
      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 class="text-lg font-semibold mb-4">Security Scan</h2>
        <div class="grid grid-cols-4 gap-3 text-center">
          <div class="p-2 bg-red-500/10 rounded">
            <div class="text-xl font-bold text-ci-red">${report.security.critical}</div>
            <div class="text-xs text-gray-500">Critical</div>
          </div>
          <div class="p-2 bg-yellow-500/10 rounded">
            <div class="text-xl font-bold text-ci-yellow">${report.security.high}</div>
            <div class="text-xs text-gray-500">High</div>
          </div>
          <div class="p-2 bg-blue-500/10 rounded">
            <div class="text-xl font-bold text-ci-blue">${report.security.medium}</div>
            <div class="text-xs text-gray-500">Medium</div>
          </div>
          <div class="p-2 bg-gray-700 rounded">
            <div class="text-xl font-bold text-gray-400">${report.security.low}</div>
            <div class="text-xs text-gray-500">Low</div>
          </div>
        </div>
      </div>

      <!-- Lint Details -->
      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 class="text-lg font-semibold mb-4">Lint Results</h2>
        ${
          report.lint.errors + report.lint.warnings === 0
            ? '<div class="text-ci-green">No lint issues found</div>'
            : `
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-400">Errors</span>
              <span class="${report.lint.errors > 0 ? 'text-ci-red' : 'text-gray-400'} font-medium">${report.lint.errors}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Warnings</span>
              <span class="${report.lint.warnings > 0 ? 'text-ci-yellow' : 'text-gray-400'} font-medium">${report.lint.warnings}</span>
            </div>
          </div>
        `
        }
      </div>

    </div>

    <!-- Footer -->
    <footer class="mt-8 pt-6 border-t border-gray-800 text-center text-gray-500 text-sm">
      Generated by OrchestKit CI Report Generator • ${new Date().toISOString()}
    </footer>

  </div>
</body>
</html>`;
}

// =============================================================================
// Main
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const outputPath =
    outputIndex !== -1 && args[outputIndex + 1]
      ? args[outputIndex + 1]
      : 'ci-report.html';

  console.log('Collecting CI results...');
  const report = generateReport();

  console.log(`\nCI Report Summary:`);
  console.log(`  Status: ${report.overallStatus.toUpperCase()}`);
  console.log(`  Score: ${report.score}/100`);
  console.log(`  Build: ${report.build.status}`);
  console.log(`  Tests: ${report.tests.passed}/${report.tests.total} passed`);
  console.log(`  Lint: ${report.lint.errors} errors, ${report.lint.warnings} warnings`);
  console.log(`  Security: ${report.security.critical} critical, ${report.security.high} high`);
  console.log(`  Coverage: ${report.coverage.current.toFixed(1)}%`);

  console.log(`\nGenerating HTML report...`);
  const html = generateHtml(report);
  writeFileSync(outputPath, html);
  console.log(`Report written to: ${outputPath}`);

  // Also output JSON for programmatic use
  const jsonPath = outputPath.replace('.html', '.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON data written to: ${jsonPath}`);

  // Exit with appropriate code
  if (report.overallStatus === 'failure') {
    process.exit(1);
  }
}

main();

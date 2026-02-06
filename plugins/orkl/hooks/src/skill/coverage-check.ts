/**
 * Coverage Check Hook
 * Runs on Stop for testing skills - checks if coverage threshold is met
 * CC 2.1.7 Compliant - Silent operation
 */

import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getLogDir, getProjectDir } from '../lib/common.js';

/**
 * Check coverage threshold on stop
 */
export function coverageCheck(_input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const logDir = getLogDir();
  const logFile = `${logDir}/coverage-check.log`;
  const threshold = parseInt(process.env.COVERAGE_THRESHOLD || '80', 10);

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const logLines: string[] = [];
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  logLines.push(`[${timestamp}] Coverage Check`);

  // Check Python coverage
  const coverageFile = `${projectDir}/.coverage`;
  const coverageXml = `${projectDir}/coverage.xml`;

  if (existsSync(coverageFile) || existsSync(coverageXml)) {
    try {
      const result = execSync('coverage report --fail-under=0', {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const totalLine = result.split('\n').find((line) => line.includes('TOTAL'));
      if (totalLine) {
        const match = totalLine.match(/(\d+)%/);
        if (match) {
          const coverage = parseInt(match[1], 10);
          logLines.push(`Python coverage: ${coverage}%`);
          if (coverage < threshold) {
            logLines.push(`WARNING: Coverage ${coverage}% is below threshold ${threshold}%`);
          } else {
            logLines.push('Coverage meets threshold');
          }
        }
      }
    } catch {
      // coverage command not available or failed
    }
  }

  // Check JS/TS coverage
  const coverageDir = `${projectDir}/coverage`;
  if (existsSync(coverageDir)) {
    const summaryFile = `${coverageDir}/coverage-summary.json`;
    if (existsSync(summaryFile)) {
      logLines.push('');
      logLines.push('JavaScript/TypeScript coverage report found');
      logLines.push('Check coverage/lcov-report/index.html for details');
    }
  }

  // Write to log file
  try {
    appendFileSync(logFile, logLines.join('\n') + '\n');
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}

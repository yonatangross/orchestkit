/**
 * Evidence Collector Hook
 * Runs on Stop for evidence-verification skill
 * Collects verification evidence - silent operation
 * CC 2.1.7 Compliant
 */

import { existsSync, appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getLogDir, getProjectDir } from '../lib/common.js';

/**
 * Collect verification evidence on session stop
 */
export function evidenceCollector(_input: HookInput): HookResult {
  const logDir = getLogDir();
  const projectDir = getProjectDir();
  const logFile = `${logDir}/evidence-collector.log`;

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const logLines: string[] = [];

  logLines.push(`[${timestamp}] Evidence Collection`);

  // Collect exit codes from recent commands
  logLines.push('Recent command results:');
  const lastExitCode = process.env.CC_LAST_EXIT_CODE;
  if (lastExitCode) {
    logLines.push(`  Last exit code: ${lastExitCode}`);
  }

  // Check for test results
  if (existsSync(`${projectDir}/pytest.xml`) || existsSync(`${projectDir}/junit.xml`)) {
    logLines.push('  Test results: Found (XML format)');
  }

  const testResultsDir = `${projectDir}/test-results`;
  if (existsSync(testResultsDir)) {
    logLines.push('  Test results directory: Found');
    try {
      const files = readdirSync(testResultsDir).slice(0, 5);
      for (const file of files) {
        logLines.push(`    ${file}`);
      }
    } catch {
      // Ignore
    }
  }

  // Check for coverage
  if (existsSync(`${projectDir}/.coverage`) || existsSync(`${projectDir}/coverage`)) {
    logLines.push('  Coverage data: Found');
  }

  // Check for lint results
  if (existsSync(`${projectDir}/lint-results.json`) || existsSync(`${projectDir}/eslint-report.json`)) {
    logLines.push('  Lint results: Found');
  }

  logLines.push('Evidence verification complete.');

  // Write to log file (silent operation)
  try {
    appendFileSync(logFile, logLines.join('\n') + '\n');
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}

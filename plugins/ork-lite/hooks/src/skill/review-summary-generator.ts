/**
 * Review Summary Generator Hook
 * Runs on Stop for code-review-playbook skill
 * Generates review summary - silent operation, logs to file
 * CC 2.1.7 Compliant
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getLogDir } from '../lib/common.js';

/**
 * Generate code review summary on session stop
 */
export function reviewSummaryGenerator(_input: HookInput): HookResult {
  const logDir = getLogDir();
  const logFile = `${logDir}/review-summary.log`;

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const logContent = `[${timestamp}] Code Review Summary
Review checklist:
  [ ] All blocking issues addressed
  [ ] Non-blocking suggestions noted
  [ ] Tests pass
  [ ] No security concerns
  [ ] Documentation updated if needed

Conventional comment prefixes used:
  - blocking: Must fix before merge
  - suggestion: Consider this improvement
  - nitpick: Minor style issue
  - question: Needs clarification
  - praise: Good work!
`;

  // Write to log file (silent operation)
  try {
    appendFileSync(logFile, logContent + '\n');
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}

/**
 * Security Summary Hook
 * Runs on Stop for security-scanning skill
 * Generates a summary of security scan completion - silent operation
 * CC 2.1.7 Compliant
 */

import { mkdirSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Generate security scan summary on session stop
 */
export function securitySummary(_input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const logDir = ctx.logDir;
  const logFile = `${logDir}/security-summary.log`;

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const logContent = `[${timestamp}] Security Scan Complete
Review findings for:
  - Critical/High vulnerabilities (fix immediately)
  - Dependency CVEs (update packages)
  - Hardcoded secrets (move to env vars)
  - OWASP Top 10 violations

Next steps:
  1. Triage findings by severity
  2. Create issues for critical/high
  3. Update dependencies with CVEs
`;

  // Write to log file (silent operation)
  try {
    bufferWrite(logFile, `${logContent}\n`);
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}

/**
 * Redact Secrets Hook
 * Runs after Bash commands in security-scanning skill
 * Warns if potential secrets detected in output
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';

// API key patterns
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/, // OpenAI
  /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
  /AKIA[A-Z0-9]{16}/, // AWS Access Key
  /xox[baprs]-[a-zA-Z0-9-]+/, // Slack tokens
];

// Generic secret patterns
const SECRET_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /secret\s*[:=]\s*['"][^'"]+['"]/i,
];

/**
 * Check for potential secrets in command output
 */
export function redactSecrets(input: HookInput): HookResult {
  const toolOutput = (input as any).tool_result || (input as any).output || '';

  if (!toolOutput) return outputSilentSuccess();

  // Check for API key patterns
  for (const pattern of API_KEY_PATTERNS) {
    if (pattern.test(toolOutput)) {
      process.stderr.write('::warning::Potential API key detected in output - verify redaction\n');
      break;
    }
  }

  // Check for generic secret patterns
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(toolOutput)) {
      process.stderr.write('::warning::Potential hardcoded credential in output\n');
      break;
    }
  }

  // Silent success - warnings printed to stderr, don't block
  return outputSilentSuccess();
}

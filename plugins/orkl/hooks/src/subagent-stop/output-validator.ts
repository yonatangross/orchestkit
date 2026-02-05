/**
 * Output Validator - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Validates agent output quality and completeness.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getLogDir(): string {
  const logDir = `${getProjectDir()}/.claude/logs/agent-validation`;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }
  return logDir;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function outputValidator(input: HookInput): HookResult {
  const agentName = process.env.CLAUDE_AGENT_NAME || 'unknown';
  const timestamp = new Date().toISOString();

  // Read agent output
  const output = input.agent_output || input.output || '';

  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  // Check 1: Output is not empty
  if (!output) {
    validationErrors.push('Agent produced empty output');
  }

  // Check 2: Minimum length check
  const outputLength = output.length;
  if (outputLength < 50) {
    validationWarnings.push(`Output seems very short (${outputLength} chars)`);
  }

  // Check 3: Check for common error patterns
  if (/error|failed|exception/i.test(output)) {
    validationWarnings.push('Output contains error-related keywords');
  }

  // Check 4: For backend architect, validate JSON structure if present
  if (agentName === 'backend-system-architect') {
    if (output.includes('{')) {
      // Try to extract and validate JSON
      const jsonMatch = output.match(/\{[^}]*\}/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[0]);
        } catch {
          validationWarnings.push('JSON structure may be malformed');
        }
      }
    }
  }

  // Build validation result
  const validationStatus = validationErrors.length > 0 ? 'failed' : 'passed';

  // Create system message
  let systemMessage = `Output Validation [${validationStatus}] - Agent: ${agentName}, Timestamp: ${timestamp}, Output length: ${outputLength} chars`;

  if (validationErrors.length > 0) {
    systemMessage += ' | Errors: ' + validationErrors.join('; ');
  }

  if (validationWarnings.length > 0) {
    systemMessage += ' | Warnings: ' + validationWarnings.join('; ');
  }

  // Log to file
  const logDir = getLogDir();
  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
  const logFile = `${logDir}/${agentName}_${dateStr}.log`;

  const logContent = `=== OUTPUT VALIDATION ===
${systemMessage}

=== AGENT OUTPUT ===
${output}
`;

  try {
    writeFileSync(logFile, logContent);
  } catch {
    // Ignore
  }

  // CC 2.1.7 compliant output
  if (validationStatus === 'failed') {
    return {
      continue: false,
      systemMessage,
      hookSpecificOutput: {
        hookEventName: 'SubagentStop' as any,
      },
    };
  }

  // Silent success for passed validation
  return {
    continue: true,
    suppressOutput: true,
    systemMessage,
  };
}

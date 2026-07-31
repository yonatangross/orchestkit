/**
 * Output Validator - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Validates agent output quality and completeness.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function outputValidator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const agentName = input.subagent_type || input.agent_type || 'unknown';
  const timestamp = new Date().toISOString();

  // Read agent output. Distinguish "CC never sent the field" from "the agent
  // returned an empty string" — conflating the two is what made this hook a
  // kill-switch (#3200). CC delivers neither `agent_output` nor `output` at
  // SubagentStop: 0 of 11,319 real rows carried either, recorded at
  // subagent-stop/unified-dispatcher.ts (#3034). Because
  // sync-subagent-stop-dispatcher short-circuits on `continue: false`, an
  // absent field reported as a validation ERROR silently starved every hook
  // queued behind this one — auto-spawn-quality, multi-claude-verifier,
  // subagent-quality-gate, retry-handler and skill-channel-tracker, i.e. 5 of
  // the 6 SYNC_HOOKS, including retry-handler which is functional and not
  // telemetry. Measured consequence: skill-channels.jsonl held 559 rows across
  // 16 files with ZERO `channel:"subagent"` for two months.
  const rawOutput = input.agent_output ?? input.output;
  const outputDelivered = typeof rawOutput === 'string';
  const output = rawOutput ?? '';

  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  // Check 1: Output is not empty — only meaningful when CC actually delivered
  // the field. An absent field is a payload-contract fact, not an agent defect.
  if (outputDelivered && !output) {
    validationErrors.push('Agent produced empty output');
  }

  // Check 2: Minimum length check. Skipped when the field was never delivered,
  // otherwise every single SubagentStop warns "very short (0 chars)".
  const outputLength = output.length;
  if (outputDelivered && outputLength < 50) {
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
      const jsonMatch = output.match(/\{[^{}]{0,1000}\}/);
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

  // CC 2.1.47: last_assistant_message length as response quality signal
  const lastMsgLength = input.last_assistant_message?.length ?? null;

  // Create system message
  let systemMessage = `Output Validation [${validationStatus}] - Agent: ${agentName}, Timestamp: ${timestamp}, Output length: ${outputLength} chars`
    + (lastMsgLength !== null ? `, Response length: ${lastMsgLength} chars` : '');

  if (validationErrors.length > 0) {
    systemMessage += ` | Errors: ${validationErrors.join('; ')}`;
  }

  if (validationWarnings.length > 0) {
    systemMessage += ` | Warnings: ${validationWarnings.join('; ')}`;
  }

  // Log to file
  const logDir = ctx.logDir;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }
  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
  const logFile = `${logDir}/${agentName}_${dateStr}.log`;

  const logContent = `=== OUTPUT VALIDATION ===
${systemMessage}
${lastMsgLength !== null ? `Response quality signal: last_assistant_message length = ${lastMsgLength}\n` : ''}
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

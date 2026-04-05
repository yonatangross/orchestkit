/**
 * Security Command Audit - Extra audit logging for security agent operations
 *
 * Used by: security-auditor, security-layer-auditor agents
 *
 * Purpose: Log all Bash commands executed during security audits for compliance
 *
 * CC 2.1.7 compliant output format
 */

import { mkdirSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Security command audit hook
 */
export function securityCommandAudit(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const agentId = process.env.CLAUDE_AGENT_ID || 'unknown';
  const toolName = input.tool_name;
  const sessionId = input.session_id || (ctx.sessionId);
  const projectDir = input.project_dir || (ctx.projectDir);

  const logFile = `${projectDir}/.claude/logs/security-audit.log`;

  // Only audit Bash commands
  if (toolName !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = input.tool_input.command || '';
  const timestamp = new Date().toISOString();

  if (command) {
    try {
      // Create log directory if needed
      mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });

      // Log the command execution
      bufferWrite(logFile, `[${timestamp}] [${sessionId}] [${agentId}] CMD: ${command}\n`);
    } catch {
      // Ignore logging errors - don't block the operation
    }
  }

  // Always continue - this is audit logging only
  return outputSilentSuccess();
}

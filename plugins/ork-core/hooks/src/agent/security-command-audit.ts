/**
 * Security Command Audit - Extra audit logging for security agent operations
 *
 * Used by: security-auditor, security-layer-auditor agents
 *
 * Purpose: Log all Bash commands executed during security audits for compliance
 *
 * CC 2.1.7 compliant output format
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId } from '../lib/common.js';

/**
 * Security command audit hook
 */
export function securityCommandAudit(input: HookInput): HookResult {
  const agentId = process.env.CLAUDE_AGENT_ID || 'unknown';
  const toolName = input.tool_name;
  const sessionId = input.session_id || getSessionId();
  const projectDir = input.project_dir || getProjectDir();

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
      appendFileSync(logFile, `[${timestamp}] [${sessionId}] [${agentId}] CMD: ${command}\n`);
    } catch {
      // Ignore logging errors - don't block the operation
    }
  }

  // Always continue - this is audit logging only
  return outputSilentSuccess();
}

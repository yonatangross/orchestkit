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
import { dirname, join } from 'node:path';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { redactSecretValues } from '../lib/crypto.js';
import type { HookInput, HookResult, HookContext } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Prefer CLAUDE_PLUGIN_DATA/logs (CC 2.1.78+) so the audit trail is not in the
 * project tree; fall back to <projectDir>/.claude/logs for older CC (#4217).
 */
function resolveSecurityAuditLogPath(projectDir: string): string {
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (pluginData) {
    return join(pluginData, 'logs', 'security-audit.log');
  }
  return join(projectDir, '.claude', 'logs', 'security-audit.log');
}

/**
 * Security command audit hook
 */
export function securityCommandAudit(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const agentId = process.env.CLAUDE_AGENT_ID || 'unknown';
  const toolName = input.tool_name;
  const sessionId = input.session_id || (ctx.sessionId);
  const projectDir = input.project_dir || (ctx.projectDir);

  // Only audit Bash commands
  if (toolName !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = input.tool_input.command || '';
  const timestamp = new Date().toISOString();

  if (command) {
    try {
      const logFile = resolveSecurityAuditLogPath(projectDir);
      mkdirSync(dirname(logFile), { recursive: true });

      // Redact known token shapes before append (Authorization, PATs, etc.)
      const safeCommand = redactSecretValues(command);
      bufferWrite(logFile, `[${timestamp}] [${sessionId}] [${agentId}] CMD: ${safeCommand}\n`);
    } catch {
      // Ignore logging errors - don't block the operation
    }
  }

  // Always continue - this is audit logging only
  return outputSilentSuccess();
}

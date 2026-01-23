/**
 * Multi-Claude Verifier - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Purpose:
 * 1. Auto-spawn code-quality-reviewer after test-generator completes
 * 2. Auto-spawn security-auditor on sensitive file changes
 * 3. Enable parallel verification for comprehensive coverage
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  '\\.env',
  'auth',
  'secret',
  'credential',
  'password',
  'token',
  'api[_-]?key',
  'jwt',
  'session',
  'oauth',
  'permission',
  '\\.pem$',
  '\\.key$',
  'config.*prod',
];

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getLogDir(): string {
  const logDir = `${getProjectDir()}/.claude/logs/multi-claude`;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }
  return logDir;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function logAction(agentName: string, action: string, details: string): void {
  const logDir = getLogDir();
  const date = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  const logFile = `${logDir}/verifier_${date}.log`;
  const timestamp = new Date().toISOString();

  try {
    appendFileSync(logFile, `[${timestamp}] [${agentName}] ${action}: ${details}\n`);
  } catch {
    // Ignore
  }
}

function containsSensitiveFiles(output: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(output)) {
      return true;
    }
  }
  return false;
}

interface VerificationAction {
  agent: string;
  reason: string;
}

interface VerificationQueue {
  triggered_by: string;
  timestamp: string;
  verifications: Array<{
    agent: string;
    reason: string;
    status: string;
  }>;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function multiClaudeVerifier(input: HookInput): HookResult {
  const timestamp = new Date().toISOString();
  const projectDir = getProjectDir();

  const toolInput = input.tool_input || {};
  const agentName =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    'unknown';
  const agentOutput = input.agent_output || input.output || '';

  const verificationActions: VerificationAction[] = [];

  // Rule 1: After test-generator, spawn code-quality-reviewer
  if (agentName === 'test-generator') {
    verificationActions.push({
      agent: 'code-quality-reviewer',
      reason: 'Test generation complete - quality review recommended',
    });
    logAction(agentName, 'TRIGGER', 'test-generator completion triggers code-quality-reviewer');
  }

  // Rule 2: After frontend-ui-developer with form/auth components, spawn security review
  if (agentName === 'frontend-ui-developer') {
    if (/form|input|validation|submit|auth|login/i.test(agentOutput)) {
      verificationActions.push({
        agent: 'security-auditor',
        reason: 'Frontend auth/form components - security review recommended',
      });
      logAction(agentName, 'TRIGGER', 'frontend auth components trigger security-auditor');
    }
  }

  // Rule 3: After backend-system-architect with API endpoints, spawn security review
  if (agentName === 'backend-system-architect') {
    if (/endpoint|route|api|auth|jwt|session/i.test(agentOutput)) {
      verificationActions.push({
        agent: 'security-auditor',
        reason: 'Backend API endpoints - security review recommended',
      });
      logAction(agentName, 'TRIGGER', 'backend API endpoints trigger security-auditor');
    }
  }

  // Rule 4: Any agent touching sensitive files triggers security-auditor
  if (containsSensitiveFiles(agentOutput)) {
    // Avoid duplicate
    const hasSecurityAuditor = verificationActions.some((v) => v.agent === 'security-auditor');
    if (!hasSecurityAuditor) {
      verificationActions.push({
        agent: 'security-auditor',
        reason: 'Sensitive files modified - security review required',
      });
      logAction(agentName, 'TRIGGER', 'sensitive file patterns detected');
    }
  }

  // Rule 5: After database-engineer with schema changes, spawn code-quality-reviewer
  if (agentName === 'database-engineer') {
    verificationActions.push({
      agent: 'code-quality-reviewer',
      reason: 'Database schema changes - review for consistency',
    });
    logAction(agentName, 'TRIGGER', 'database changes trigger code-quality-reviewer');
  }

  // Rule 6: After workflow-architect, spawn security-layer-auditor
  if (agentName === 'workflow-architect') {
    verificationActions.push({
      agent: 'security-layer-auditor',
      reason: 'LangGraph workflow created - layer audit recommended',
    });
    logAction(agentName, 'TRIGGER', 'workflow-architect triggers security-layer-auditor');
  }

  // Create verification queue file for orchestrator to pick up
  if (verificationActions.length > 0) {
    const queueDir = `${projectDir}/.claude/context/verification-queue`;
    try {
      mkdirSync(queueDir, { recursive: true });
    } catch {
      // Ignore
    }

    const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
    const queueFile = `${queueDir}/pending_${dateStr}_${agentName}.json`;

    const verificationsQueue: VerificationQueue = {
      triggered_by: agentName,
      timestamp,
      verifications: verificationActions.map((v) => ({
        agent: v.agent,
        reason: v.reason,
        status: 'pending',
      })),
    };

    try {
      writeFileSync(queueFile, JSON.stringify(verificationsQueue, null, 2));
    } catch {
      // Ignore
    }

    // Create system message with recommendations
    const recommendationMsg =
      'Multi-Claude Verification Triggered: ' +
      verificationActions.map((v) => `${v.agent} (${v.reason})`).join('; ');

    logAction(agentName, 'QUEUE', `Created verification queue: ${queueFile}`);

    return {
      continue: true,
      systemMessage: recommendationMsg,
    };
  }

  logAction(agentName, 'SKIP', 'No verification triggers matched');
  return outputSilentSuccess();
}

/**
 * Auto Spawn Quality - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Purpose:
 * - Auto-spawns code-quality-reviewer after test-generator completes
 * - Auto-spawns security-auditor on sensitive file changes
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getSessionId } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  '.env',
  'credentials',
  'secret',
  'auth',
  'password',
  'token',
  'api.key',
  'private.key',
  '.pem',
  'oauth',
  'jwt',
  'session',
  'cookie',
  'encryption',
  'crypto',
];

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getSpawnLog(): string {
  const logDir = `${getProjectDir()}/.claude/hooks/logs`;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }
  return `${logDir}/auto-spawn-quality.log`;
}

function getSpawnQueue(): string {
  return `${getProjectDir()}/.claude/context/spawn-queue.json`;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function logSpawn(message: string): void {
  const logFile = getSpawnLog();
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(logFile, `[${timestamp}] [auto-spawn-quality] ${message}\n`);
  } catch {
    // Ignore
  }
}

function containsSensitiveFiles(output: string): boolean {
  const lowerOutput = output.toLowerCase();
  for (const pattern of SENSITIVE_PATTERNS) {
    if (lowerOutput.includes(pattern)) {
      logSpawn(`Detected sensitive pattern: ${pattern}`);
      return true;
    }
  }
  return false;
}

interface SpawnRequest {
  spawn_id: string;
  target_agent: string;
  trigger_agent: string;
  trigger_reason: string;
  priority: string;
  timestamp: string;
  session_id: string;
  status: string;
}

interface SpawnQueue {
  schema_version: string;
  created_at: string;
  queue: SpawnRequest[];
}

function queueSpawn(
  agentType: string,
  targetAgent: string,
  triggerReason: string,
  priority: string,
  sessionId: string,
  timestamp: string
): string {
  const spawnId = `SPAWN-${new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14)}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;

  const spawnQueue = getSpawnQueue();
  const queueDir = spawnQueue.substring(0, spawnQueue.lastIndexOf('/'));

  try {
    mkdirSync(queueDir, { recursive: true });
  } catch {
    // Ignore
  }

  let queue: SpawnQueue;
  if (existsSync(spawnQueue)) {
    try {
      queue = JSON.parse(readFileSync(spawnQueue, 'utf8'));
    } catch {
      queue = {
        schema_version: '1.0.0',
        created_at: timestamp,
        queue: [],
      };
    }
  } else {
    queue = {
      schema_version: '1.0.0',
      created_at: timestamp,
      queue: [],
    };
  }

  const request: SpawnRequest = {
    spawn_id: spawnId,
    target_agent: targetAgent,
    trigger_agent: agentType,
    trigger_reason: triggerReason,
    priority: priority,
    timestamp: timestamp,
    session_id: sessionId,
    status: 'queued',
  };

  queue.queue.push(request);

  try {
    writeFileSync(spawnQueue, JSON.stringify(queue, null, 2));
    logSpawn(`Queued spawn request: ${spawnId} for ${targetAgent} (reason: ${triggerReason})`);
  } catch {
    logSpawn(`ERROR: Failed to queue spawn request for ${targetAgent}`);
    return '';
  }

  return spawnId;
}

function writeSpawnSuggestion(
  agentType: string,
  targetAgent: string,
  triggerReason: string,
  priority: string,
  sessionId: string,
  timestamp: string
): void {
  const handoffDir = `${getProjectDir()}/.claude/context/handoffs`;
  try {
    mkdirSync(handoffDir, { recursive: true });
  } catch {
    // Ignore
  }

  const suggestionFile = `${handoffDir}/auto_spawn_${targetAgent}_${new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 15)}.json`;

  const suggestion = {
    type: 'auto_spawn_suggestion',
    from_agent: agentType,
    to_agent: targetAgent,
    timestamp: timestamp,
    trigger_reason: triggerReason,
    priority: priority,
    session_id: sessionId,
    auto_triggered: true,
    status: 'suggested',
  };

  try {
    writeFileSync(suggestionFile, JSON.stringify(suggestion, null, 2));
    logSpawn(`Created spawn suggestion: ${targetAgent} (reason: ${triggerReason})`);
  } catch {
    // Ignore
  }
}

interface SpawnInfo {
  target: string;
  reason: string;
  priority: string;
}

function checkAutoSpawnConditions(agentType: string, agentOutput: string, error: string): SpawnInfo | null {
  // Skip if agent had errors
  if (error && error !== 'null') {
    logSpawn(`Skipping auto-spawn - agent ${agentType} had errors: ${error}`);
    return null;
  }

  // Rule 1: test-generator completion -> code-quality-reviewer
  if (agentType === 'test-generator') {
    logSpawn('Rule matched: test-generator -> code-quality-reviewer');
    return {
      target: 'code-quality-reviewer',
      reason: 'test-generator completed - validating test quality and coverage',
      priority: 'high',
    };
  }

  // Rule 2: Any agent with sensitive file changes -> security-auditor
  if (containsSensitiveFiles(agentOutput)) {
    if (agentType !== 'security-auditor' && agentType !== 'security-layer-auditor') {
      logSpawn('Rule matched: sensitive files detected -> security-auditor');
      return {
        target: 'security-auditor',
        reason: 'sensitive file changes detected - security audit required',
        priority: 'critical',
      };
    }
  }

  // Rule 3: code-quality-reviewer completion -> security-auditor
  if (agentType === 'code-quality-reviewer') {
    logSpawn('Rule matched: code-quality-reviewer -> security-auditor');
    return {
      target: 'security-auditor',
      reason: 'code-quality-reviewer completed - proceeding with security scan',
      priority: 'high',
    };
  }

  // Rule 4: backend-system-architect with auth/security mentions -> security-layer-auditor
  if (agentType === 'backend-system-architect') {
    const lowerOutput = agentOutput.toLowerCase();
    if (/authentication|authorization|security|access.control|rbac|acl/.test(lowerOutput)) {
      logSpawn('Rule matched: backend-system-architect with auth -> security-layer-auditor');
      return {
        target: 'security-layer-auditor',
        reason: 'backend-system-architect designed auth/security layer - validation required',
        priority: 'high',
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function autoSpawnQuality(input: HookInput): HookResult {
  const timestamp = new Date().toISOString();

  const toolInput = input.tool_input || {};
  const agentType =
    (toolInput.subagent_type as string) ||
    input.subagent_type ||
    input.agent_type ||
    'unknown';
  const sessionId = input.session_id || getSessionId();
  const agentOutput = input.agent_output || input.output || '';
  const error = input.error || '';

  logSpawn(`Checking auto-spawn conditions for agent: ${agentType} (session: ${sessionId})`);

  // Skip if unknown agent type
  if (agentType === 'unknown' || !agentType) {
    logSpawn('Skipping unknown agent type');
    return outputSilentSuccess();
  }

  // Check auto-spawn conditions
  const spawnInfo = checkAutoSpawnConditions(agentType, agentOutput, error);

  if (spawnInfo) {
    // Queue the spawn request
    const spawnId = queueSpawn(
      agentType,
      spawnInfo.target,
      spawnInfo.reason,
      spawnInfo.priority,
      sessionId,
      timestamp
    );

    // Write spawn suggestion for orchestrator
    writeSpawnSuggestion(
      agentType,
      spawnInfo.target,
      spawnInfo.reason,
      spawnInfo.priority,
      sessionId,
      timestamp
    );

    // Log the action
    logSpawn(`=== AUTO-SPAWN QUALITY HOOK ===
Trigger Agent: ${agentType}
Target Agent: ${spawnInfo.target}
Reason: ${spawnInfo.reason}
Priority: ${spawnInfo.priority}
Spawn ID: ${spawnId}
Timestamp: ${timestamp}
Session: ${sessionId}`);

    return {
      continue: true,
      systemMessage: `Auto-spawn queued: ${spawnInfo.target} (${spawnInfo.priority} priority)`,
    };
  }

  logSpawn(`No auto-spawn conditions matched for ${agentType}`);
  return outputSilentSuccess();
}

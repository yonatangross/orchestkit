/**
 * Session Context Loader - Loads session context at session start
 * Hook: SessionStart
 * CC 2.1.7 Compliant - Context Protocol 2.0
 * Supports agent_type for context-aware initialization
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

/**
 * Validate JSON file
 */
function isValidJsonFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    JSON.parse(readFileSync(filePath, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Session context loader hook
 */
export function sessionContextLoader(input: HookInput): HookResult {
  logHook('session-context-loader', 'Session starting - loading context (Protocol 2.0)');

  const projectDir = input.project_dir || getProjectDir();
  let contextLoaded = 0;

  // Extract agent_type from environment (set by startup-dispatcher)
  const agentType = process.env.AGENT_TYPE || '';

  // Context Protocol 2.0 paths
  const sessionState = `${projectDir}/.claude/context/session/state.json`;
  const identityFile = `${projectDir}/.claude/context/identity.json`;
  const knowledgeIndex = `${projectDir}/.claude/context/knowledge/index.json`;

  // Load session state
  if (isValidJsonFile(sessionState)) {
    logHook('session-context-loader', 'Session state loaded');
    contextLoaded++;
  }

  // Load identity
  if (isValidJsonFile(identityFile)) {
    logHook('session-context-loader', 'Identity loaded');
    contextLoaded++;
  }

  // Check knowledge index
  if (isValidJsonFile(knowledgeIndex)) {
    logHook('session-context-loader', 'Knowledge index available');
    contextLoaded++;
  }

  // Load current status docs if they exist
  const statusFile = `${projectDir}/docs/CURRENT_STATUS.md`;
  if (existsSync(statusFile)) {
    logHook('session-context-loader', 'Current status document exists');
  }

  // Agent-type aware context loading (CC 2.1.6 feature)
  if (agentType) {
    logHook('session-context-loader', `Agent-type aware initialization: ${agentType}`);

    // Check if there's agent-specific configuration
    const agentConfig = `${projectDir}/.claude/agents/${agentType}.md`;
    if (existsSync(agentConfig)) {
      logHook('session-context-loader', `Agent configuration found: ${agentConfig}`);
      contextLoaded++;
    }
  }

  // Log summary
  if (contextLoaded > 0) {
    if (agentType) {
      logHook('session-context-loader', `Session context loaded (Protocol 2.0) - Agent: ${agentType}`);
    } else {
      logHook('session-context-loader', 'Session context loaded (Protocol 2.0)');
    }
  }

  // Note: SessionStart hooks don't support hookSpecificOutput.additionalContext
  return outputSilentSuccess();
}

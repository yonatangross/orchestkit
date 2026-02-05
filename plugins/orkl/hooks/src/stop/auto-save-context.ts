/**
 * Auto-Save Context - Saves session context before stop
 * Hook: Stop
 * CC 2.1.6 Compliant - Context Protocol 2.0
 *
 * Ensures state.json always has required fields:
 * - $schema: For schema validation
 * - _meta: For attention positioning and token budgets
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface SessionState {
  $schema: string;
  _meta: {
    position: string;
    token_budget: number;
    auto_load: string;
    compress: string;
    description: string;
  };
  session_id: string | null;
  started: string | null;
  last_activity: string;
  current_task: {
    description: string;
    status: string;
  };
  next_steps: string[];
  blockers: string[];
}

/**
 * Auto-save context on session stop
 */
export function autoSaveContext(input: HookInput): HookResult {
  logHook('auto-save-context', 'Stop hook - auto-saving context (Protocol 2.0)');

  const projectDir = input.project_dir || getProjectDir();
  const sessionDir = `${projectDir}/.claude/context/session`;
  const sessionState = `${sessionDir}/state.json`;

  // Ensure session directory exists
  try {
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }
  } catch {
    // Ignore directory creation errors
  }

  const timestamp = new Date().toISOString();

  try {
    if (existsSync(sessionState)) {
      // Update existing session state
      const content = readFileSync(sessionState, 'utf-8');
      const state: Partial<SessionState> = JSON.parse(content);

      // Ensure required fields exist
      const updated: SessionState = {
        $schema: state.$schema || 'context://session/v1',
        _meta: state._meta || {
          position: 'END',
          token_budget: 500,
          auto_load: 'always',
          compress: 'on_threshold',
          description: 'Session state and progress - ALWAYS loaded at END of context',
        },
        session_id: state.session_id || null,
        started: state.started || null,
        last_activity: timestamp,
        current_task: state.current_task || { description: 'No active task', status: 'pending' },
        next_steps: state.next_steps || [],
        blockers: state.blockers || [],
      };

      writeFileSync(sessionState, JSON.stringify(updated, null, 2));
      logHook('auto-save-context', 'Updated session state timestamp');
    } else {
      // Create new session state
      const newState: SessionState = {
        $schema: 'context://session/v1',
        _meta: {
          position: 'END',
          token_budget: 500,
          auto_load: 'always',
          compress: 'on_threshold',
          description: 'Session state and progress - ALWAYS loaded at END of context',
        },
        session_id: null,
        started: timestamp,
        last_activity: timestamp,
        current_task: {
          description: 'No active task',
          status: 'pending',
        },
        next_steps: [],
        blockers: [],
      };

      writeFileSync(sessionState, JSON.stringify(newState, null, 2));
      logHook('auto-save-context', 'Created new session state (Protocol 2.0 compliant)');
    }
  } catch (error) {
    logHook('auto-save-context', `Error saving context: ${error}`);
  }

  return outputSilentSuccess();
}

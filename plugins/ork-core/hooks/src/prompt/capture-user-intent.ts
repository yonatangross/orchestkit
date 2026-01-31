/**
 * Capture User Intent Hook - Extract decisions and preferences from user prompts
 *
 * Part of Intelligent Decision Capture System
 * Hook: UserPromptSubmit
 *
 * Purpose:
 * - Capture decisions when users say "let's use X" or "chose Y over Z"
 * - Extract preferences when users express "I prefer X"
 * - Track problems/issues for later solution pairing
 * - Store with rationale ("because...") when present
 *
 * Storage:
 * - Decisions/Preferences -> decisions.jsonl + graph-queue.jsonl + mem0-queue.jsonl
 *   (via createDecisionRecord + storeDecision from memory-writer)
 * - Problems -> .claude/memory/open-problems.jsonl + session tracker
 *
 * CC 2.1.16 Compliant - Uses outputSilentSuccess for non-blocking capture
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  getProjectDir,
  getSessionId,
  logHook,
} from '../lib/common.js';
import {
  detectUserIntent,
  type UserIntent,
  type IntentDetectionResult,
} from '../lib/user-intent-detector.js';
import {
  trackProblemReported,
} from '../lib/session-tracker.js';
import {
  createDecisionRecord,
  storeDecision,
} from '../lib/memory-writer.js';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'capture-user-intent';
const MIN_PROMPT_LENGTH = 15; // Skip very short prompts

// =============================================================================
// STORAGE TYPES
// =============================================================================

/**
 * Stored problem record for solution pairing
 */
interface StoredProblem {
  id: string;
  timestamp: string;
  session_id: string;
  type: 'problem';
  text: string;
  confidence: number;
  entities: string[];
  project: string;
  status: 'open' | 'solved' | 'abandoned';
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Get project name from directory
 */
function getProjectName(): string {
  const projectDir = getProjectDir();
  return projectDir.split('/').pop() || 'unknown';
}

/**
 * Append record to JSONL file
 */
function appendToJsonl(filePath: string, record: unknown): boolean {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(record) + '\n';
    appendFileSync(filePath, line);
    return true;
  } catch (err) {
    logHook(HOOK_NAME, `Failed to write to ${filePath}: ${err}`, 'warn');
    return false;
  }
}

/**
 * Store problems for later solution pairing
 */
function storeProblems(problems: UserIntent[], sessionId: string): number {
  if (problems.length === 0) return 0;

  const projectDir = getProjectDir();
  const filePath = join(projectDir, '.claude', 'memory', 'open-problems.jsonl');
  const project = getProjectName();
  const timestamp = new Date().toISOString();
  let stored = 0;

  for (const problem of problems) {
    const record: StoredProblem = {
      id: generateId('prob'),
      timestamp,
      session_id: sessionId,
      type: 'problem',
      text: problem.text,
      confidence: problem.confidence,
      entities: problem.entities,
      project,
      status: 'open',
    };

    if (appendToJsonl(filePath, record)) {
      stored++;
    }
  }

  return stored;
}

// =============================================================================
// CATEGORY INFERENCE
// =============================================================================

/**
 * Infer decision category from entities
 */
function inferCategory(entities: string[]): string {
  if (entities.length === 0) return 'general';

  const entityStr = entities.join(' ').toLowerCase();

  const categoryMap: Array<[string[], string]> = [
    [['postgresql', 'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'database', 'db'], 'database'],
    [['react', 'vue', 'angular', 'svelte', 'frontend', 'css', 'tailwind', 'ui'], 'frontend'],
    [['fastapi', 'django', 'express', 'nest', 'backend', 'api', 'rest', 'graphql'], 'backend'],
    [['docker', 'kubernetes', 'k8s', 'ci', 'cd', 'deploy', 'infrastructure'], 'infrastructure'],
    [['test', 'jest', 'vitest', 'pytest', 'testing', 'coverage'], 'testing'],
    [['typescript', 'python', 'rust', 'go', 'java', 'language'], 'language'],
    [['auth', 'security', 'jwt', 'oauth', 'encryption'], 'security'],
    [['cache', 'caching', 'performance', 'optimization'], 'performance'],
    [['architecture', 'pattern', 'design', 'structure'], 'architecture'],
  ];

  for (const [keywords, category] of categoryMap) {
    if (keywords.some(kw => entityStr.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

// =============================================================================
// DECISION/PREFERENCE STORAGE VIA MEMORY PIPELINE
// =============================================================================

/**
 * Store decisions and preferences through the memory pipeline.
 * Creates DecisionRecords and fires storeDecision() for each.
 * createDecisionRecord() internally calls trackDecisionMade/trackPreferenceStated
 * for session profile aggregation (lines 574-578 of memory-writer.ts).
 */
function storeDecisionsAndPreferences(
  result: IntentDetectionResult,
  sessionId: string
): void {
  try {
    // Store decisions through the memory pipeline
    for (const decision of result.decisions) {
      const record = createDecisionRecord(
        'decision',
        {
          what: decision.text,
          why: decision.rationale,
          ...(decision.alternatives?.length ? { alternatives: decision.alternatives } : {}),
          ...(decision.constraints?.length ? { constraints: decision.constraints } : {}),
          ...(decision.tradeoffs?.length ? { tradeoffs: decision.tradeoffs } : {}),
        },
        decision.entities,
        {
          session_id: sessionId,
          source: 'user_prompt',
          confidence: decision.confidence,
          category: inferCategory(decision.entities),
        }
      );
      // Fire-and-forget: hook is async:true with timeout:30 in hooks.json
      storeDecision(record).catch((err) => {
        logHook(HOOK_NAME, `storeDecision failed for decision: ${err}`, 'warn');
      });
    }

    // Store preferences through the memory pipeline
    for (const preference of result.preferences) {
      const record = createDecisionRecord(
        'preference',
        {
          what: preference.text,
        },
        preference.entities,
        {
          session_id: sessionId,
          source: 'user_prompt',
          confidence: preference.confidence,
          category: inferCategory(preference.entities),
        }
      );
      // Fire-and-forget
      storeDecision(record).catch((err) => {
        logHook(HOOK_NAME, `storeDecision failed for preference: ${err}`, 'warn');
      });
    }

    // Track problems via session tracker (problems don't go through DecisionRecord pipeline)
    for (const problem of result.problems) {
      trackProblemReported(problem.text);
    }
  } catch (err) {
    logHook(HOOK_NAME, `Memory pipeline storage failed: ${err}`, 'warn');
  }
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Capture user intent from prompts
 *
 * This hook runs on UserPromptSubmit and extracts:
 * - Decisions: "let's use X", "chose Y over Z"
 * - Preferences: "I prefer X", "always use Y"
 * - Problems: "error with X", "not working"
 *
 * All storage is fire-and-forget to avoid blocking the prompt.
 */
export function captureUserIntent(input: HookInput): HookResult {
  const prompt = input.prompt;

  // Skip if no prompt
  if (!prompt || prompt.length < MIN_PROMPT_LENGTH) {
    return outputSilentSuccess();
  }

  // Get session ID
  const sessionId = input.session_id || getSessionId();

  // Detect intents
  let result: IntentDetectionResult;
  try {
    result = detectUserIntent(prompt);
  } catch (err) {
    logHook(HOOK_NAME, `Intent detection failed: ${err}`, 'warn');
    return outputSilentSuccess();
  }

  // Nothing detected
  if (result.intents.length === 0) {
    return outputSilentSuccess();
  }

  // Store decisions and preferences through memory pipeline
  // (createDecisionRecord internally tracks to session events for profile aggregation)
  storeDecisionsAndPreferences(result, sessionId);

  // Store problems to open-problems.jsonl for problem-tracker.ts (GAP-005 wired via GAP-011)
  const problemsStored = storeProblems(result.problems, sessionId);

  if (problemsStored > 0) {
    logHook(HOOK_NAME, `Captured: ${problemsStored} problems`, 'info');
  }
  if (result.decisions.length > 0 || result.preferences.length > 0) {
    logHook(
      HOOK_NAME,
      `Tracked: ${result.decisions.length} decisions, ${result.preferences.length} preferences (to decisions.jsonl + queues)`,
      'debug'
    );
  }

  // Always silent success - this is a background capture hook
  return outputSilentSuccess();
}

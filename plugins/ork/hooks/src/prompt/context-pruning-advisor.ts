/**
 * Context Pruning Advisor - UserPromptSubmit Hook
 * Recommends context pruning when usage exceeds 70%
 *
 * Analyzes loaded context (skills, files, agent outputs) and scores by:
 * - Recency: How recently was it accessed? (0-10 points)
 * - Frequency: How often accessed this session? (0-10 points)
 * - Relevance: How related to current prompt? (0-10 points)
 *
 * Total score: 0-30 points
 * Pruning threshold: Items with score < 15 are candidates
 *
 * Issue: #126
 * CC 2.1.9 Compliant: Uses additionalContext for recommendations
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  outputPromptContext,
  logHook,
  getProjectDir,
  getSessionId,
} from '../lib/common.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Configuration
const CONTEXT_TRIGGER = 0.7; // Trigger at 70% context usage
const CONTEXT_CRITICAL = 0.95; // Critical threshold
const PRUNE_THRESHOLD_HIGH = 8; // Score 0-8: High priority pruning
const PRUNE_THRESHOLD_MED = 15; // Score 9-15: Medium priority pruning
const MAX_RECOMMENDATIONS = 5; // Limit recommendations

interface ContextItem {
  id: string;
  tags?: string[];
  last_accessed?: string;
  loaded_at?: string;
  access_count?: number;
  estimated_tokens?: number;
}

interface StateFile {
  session_id: string;
  updated_at: string;
  total_context_tokens: number;
  context_budget: number;
  items: ContextItem[];
}

/**
 * Calculate recency score (0-10) based on time since last access
 */
function calculateRecencyScore(lastAccessed: string | undefined): number {
  if (!lastAccessed) return 0;

  const currentTime = Date.now();
  let lastEpoch: number;

  if (/^\d+$/.test(lastAccessed)) {
    lastEpoch = parseInt(lastAccessed, 10);
  } else {
    lastEpoch = new Date(lastAccessed).getTime();
    if (isNaN(lastEpoch)) return 0;
  }

  const ageMinutes = (currentTime - lastEpoch) / (1000 * 60);

  if (ageMinutes <= 5) return 10;
  if (ageMinutes <= 15) return 8;
  if (ageMinutes <= 30) return 6;
  if (ageMinutes <= 60) return 4;
  if (ageMinutes <= 120) return 2;
  return 0;
}

/**
 * Calculate frequency score (0-10) based on access count
 */
function calculateFrequencyScore(count: number): number {
  if (count >= 10) return 10;
  if (count >= 7) return 8;
  if (count >= 4) return 6;
  if (count >= 2) return 4;
  if (count >= 1) return 2;
  return 0;
}

/**
 * Calculate relevance score (0-10) based on keyword overlap
 */
function calculateRelevanceScore(itemKeywords: string[], promptKeywords: string[]): number {
  if (itemKeywords.length === 0 || promptKeywords.length === 0) {
    return 2; // Generic/infrastructure default
  }

  const itemSet = new Set(itemKeywords.map((k) => k.toLowerCase()));
  const promptSet = new Set(promptKeywords.map((k) => k.toLowerCase()));

  let overlap = 0;
  for (const keyword of itemSet) {
    if (promptSet.has(keyword)) {
      overlap++;
    }
  }

  const overlapRatio = overlap / itemSet.size;

  if (overlapRatio >= 0.75) return 10;
  if (overlapRatio >= 0.5) return 8;
  if (overlapRatio >= 0.3) return 6;
  if (overlapRatio >= 0.15) return 4;
  if (overlap > 0) return 2;
  return 0;
}

/**
 * Extract keywords from user prompt
 */
function extractPromptKeywords(prompt: string): string[] {
  const stopwords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'that',
    'this',
    'have',
    'will',
    'can',
    'should',
    'would',
    'could',
  ]);

  return prompt
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g)
    ?.filter((word) => !stopwords.has(word))
    .slice(0, 20) || [];
}

/**
 * Get state file path
 */
function getStateFilePath(): string {
  const sessionId = getSessionId();
  return `/tmp/claude-context-tracking-${sessionId}.json`;
}

/**
 * Initialize or load state file
 */
function loadOrInitState(): StateFile {
  const stateFile = getStateFilePath();

  if (existsSync(stateFile)) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf8'));
    } catch {
      // Fall through to create new
    }
  }

  const sessionId = getSessionId();
  const state: StateFile = {
    session_id: sessionId,
    updated_at: new Date().toISOString(),
    total_context_tokens: 0,
    context_budget: 12000,
    items: [],
  };

  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Get estimated context usage percentage
 */
function getContextUsagePercentage(state: StateFile): number {
  // Try environment variable first (if available from CC)
  const envPercent = process.env.CLAUDE_CONTEXT_USAGE_PERCENT;
  if (envPercent) {
    const parsed = parseFloat(envPercent);
    if (!isNaN(parsed)) return parsed;
  }

  // Fallback to state file estimate
  if (state.context_budget > 0) {
    return state.total_context_tokens / state.context_budget;
  }

  return 0;
}

interface PruneCandidate {
  score: number;
  priority: string;
  itemId: string;
  tokens: number;
}

/**
 * Analyze context and generate pruning recommendations
 */
function analyzeAndRecommend(state: StateFile, promptKeywords: string[]): PruneCandidate[] {
  const candidates: PruneCandidate[] = [];

  for (const item of state.items) {
    const lastAccessed = item.last_accessed || item.loaded_at;
    const accessCount = item.access_count || 0;
    const keywords = item.tags || [];

    const recencyScore = calculateRecencyScore(lastAccessed);
    const frequencyScore = calculateFrequencyScore(accessCount);
    const relevanceScore = calculateRelevanceScore(keywords, promptKeywords);
    const totalScore = recencyScore + frequencyScore + relevanceScore;

    logHook(
      'context-pruning-advisor',
      `Scored ${item.id}: R=${recencyScore} F=${frequencyScore} V=${relevanceScore} Total=${totalScore}`
    );

    if (totalScore <= PRUNE_THRESHOLD_MED) {
      candidates.push({
        score: totalScore,
        priority: totalScore <= PRUNE_THRESHOLD_HIGH ? 'HIGH' : 'MED',
        itemId: item.id,
        tokens: item.estimated_tokens || 500,
      });
    }
  }

  // Sort by score ascending (lowest first) and limit
  return candidates.sort((a, b) => a.score - b.score).slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Build recommendation message
 */
function buildRecommendationMessage(candidates: PruneCandidate[]): string {
  let totalSavings = 0;
  const lines: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const { priority, itemId, score, tokens } = candidates[i];
    totalSavings += tokens;

    // Format item name for display
    const displayName = itemId.replace(/^(skill:|file:|agent:)/, '');
    lines.push(`  ${i + 1}. [${priority}] ${displayName} (score: ${score}, saves ~${tokens}t)`);
  }

  return `Context usage >70%. Pruning recommendations:
${lines.join('\n')}

Potential savings: ~${totalSavings} tokens
To prune: Archive or unload low-scoring context items.`;
}

/**
 * Context pruning advisor hook
 */
export function contextPruningAdvisor(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const prompt = input.prompt || '';

  // Ensure log directory exists
  const logDir = join(projectDir, 'logs');
  if (!existsSync(logDir)) {
    try {
      mkdirSync(logDir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  // Initialize/load state
  const state = loadOrInitState();

  // Get current context usage
  const contextUsage = getContextUsagePercentage(state);
  logHook(
    'context-pruning-advisor',
    `Context usage: ${contextUsage} (trigger threshold: ${CONTEXT_TRIGGER})`
  );

  // Fast exit: Context usage below threshold
  if (contextUsage < CONTEXT_TRIGGER) {
    logHook('context-pruning-advisor', 'Context usage within limits, no pruning needed');
    return outputSilentSuccess();
  }

  // Critical path: Context usage at critical level (>95%)
  if (contextUsage >= CONTEXT_CRITICAL) {
    logHook('context-pruning-advisor', `CRITICAL: Context usage at ${contextUsage * 100}% (>95%)`);
    const criticalMsg = `CRITICAL: Context usage at ${Math.round(contextUsage * 100)}% (>95%). Use /ork:context-compression immediately or manually archive old decisions and patterns.`;
    return outputPromptContext(criticalMsg);
  }

  // Extract keywords from current prompt
  if (!prompt) {
    logHook('context-pruning-advisor', 'No user prompt found in hook input, skipping analysis');
    return outputSilentSuccess();
  }

  const promptKeywords = extractPromptKeywords(prompt);
  logHook('context-pruning-advisor', `Extracted prompt keywords: ${promptKeywords.join(', ')}`);

  // Analyze context and generate recommendations
  const candidates = analyzeAndRecommend(state, promptKeywords);

  if (candidates.length > 0) {
    const message = buildRecommendationMessage(candidates);
    logHook(
      'context-pruning-advisor',
      `Recommending ${candidates.length} pruning candidates`
    );
    return outputPromptContext(message);
  }

  return outputSilentSuccess();
}

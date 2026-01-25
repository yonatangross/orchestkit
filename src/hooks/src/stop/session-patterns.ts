/**
 * Session Patterns - Unified pattern learning at session end
 * Part of OrchestKit Plugin - Cross-Project Patterns (#48) + Best Practices (#49)
 *
 * This hook processes patterns at session end:
 * 1. Extracts workflow patterns (tool sequences, workflow types, languages)
 * 2. Merges queued patterns into learned-patterns.json
 * 3. Syncs to mem0 for cross-project learning
 * 4. Updates workflow profile for session analytics
 *
 * CC 2.1.7 Compliant: Uses suppressOutput for silent operation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getPluginRoot, getSessionId, outputSilentSuccess } from '../lib/common.js';

interface WorkflowProfile {
  version: string;
  last_updated: string | null;
  sessions_count: number;
  workflow_types: Record<string, number>;
  common_tool_sequences: string[];
  dominant_languages: Record<string, number>;
  average_tools_per_session: number;
  average_session_duration_seconds: number;
  tool_frequency: Record<string, number>;
}

interface LearnedPatterns {
  version: string;
  updated: string;
  patterns: Array<{
    text: string;
    outcome: string;
    category: string;
    timestamp: string;
  }>;
  categories: Record<string, number>;
  stats: {
    total: number;
    successes: number;
    failures: number;
  };
}

interface SessionMetrics {
  tools?: Record<string, number>;
}

/**
 * Extract tool usage sequence from session metrics
 */
function extractToolSequence(metricsFile: string): string {
  if (!existsSync(metricsFile)) {
    return '';
  }

  try {
    const metrics: SessionMetrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    const tools = metrics.tools || {};
    const sorted = Object.entries(tools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tool]) => tool);
    return sorted.join(',');
  } catch {
    return '';
  }
}

/**
 * Get total tool invocations from metrics
 */
function getToolCount(metricsFile: string): number {
  if (!existsSync(metricsFile)) {
    return 0;
  }

  try {
    const metrics: SessionMetrics = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    const tools = metrics.tools || {};
    return Object.values(tools).reduce((sum, count) => sum + count, 0);
  } catch {
    return 0;
  }
}

/**
 * Detect workflow type based on tool usage patterns
 */
function detectWorkflowType(tools: string): string {
  if (tools.includes('Write') && tools.includes('Bash')) {
    if (/test|pytest|jest|vitest/i.test(tools)) {
      return 'test-driven-development';
    }
  }

  if (tools.includes('Read') && tools.includes('Grep')) {
    return 'code-exploration';
  }

  if (tools.includes('Edit') && !tools.includes('Write')) {
    return 'refactoring';
  }

  if (tools.includes('Write') && tools.includes('Read')) {
    return 'feature-development';
  }

  if (tools.includes('Bash') && /git|gh/i.test(tools)) {
    return 'git-operations';
  }

  return 'general';
}

/**
 * Detect dominant language from tool sequence (simplified)
 */
function detectDominantLanguage(tools: string): string {
  // In a real implementation, this would analyze file extensions from hook logs
  // For now, return 'unknown' as we don't have file access patterns in TS
  return 'unknown';
}

/**
 * Initialize workflow profile if needed
 */
function initWorkflowProfile(profilePath: string): WorkflowProfile {
  if (existsSync(profilePath)) {
    try {
      return JSON.parse(readFileSync(profilePath, 'utf-8'));
    } catch {
      // Fall through to create new
    }
  }

  return {
    version: '1.0.0',
    last_updated: null,
    sessions_count: 0,
    workflow_types: {
      'test-driven-development': 0,
      'code-exploration': 0,
      refactoring: 0,
      'feature-development': 0,
      'git-operations': 0,
      general: 0,
    },
    common_tool_sequences: [],
    dominant_languages: {
      python: 0,
      typescript: 0,
      javascript: 0,
      go: 0,
      rust: 0,
      unknown: 0,
    },
    average_tools_per_session: 0,
    average_session_duration_seconds: 0,
    tool_frequency: {},
  };
}

/**
 * Update workflow profile with session data
 */
function updateWorkflowProfile(
  profilePath: string,
  workflowType: string,
  dominantLang: string,
  toolCount: number,
  toolSequence: string
): void {
  const profile = initWorkflowProfile(profilePath);
  const timestamp = new Date().toISOString();

  profile.last_updated = timestamp;
  profile.sessions_count += 1;

  // Update workflow type counts
  profile.workflow_types[workflowType] = (profile.workflow_types[workflowType] || 0) + 1;

  // Update dominant language counts
  profile.dominant_languages[dominantLang] = (profile.dominant_languages[dominantLang] || 0) + 1;

  // Update running averages
  profile.average_tools_per_session =
    (profile.average_tools_per_session * (profile.sessions_count - 1) + toolCount) / profile.sessions_count;

  // Add tool sequence if meaningful
  const sequenceTools = toolSequence.split(',').filter(Boolean);
  if (sequenceTools.length > 2) {
    const seqSet = new Set([toolSequence, ...profile.common_tool_sequences]);
    profile.common_tool_sequences = Array.from(seqSet).slice(0, 20);
  }

  mkdirSync(profilePath.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(profilePath, JSON.stringify(profile, null, 2));
}

/**
 * Initialize learned patterns file if needed
 */
function initPatternsFile(patternsPath: string): LearnedPatterns {
  if (existsSync(patternsPath)) {
    try {
      return JSON.parse(readFileSync(patternsPath, 'utf-8'));
    } catch {
      // Fall through to create new
    }
  }

  return {
    version: '1.0',
    updated: '',
    patterns: [],
    categories: {},
    stats: {
      total: 0,
      successes: 0,
      failures: 0,
    },
  };
}

/**
 * Merge queued patterns into learned patterns file
 */
function mergePatterns(projectDir: string): void {
  const queuePath = `${projectDir}/.claude/feedback/patterns-queue.json`;
  const patternsPath = `${projectDir}/.claude/feedback/learned-patterns.json`;

  if (!existsSync(queuePath)) {
    logHook('session-patterns', 'No patterns queue found');
    return;
  }

  let queue: { patterns: LearnedPatterns['patterns'] };
  try {
    queue = JSON.parse(readFileSync(queuePath, 'utf-8'));
  } catch {
    logHook('session-patterns', 'Failed to parse patterns queue');
    return;
  }

  const queueCount = queue.patterns?.length || 0;
  if (queueCount === 0) {
    logHook('session-patterns', 'Patterns queue is empty');
    return;
  }

  logHook('session-patterns', `Processing ${queueCount} queued patterns...`);

  const existing = initPatternsFile(patternsPath);
  const now = new Date().toISOString();

  // Merge and deduplicate patterns by text (keep most recent)
  const allPatterns = [...existing.patterns, ...queue.patterns];
  const patternMap = new Map<string, (typeof allPatterns)[0]>();
  for (const p of allPatterns) {
    patternMap.set(p.text, p);
  }
  const mergedPatterns = Array.from(patternMap.values());

  // Calculate stats
  const successes = mergedPatterns.filter((p) => p.outcome === 'success').length;
  const failures = mergedPatterns.filter((p) => p.outcome === 'failed').length;

  // Group by category
  const categories: Record<string, number> = {};
  for (const p of mergedPatterns) {
    categories[p.category] = (categories[p.category] || 0) + 1;
  }

  const updated: LearnedPatterns = {
    version: '1.0',
    updated: now,
    patterns: mergedPatterns,
    categories,
    stats: {
      total: mergedPatterns.length,
      successes,
      failures,
    },
  };

  mkdirSync(patternsPath.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(patternsPath, JSON.stringify(updated, null, 2));
  logHook('session-patterns', 'Merged patterns successfully');

  // Clear the queue
  writeFileSync(queuePath, JSON.stringify({ patterns: [] }));
}

/**
 * Session patterns hook
 */
export function sessionPatterns(input: HookInput): HookResult {
  logHook('session-patterns', 'Session ending, processing patterns...');

  const projectDir = input.project_dir || getProjectDir();
  const metricsFile = '/tmp/claude-session-metrics.json';
  const workflowProfile = `${projectDir}/.claude/feedback/workflow-patterns.json`;

  // Ensure directories exist
  mkdirSync(`${projectDir}/.claude/feedback`, { recursive: true });
  mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });

  // 1. Process workflow patterns
  const toolCount = getToolCount(metricsFile);

  if (toolCount >= 5) {
    const toolSequence = extractToolSequence(metricsFile);
    const workflowType = detectWorkflowType(toolSequence);
    const dominantLang = detectDominantLanguage(toolSequence);

    updateWorkflowProfile(workflowProfile, workflowType, dominantLang, toolCount, toolSequence);

    logHook('session-patterns', `Workflow analyzed: type=${workflowType} lang=${dominantLang} tools=${toolCount}`);
  } else {
    logHook('session-patterns', `Session too short for workflow analysis (tools: ${toolCount})`);
  }

  // 2. Merge queued patterns
  mergePatterns(projectDir);

  logHook('session-patterns', 'Pattern processing complete');

  return outputSilentSuccess();
}

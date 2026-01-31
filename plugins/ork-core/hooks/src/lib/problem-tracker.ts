/**
 * Problem Tracker - Track open problems and pair them with solutions
 *
 * Part of Intelligent Decision Capture System
 *
 * Purpose:
 * - Track problems/issues mentioned by users
 * - Detect when tool outputs indicate solutions
 * - Pair problems with their solutions
 * - Store problem-solution pairs for learning
 *
 * CC 2.1.16 Compliant
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectDir, logHook } from './common.js';
// GAP-007: Wire trackSolutionFound to session events
import { trackSolutionFound } from './session-tracker.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tracked problem waiting for solution
 */
export interface Problem {
  /** Unique problem ID */
  id: string;
  /** Problem description text */
  text: string;
  /** When problem was reported */
  timestamp: string;
  /** Session where problem was reported */
  session_id: string;
  /** Current status */
  status: 'open' | 'solved' | 'abandoned';
  /** Technologies/patterns involved */
  entities: string[];
  /** Project name */
  project: string;
  /** Paired solution if solved */
  solution?: Solution;
}

/**
 * Solution that resolved a problem
 */
export interface Solution {
  /** Solution description */
  text: string;
  /** Tool that provided the solution */
  tool: string;
  /** File modified if applicable */
  file?: string;
  /** When solution was detected */
  timestamp: string;
  /** Confidence this is the actual solution */
  confidence: number;
  /** Exit code if Bash tool */
  exit_code?: number;
}

/**
 * Problem-solution pair for storage
 */
export interface ProblemSolutionPair {
  /** Problem ID */
  problem_id: string;
  /** Problem description */
  problem_text: string;
  /** Solution description */
  solution_text: string;
  /** Tool used */
  tool: string;
  /** File if applicable */
  file?: string;
  /** Entities involved */
  entities: string[];
  /** Solution confidence */
  confidence: number;
  /** When paired */
  paired_at: string;
  /** Session ID */
  session_id: string;
  /** Project */
  project: string;
}

// =============================================================================
// SOLUTION DETECTION PATTERNS
// =============================================================================

/**
 * Patterns indicating successful solution
 */
export const SOLUTION_SUCCESS_PATTERNS: RegExp[] = [
  // Test success
  /\b(all )?tests?\s*(passed|passing|pass)\b/i,
  /\b(test|tests)\s*(suite)?\s*(passed|successful|succeeded)\b/i,
  /\b\d+\s*passed?,?\s*0\s*failed\b/i,
  /\bOK\s*\(\d+\s*tests?\)/i,

  // Build success
  /\bbuild\s*(succeeded|successful|complete(d)?)\b/i,
  /\bcompiled?\s*successfully\b/i,
  /\bbundle\s*(created|generated)\b/i,

  // Fix/resolution indicators
  /\bfixed\b/i,
  /\bresolved\b/i,
  /\bsolved\b/i,
  /\bnow works\b/i,
  /\bworking\s*(now|correctly|properly)\b/i,
  /\bno\s*(more\s*)?(errors?|issues?|problems?)\b/i,

  // Status improvements
  /\bsuccess(ful(ly)?)?\b/i,
  /\bready\s*(for|to)\b/i,
  /\bcomplete(d)?\b/i,
];

/**
 * Patterns indicating failed attempt (not a solution)
 */
export const SOLUTION_FAILURE_PATTERNS: RegExp[] = [
  /\b(tests?\s*)?(failed|failing|failure)\b/i,
  /\berror(s)?\b/i,
  /\bexception\b/i,
  /\bcrash(ed|ing)?\b/i,
  /\btimeout\b/i,
  /\bnot\s*(found|working|defined)\b/i,
  /\bundefined\b/i,
  /\bsyntax\s*error\b/i,
  /\btype\s*error\b/i,
  /\bcannot\s*(find|read|import)\b/i,
];

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get path to open problems file
 */
function getOpenProblemsPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'open-problems.jsonl');
}

/**
 * Get path to problem-solutions file
 */
function getProblemSolutionsPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'problem-solutions.jsonl');
}

/**
 * Load open problems from JSONL file
 */
export function loadOpenProblems(sessionId?: string): Problem[] {
  const filePath = getOpenProblemsPath();

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const problems: Problem[] = [];

    for (const line of lines) {
      try {
        const problem = JSON.parse(line) as Problem;
        // Only return open problems, optionally filter by session
        if (problem.status === 'open') {
          if (!sessionId || problem.session_id === sessionId) {
            problems.push(problem);
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Return most recent first, limited to avoid memory issues
    return problems.slice(-50).reverse();
  } catch (err) {
    logHook('problem-tracker', `Failed to load open problems: ${err}`, 'warn');
    return [];
  }
}

/**
 * Update problem status in file (mark as solved/abandoned)
 */
export function updateProblemStatus(
  problemId: string,
  status: 'solved' | 'abandoned',
  solution?: Solution
): boolean {
  const filePath = getOpenProblemsPath();

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    let updated = false;

    const newLines = lines.map(line => {
      try {
        const problem = JSON.parse(line) as Problem;
        if (problem.id === problemId) {
          problem.status = status;
          if (solution) {
            problem.solution = solution;
          }
          updated = true;
          return JSON.stringify(problem);
        }
        return line;
      } catch {
        return line;
      }
    });

    if (updated) {
      writeFileSync(filePath, newLines.join('\n') + '\n');
    }

    return updated;
  } catch (err) {
    logHook('problem-tracker', `Failed to update problem ${problemId}: ${err}`, 'warn');
    return false;
  }
}

/**
 * Store problem-solution pair
 */
export function storeProblemSolutionPair(pair: ProblemSolutionPair): boolean {
  const filePath = getProblemSolutionsPath();

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(pair) + '\n';
    writeFileSync(filePath, line, { flag: 'a' });

    logHook(
      'problem-tracker',
      `Stored problem-solution pair: ${pair.problem_id} → ${pair.tool}`,
      'info'
    );

    return true;
  } catch (err) {
    logHook('problem-tracker', `Failed to store pair: ${err}`, 'warn');
    return false;
  }
}

// =============================================================================
// SOLUTION DETECTION
// =============================================================================

/**
 * Check if output contains solution indicators
 */
export function hasSolutionIndicators(output: string): boolean {
  return SOLUTION_SUCCESS_PATTERNS.some(pattern => pattern.test(output));
}

/**
 * Check if output contains failure indicators
 */
export function hasFailureIndicators(output: string): boolean {
  return SOLUTION_FAILURE_PATTERNS.some(pattern => pattern.test(output));
}

/**
 * Calculate confidence that output represents a solution to a problem
 */
export function calculateSolutionConfidence(
  problem: Problem,
  output: string,
  tool: string,
  exitCode?: number
): number {
  let confidence = 0.3; // Base confidence

  // Exit code is strong signal
  if (exitCode === 0) {
    confidence += 0.2;
  } else if (exitCode !== undefined && exitCode !== 0) {
    confidence -= 0.3;
  }

  // Success patterns boost confidence
  const successCount = SOLUTION_SUCCESS_PATTERNS.filter(p => p.test(output)).length;
  confidence += Math.min(0.3, successCount * 0.1);

  // Failure patterns reduce confidence
  const failureCount = SOLUTION_FAILURE_PATTERNS.filter(p => p.test(output)).length;
  confidence -= Math.min(0.4, failureCount * 0.15);

  // Entity overlap boosts confidence
  const outputLower = output.toLowerCase();
  const matchingEntities = problem.entities.filter(e => outputLower.includes(e.toLowerCase()));
  confidence += Math.min(0.15, matchingEntities.length * 0.05);

  // Certain tools are more likely to provide solutions
  if (tool === 'Bash') {
    // Bash with tests is strong signal
    if (/test|pytest|jest|vitest/i.test(output)) {
      confidence += 0.1;
    }
  } else if (tool === 'Write' || tool === 'Edit') {
    // Code changes could be fixes
    confidence += 0.05;
  }

  // Clamp to valid range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Summarize a solution from tool output
 */
export function summarizeSolution(output: string, tool: string, file?: string): string {
  // Try to extract a meaningful summary
  const lines = output.split('\n').filter(l => l.trim());

  // Look for success messages
  for (const pattern of SOLUTION_SUCCESS_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      const context = extractContext(output, match.index || 0);
      if (context) {
        return context.slice(0, 200);
      }
    }
  }

  // Fall back to first meaningful line
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 200) {
      return trimmed;
    }
  }

  // Generic summary based on tool
  if (file) {
    return `${tool} operation on ${file.split('/').pop()} completed`;
  }

  return `${tool} completed successfully`;
}

/**
 * Extract context around a match position
 */
function extractContext(text: string, position: number, windowSize: number = 100): string {
  const start = Math.max(0, position - 20);
  const end = Math.min(text.length, position + windowSize);
  let context = text.slice(start, end).trim();

  // Clean up
  context = context.replace(/\s+/g, ' ');

  // Find sentence boundaries
  const sentenceEnd = context.search(/[.!?]\s/);
  if (sentenceEnd > 20) {
    context = context.slice(0, sentenceEnd + 1);
  }

  return context;
}

/**
 * Pair a solution with matching problems
 *
 * Returns the number of problems paired
 */
export function pairSolutionWithProblems(
  output: string,
  tool: string,
  file: string | undefined,
  exitCode: number | undefined,
  sessionId: string
): number {
  // Skip if output looks like a failure
  if (hasFailureIndicators(output) && !hasSolutionIndicators(output)) {
    return 0;
  }

  // Load open problems
  const openProblems = loadOpenProblems(sessionId);
  if (openProblems.length === 0) {
    return 0;
  }

  const project = getProjectDir().split('/').pop() || 'unknown';
  const timestamp = new Date().toISOString();
  let paired = 0;

  for (const problem of openProblems) {
    const confidence = calculateSolutionConfidence(problem, output, tool, exitCode);

    // Only pair if reasonably confident
    if (confidence >= 0.6) {
      const solution: Solution = {
        text: summarizeSolution(output, tool, file),
        tool,
        file,
        timestamp,
        confidence,
        exit_code: exitCode,
      };

      // Update problem status
      const updated = updateProblemStatus(problem.id, 'solved', solution);

      if (updated) {
        // Store the pair
        const pair: ProblemSolutionPair = {
          problem_id: problem.id,
          problem_text: problem.text,
          solution_text: solution.text,
          tool,
          file,
          entities: problem.entities,
          confidence,
          paired_at: timestamp,
          session_id: sessionId,
          project,
        };

        if (storeProblemSolutionPair(pair)) {
          paired++;
          // GAP-007: Track solution in session events for profile aggregation
          trackSolutionFound(solution.text, problem.id, confidence);
        }
      }
    }
  }

  return paired;
}

/**
 * Abandon stale problems (older than threshold)
 */
export function abandonStaleProblems(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const openProblems = loadOpenProblems();
  const cutoff = Date.now() - maxAgeMs;
  let abandoned = 0;

  for (const problem of openProblems) {
    const problemTime = new Date(problem.timestamp).getTime();
    if (problemTime < cutoff) {
      if (updateProblemStatus(problem.id, 'abandoned')) {
        abandoned++;
      }
    }
  }

  if (abandoned > 0) {
    logHook('problem-tracker', `Abandoned ${abandoned} stale problems`, 'info');
  }

  return abandoned;
}

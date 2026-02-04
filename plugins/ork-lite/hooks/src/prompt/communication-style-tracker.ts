/**
 * Communication Style Tracker - UserPromptSubmit Hook
 * Detects user communication patterns to personalize interactions.
 * CC 2.1.7 Compliant
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System (Phase 2.2)
 *
 * Detects:
 * - Verbosity: terse | moderate | detailed
 * - Interaction type: question | command | discussion
 * - Technical level: beginner | intermediate | expert
 *
 * Performance optimization:
 * - Sampling mode: only analyzes every Nth prompt to reduce overhead
 * - Configure via COMM_STYLE_SAMPLE_RATE (default: 5)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { trackCommunicationStyle } from '../lib/session-tracker.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// =============================================================================
// TYPES
// =============================================================================

type Verbosity = 'terse' | 'moderate' | 'detailed';
type InteractionType = 'question' | 'command' | 'discussion';
type TechnicalLevel = 'beginner' | 'intermediate' | 'expert';

interface CommunicationStyle {
  verbosity: Verbosity;
  interaction_type: InteractionType;
  technical_level: TechnicalLevel;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'communication-style-tracker';
const MIN_PROMPT_LENGTH = 5;

// Verbosity thresholds
const TERSE_MAX_LENGTH = 30;
const MODERATE_MAX_LENGTH = 150;

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

// Question patterns
const QUESTION_PATTERNS = [
  /^(how|what|why|when|where|which|who|can\s+(you|i)|could\s+(you|i)|would\s+(you|i)|is\s+(it|there|this)|are\s+(there|these)|do\s+(you|i)|does|should|will|has|have)\b/i,
  /\?$/,
  /\b(explain|tell me|show me|help me understand)\b/i,
];

// Command patterns (imperative verbs)
const COMMAND_PATTERNS = [
  /^(fix|add|create|update|remove|delete|run|build|test|deploy|install|configure|set|get|make|write|read|edit|change|modify|implement|refactor)\b/i,
  /^(do|just|please|now|quickly)\s+(fix|add|create|update|run|build)/i,
  /^[a-z]+\s+(it|this|that|the)\b/i, // "fix it", "run this"
];

// Discussion patterns
const DISCUSSION_PATTERNS = [
  /^(i think|i believe|maybe|perhaps|i was thinking|let's discuss|what if|consider|i'm wondering|could we|should we|might we)\b/i,
  /\b(alternatively|on the other hand|however|but|although|pros and cons|trade-?off)\b/i,
  /\b(in my experience|from what i've seen|generally|typically|usually)\b/i,
];

// Beginner indicators
const BEGINNER_PATTERNS = [
  /\b(what (is|are|does)|how (do|does) .* work|explain|eli5|basics?|beginner|newbie|starter|learning|tutorial)\b/i,
  /\b(i('m| am) (new|confused|stuck|lost)|don't understand|can you explain)\b/i,
  /\b(step by step|for dummies|simple|easy)\b/i,
];

// Expert indicators (technical jargon)
const EXPERT_PATTERNS = [
  /\b(idempoten|determin|memoiz|currying|monad|functor|polymorphi|closure|hoisting|prototype chain)\b/i,
  /\b(HNSW|pgvector|FAISS|embeddings?|RAG|LLM|transformer|attention|tokeniz)\b/i,
  /\b(sharding|partition|replica|consistency|CAP theorem|ACID|eventual consistency)\b/i,
  /\b(microservic|kubernetes|k8s|helm|istio|service mesh|container orchestrat)\b/i,
  /\b(cursor.based pagination|connection pool|deadlock|race condition|mutex|semaphore)\b/i,
  /\b(dependency injection|inversion of control|SOLID|DRY|KISS|YAGNI)\b/i,
  /\b(async|await|promise|observable|event.loop|coroutine|generator)\b/i,
  /\b(O\(n\)|O\(log n\)|O\(1\)|big.?O|time complexity|space complexity)\b/i,
];

// Intermediate indicators (common dev terms)
const INTERMEDIATE_PATTERNS = [
  /\b(API|REST|GraphQL|JWT|OAuth|middleware|endpoint|route|controller)\b/i,
  /\b(component|hook|state|props|context|redux|store|dispatch)\b/i,
  /\b(migration|schema|model|ORM|query|index|foreign key)\b/i,
  /\b(unit test|integration test|e2e|mock|stub|fixture|coverage)\b/i,
  /\b(git|branch|merge|rebase|commit|PR|pull request)\b/i,
];

// =============================================================================
// DETECTION LOGIC
// =============================================================================

/**
 * Detect verbosity level from prompt length and structure
 */
function detectVerbosity(prompt: string): Verbosity {
  const trimmed = prompt.trim();
  const length = trimmed.length;

  // Check for detailed indicators beyond just length
  const hasMultipleSentences = (trimmed.match(/[.!?]\s+[A-Z]/g) || []).length >= 2;
  const hasExplanation = /\b(because|since|so that|in order to|the reason)\b/i.test(trimmed);
  const hasContext = /\b(context|background|currently|previously|before)\b/i.test(trimmed);

  if (length <= TERSE_MAX_LENGTH && !hasExplanation) {
    return 'terse';
  }

  if (length > MODERATE_MAX_LENGTH || hasMultipleSentences || hasExplanation || hasContext) {
    return 'detailed';
  }

  return 'moderate';
}

/**
 * Detect interaction type from prompt patterns
 */
function detectInteractionType(prompt: string): InteractionType {
  const trimmed = prompt.trim();

  // Check discussion patterns first (they can be long questions)
  for (const pattern of DISCUSSION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'discussion';
    }
  }

  // Check question patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'question';
    }
  }

  // Check command patterns
  for (const pattern of COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'command';
    }
  }

  // Default based on length - short is command, long is discussion
  if (trimmed.length < 50) {
    return 'command';
  }

  return 'discussion';
}

/**
 * Detect technical level from vocabulary and patterns
 */
function detectTechnicalLevel(prompt: string): TechnicalLevel {
  const trimmed = prompt.trim();

  // Count matches for each level
  let beginnerScore = 0;
  let intermediateScore = 0;
  let expertScore = 0;

  // Check beginner patterns
  for (const pattern of BEGINNER_PATTERNS) {
    if (pattern.test(trimmed)) {
      beginnerScore += 2;
    }
  }

  // Check expert patterns
  for (const pattern of EXPERT_PATTERNS) {
    if (pattern.test(trimmed)) {
      expertScore += 2;
    }
  }

  // Check intermediate patterns
  for (const pattern of INTERMEDIATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      intermediateScore += 1;
    }
  }

  // Terse commands with no questions often indicate expert
  if (trimmed.length < 40 && !trimmed.includes('?') && detectInteractionType(trimmed) === 'command') {
    expertScore += 1;
  }

  // Determine level based on scores
  if (beginnerScore > expertScore && beginnerScore > intermediateScore) {
    return 'beginner';
  }

  if (expertScore >= 2 || (expertScore > 0 && intermediateScore >= 2)) {
    return 'expert';
  }

  if (intermediateScore >= 2 || expertScore > 0) {
    return 'intermediate';
  }

  // Default to intermediate for ambiguous cases
  return 'intermediate';
}

/**
 * Detect full communication style
 */
function detectCommunicationStyle(prompt: string): CommunicationStyle {
  return {
    verbosity: detectVerbosity(prompt),
    interaction_type: detectInteractionType(prompt),
    technical_level: detectTechnicalLevel(prompt),
  };
}

// =============================================================================
// SAMPLING
// =============================================================================

/**
 * Get counter file path
 */
function getCounterFilePath(projectDir: string): string {
  return join(projectDir, '.claude', '.comm-style-counter');
}

/**
 * Get and increment counter for sampling
 */
function getAndIncrementCounter(projectDir: string): number {
  const counterFile = getCounterFilePath(projectDir);

  // Ensure directory exists
  const dir = dirname(counterFile);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  let counter = 0;
  if (existsSync(counterFile)) {
    try {
      counter = parseInt(readFileSync(counterFile, 'utf8').trim(), 10) || 0;
    } catch {
      // Ignore
    }
  }

  counter++;

  try {
    writeFileSync(counterFile, String(counter));
  } catch {
    // Ignore
  }

  return counter;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Communication style tracker hook
 *
 * Analyzes user prompts to detect communication patterns and stores them
 * in the user profile for personalized interactions.
 */
export function communicationStyleTracker(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  // Get sample rate from environment (default: 5 - analyze every 5th prompt)
  const sampleRate = parseInt(process.env.COMM_STYLE_SAMPLE_RATE || '5', 10);

  // Get and increment counter for sampling
  const counter = getAndIncrementCounter(projectDir);

  // Skip if not on sampling interval (for performance)
  if (sampleRate > 1 && counter % sampleRate !== 0) {
    return outputSilentSuccess();
  }

  logHook(HOOK_NAME, `Analyzing communication style (sample ${counter})`);

  // Skip empty or very short prompts
  if (!prompt || prompt.length < MIN_PROMPT_LENGTH) {
    return outputSilentSuccess();
  }

  // Skip prompts that look like commands (start with /)
  if (prompt.startsWith('/')) {
    return outputSilentSuccess();
  }

  try {
    // Detect communication style
    const style = detectCommunicationStyle(prompt);

    // Track in session tracker for user profile aggregation
    trackCommunicationStyle(style);

    logHook(
      HOOK_NAME,
      `Detected: verbosity=${style.verbosity}, type=${style.interaction_type}, level=${style.technical_level}`
    );
  } catch (error) {
    // Never crash the hook chain
    logHook(HOOK_NAME, `Error tracking communication style: ${error}`, 'warn');
  }

  return outputSilentSuccess();
}

// =============================================================================
// EXPORTS (for testing)
// =============================================================================

export {
  detectVerbosity,
  detectInteractionType,
  detectTechnicalLevel,
  detectCommunicationStyle,
  type CommunicationStyle,
  type Verbosity,
  type InteractionType,
  type TechnicalLevel,
  TERSE_MAX_LENGTH,
  MODERATE_MAX_LENGTH,
};

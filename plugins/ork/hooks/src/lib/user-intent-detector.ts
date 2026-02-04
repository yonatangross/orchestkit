/**
 * User Intent Detector - Smart extraction of decisions, preferences, and problems from user prompts
 *
 * Part of Intelligent Decision Capture System
 *
 * Purpose:
 * - Detect when users make decisions ("let's use X", "chose Y over Z")
 * - Extract preferences ("I prefer X", "always use Y")
 * - Identify problems being stated ("not working", "error with")
 * - Capture rationale ("because", "since", "to avoid")
 * - Extract mentioned entities (technologies, patterns, tools)
 *
 * CC 2.1.16 Compliant
 */

// =============================================================================
// TYPES
// =============================================================================

export type IntentType = 'decision' | 'preference' | 'problem' | 'question' | 'instruction';

/**
 * Extracted user intent with confidence scoring
 */
export interface UserIntent {
  /** Type of intent detected */
  type: IntentType;
  /** Confidence score 0-1 */
  confidence: number;
  /** The matched text segment */
  text: string;
  /** Technologies, patterns, tools mentioned */
  entities: string[];
  /** Rationale if "because/since/to avoid" clause present */
  rationale?: string;
  /** For decisions: what was chosen over what */
  alternatives?: string[];
  /** Constraints mentioned (must/need to/required) */
  constraints?: string[];
  /** Tradeoffs accepted (but/however/downside) */
  tradeoffs?: string[];
  /** Original match position */
  position: number;
}

/**
 * Result of intent detection on a prompt
 */
export interface IntentDetectionResult {
  /** All detected intents */
  intents: UserIntent[];
  /** High-confidence decisions (>=0.7) */
  decisions: UserIntent[];
  /** All preferences */
  preferences: UserIntent[];
  /** Questions asked */
  questions: UserIntent[];
  /** Problems/issues mentioned */
  problems: UserIntent[];
  /** Summary for logging */
  summary: string;
}

// =============================================================================
// PATTERN DEFINITIONS
// =============================================================================

/**
 * Decision patterns - when user makes a choice
 * Group 1: verb, Group 2: what was chosen, Group 3: alternative (if present)
 */
const DECISION_PATTERNS: RegExp[] = [
  // Active choices - simple form
  /\b(let'?s use|let'?s go with|going with|will use|should use)\s+([^.,!?\n]+)/gi,
  /\b(decided on|decided to use|decided to go with|decided to)\s+([^.,!?\n]+)/gi,
  /\b(chose|choose|selected|opting for|picked)\s+([^.,!?\n]+)/gi,
  // Using X for Y
  /\b(using)\s+([^.,!?\n]+)\s+for\s+/gi,
  // Comparison choices: "X over Y" or "X instead of Y"
  /\b(chose|prefer|selected|going with)\s+([\w][\w\s-]*?)\s+over\s+([\w][\w\s-]*)/gi,
  /\b(chose|prefer|selected|going with)\s+([\w][\w\s-]*?)\s+instead of\s+([\w][\w\s-]*)/gi,
  // Implementation decisions
  /\b(implementing|implement)\s+([^.,!?\n]+?)\s+(?:approach|pattern|solution)/gi,
  /\b(?:the|our)\s+(?:approach|decision|choice)\s+is\s+([^.,!?\n]+)/gi,
  // I/We decided
  /\bI\s+(decided|chose)\s+([^.,!?\n]+)/gi,
];

/**
 * Preference patterns - user stating preferences
 */
const PREFERENCE_PATTERNS: RegExp[] = [
  /\bi (prefer|like|always use|never use|want|favor)\s+([^.,!?\n]+)/gi,
  /\bi'd prefer\s+([^.,!?\n]+)/gi,
  /\b(my preference is|I'd rather|rather use)\s+([^.,!?\n]+)/gi,
  /\b(style should be|convention is|naming should)\s+([^.,!?\n]+)/gi,
  /\b(always|never)\s+(use|do|add|include)\s+([^.,!?\n]+)/gi,
  /\bdon't\s+(use|like|want)\s+([^.,!?\n]+)/gi,
];

/**
 * Problem patterns - user describing issues
 */
const PROBLEM_PATTERNS: RegExp[] = [
  /\b(issue|problem|error|bug|doesn't work|isn't working|can't|failing|broken)\b[^.!?\n]*[.!?]?/gi,
  /\bthe (\w[\w\s-]*) (is broken|isn't working|fails|errors|crashes)/gi,
  /\b(getting|seeing|having)\s+(an error|errors|issues|problems)\s+(with|in|when)\s+([^.,!?\n]+)/gi,
  /\b(fails|failed|failing)\s+(to|when|with)\s+([^.,!?\n]+)/gi,
  /\b(not working|doesn't work|won't work)\s*([^.,!?\n]*)/gi,
  /\b(timeout|exception|crash|hang|freeze)\s+(in|with|when|on)\s+([^.,!?\n]+)/gi,
];


/**
 * Question patterns - user asking questions
 */
const QUESTION_PATTERNS: RegExp[] = [
  /\bhow do I\s+([^?.\n]+)/gi,
  /\bhow can I\s+([^?.\n]+)/gi,
  /\bhow to\s+([^?.\n]+)/gi,
  /\bwhat is\s+([^?.\n]+)/gi,
  /\bwhat are\s+([^?.\n]+)/gi,
  /\bwhat does\s+([^?.\n]+)/gi,
  /\bwhy does\s+([^?.\n]+)/gi,
  /\bwhy is\s+([^?.\n]+)/gi,
  /\bwhy do\s+([^?.\n]+)/gi,
  /\bcan you\s+(explain|show|help)\s+([^?.\n]+)/gi,
  /\bwhere (is|are|do|does|can)\s+([^?.\n]+)/gi,
  /\bwhen (should|do|does|can)\s+([^?.\n]+)/gi,
];

/**
 * Rationale patterns - extract "because/since" clauses
 * Each pattern should have the rationale in group 1
 */
const RATIONALE_PATTERNS: RegExp[] = [
  /\bbecause\s+([^.,!?\n]+)/i,
  /\bsince\s+([^.,!?\n]+)/i,
  /\bdue to\s+([^.,!?\n]+)/i,
  /\bto avoid\s+([^.,!?\n]+)/i,
  /\bfor\s+(?:better|improved|faster|easier|simpler)\s+([^.,!?\n]+)/i,
  /\bso that\s+([^.,!?\n]+)/i,
  /\bin order to\s+([^.,!?\n]+)/i,
  /\bas it\s+([^.,!?\n]+)/i,
];

/**
 * Constraint patterns - extract "must/need to/required" clauses
 * Group 1 or 2 captures the constraint text
 */
const CONSTRAINT_PATTERNS: RegExp[] = [
  /\b(?:must|need to|required|constraint|requirement)\s+([^.,!?\n]+)/gi,
  /\b(?:have to|has to)\s+([^.,!?\n]+)/gi,
  /\b(?:mandatory|essential)\s+([^.,!?\n]+)/gi,
];

/**
 * Tradeoff patterns - extract "but/however/downside" clauses
 * Group 1 or 2 captures the tradeoff text
 */
const TRADEOFF_PATTERNS: RegExp[] = [
  /\b(?:tradeoff|trade-off|downside|drawback)\s*:?\s+([^.,!?\n]+)/gi,
  /\bbut\s+([^.,!?\n]+)/gi,
  /\bhowever\s+([^.,!?\n]+)/gi,
  /\balthough\s+([^.,!?\n]+)/gi,
  /\b(?:cost|limitation)\s+is\s+([^.,!?\n]+)/gi,
];

/**
 * Technology aliases → canonical name mapping.
 * Each key is an alias (or the canonical name itself).
 * Value is the canonical name emitted as the entity.
 * This deduplicates "postgres"/"postgresql" and similar variants.
 */
const TECHNOLOGY_ALIASES: Record<string, string> = {
  // Databases
  postgresql: 'postgresql', postgres: 'postgresql',
  pgvector: 'pgvector', redis: 'redis', mongodb: 'mongodb',
  sqlite: 'sqlite', mysql: 'mysql', dynamodb: 'dynamodb',
  // Frameworks
  fastapi: 'fastapi', django: 'django', flask: 'flask',
  express: 'express', nextjs: 'nextjs', 'next.js': 'nextjs',
  nest: 'nest', nestjs: 'nest', spring: 'spring', rails: 'rails',
  // Frontend
  react: 'react', vue: 'vue', angular: 'angular', svelte: 'svelte',
  solid: 'solid', qwik: 'qwik', astro: 'astro',
  // Languages
  typescript: 'typescript', python: 'python', javascript: 'javascript',
  rust: 'rust', go: 'go', java: 'java', kotlin: 'kotlin',
  // Auth
  jwt: 'jwt', oauth: 'oauth2', oauth2: 'oauth2', passkeys: 'passkeys',
  saml: 'saml', oidc: 'oauth2',
  // AI/ML
  langchain: 'langchain', langgraph: 'langgraph', langfuse: 'langfuse',
  openai: 'openai', anthropic: 'anthropic', llama: 'llama',
  // Infrastructure
  docker: 'docker', kubernetes: 'kubernetes', k8s: 'kubernetes',
  terraform: 'terraform', aws: 'aws', gcp: 'gcp', azure: 'azure',
  // Testing
  pytest: 'pytest', jest: 'jest', vitest: 'vitest',
  playwright: 'playwright', cypress: 'cypress', msw: 'msw',
  // Tools
  webpack: 'webpack', vite: 'vite', esbuild: 'esbuild',
  turbopack: 'turbopack', bun: 'bun', pnpm: 'pnpm', yarn: 'yarn',
};

/**
 * Pre-compiled word-boundary regex for each alias.
 * Uses \b for most terms; special handling for short terms
 * that could match as substrings (e.g. "go" in "going").
 */
const TECHNOLOGY_REGEX_MAP: Array<[RegExp, string]> = Object.entries(TECHNOLOGY_ALIASES).map(
  ([alias, canonical]) => {
    // Escape regex special chars (e.g. "next.js")
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [new RegExp(`\\b${escaped}\\b`, 'i'), canonical];
  }
);

const KNOWN_PATTERNS = [
  'cursor-pagination', 'offset-pagination', 'keyset-pagination',
  'repository-pattern', 'service-layer', 'clean-architecture',
  'dependency-injection', 'event-sourcing', 'cqrs', 'saga-pattern',
  'circuit-breaker', 'rate-limiting', 'retry-pattern',
  'cache-aside', 'write-through', 'read-through',
  'rag', 'semantic-search', 'vector-search',
  'tdd', 'bdd', 'ddd',
  'microservices', 'monolith', 'serverless',
  'rest', 'graphql', 'grpc', 'websocket', 'sse',
];

const KNOWN_TOOLS = [
  'grep', 'read', 'write', 'edit', 'glob', 'bash', 'task',
  'git', 'gh', 'npm', 'yarn', 'pnpm',
  'claude', 'cursor', 'vscode', 'vim', 'neovim',
];

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract entities (technologies, patterns, tools) from text.
 * Uses word-boundary regex to avoid false positives (e.g. "java" from "javascript")
 * and canonical aliases to deduplicate (e.g. "postgres"/"postgresql" → "postgresql").
 */
export function extractEntities(text: string): string[] {
  const entities: Set<string> = new Set();

  // Technologies: word-boundary matching with alias deduplication
  for (const [regex, canonical] of TECHNOLOGY_REGEX_MAP) {
    if (regex.test(text)) {
      entities.add(canonical);
    }
  }

  // Patterns: regex with hyphenated/space-separated support
  for (const pattern of KNOWN_PATTERNS) {
    const normalized = pattern.replace(/-/g, '[- ]?');
    if (new RegExp(`\\b${normalized}\\b`, 'i').test(text)) {
      entities.add(pattern);
    }
  }

  // Tools: word-boundary matching
  for (const tool of KNOWN_TOOLS) {
    if (new RegExp(`\\b${tool}\\b`, 'i').test(text)) {
      entities.add(tool);
    }
  }

  return [...entities];
}

/**
 * Extract rationale from text near a match position
 */
export function extractRationale(text: string, matchIndex: number): string | undefined {
  // Look in a window around the match
  const windowStart = Math.max(0, matchIndex - 50);
  const windowEnd = Math.min(text.length, matchIndex + 300);
  const window = text.slice(windowStart, windowEnd);

  for (const pattern of RATIONALE_PATTERNS) {
    const match = window.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 200); // Cap at 200 chars
    }
  }

  return undefined;
}

/**
 * Extract constraints from text near a match position
 */
export function extractConstraints(text: string, matchIndex: number): string[] {
  const windowStart = Math.max(0, matchIndex - 50);
  const windowEnd = Math.min(text.length, matchIndex + 400);
  const window = text.slice(windowStart, windowEnd);
  const constraints: string[] = [];

  for (const pattern of CONSTRAINT_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = window.matchAll(pattern);
    for (const match of matches) {
      const captured = (match[1] || match[2] || '').trim().slice(0, 200);
      if (captured.length > 5) {
        constraints.push(captured);
      }
    }
  }

  return [...new Set(constraints)].slice(0, 5);
}

/**
 * Extract tradeoffs from text near a match position
 */
export function extractTradeoffs(text: string, matchIndex: number): string[] {
  const windowStart = Math.max(0, matchIndex - 50);
  const windowEnd = Math.min(text.length, matchIndex + 400);
  const window = text.slice(windowStart, windowEnd);
  const tradeoffs: string[] = [];

  for (const pattern of TRADEOFF_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = window.matchAll(pattern);
    for (const match of matches) {
      const captured = (match[1] || match[2] || '').trim().slice(0, 200);
      if (captured.length > 5) {
        tradeoffs.push(captured);
      }
    }
  }

  return [...new Set(tradeoffs)].slice(0, 5);
}

/**
 * Calculate confidence based on match quality and context
 */
function calculateConfidence(
  matchText: string,
  hasRationale: boolean,
  hasAlternatives: boolean,
  entityCount: number
): number {
  let confidence = 0.5; // Base confidence

  // Strong patterns boost confidence
  if (/\b(decided|chose|selected)\b/i.test(matchText)) {
    confidence += 0.2;
  }

  // Rationale significantly boosts confidence
  if (hasRationale) {
    confidence += 0.15;
  }

  // Having alternatives shows explicit comparison
  if (hasAlternatives) {
    confidence += 0.1;
  }

  // More entities = more specific
  if (entityCount >= 1) confidence += 0.05;
  if (entityCount >= 2) confidence += 0.05;

  // Very short matches are less confident
  if (matchText.length < 20) {
    confidence -= 0.1;
  }

  return Math.min(0.99, Math.max(0.1, confidence));
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect user intents from prompt text
 *
 * @param prompt - The user's input text
 * @returns IntentDetectionResult with all detected intents
 */
export function detectUserIntent(prompt: string): IntentDetectionResult {
  const intents: UserIntent[] = [];

  // Skip very short prompts
  if (!prompt || prompt.length < 10) {
    return {
      intents: [],
      decisions: [],
      preferences: [],
      questions: [],
      problems: [],
      summary: 'No intents detected (prompt too short)',
    };
  }

  // ==========================================================================
  // Detect Decisions
  // ==========================================================================
  for (const pattern of DECISION_PATTERNS) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const matchText = match[0];
      const position = match.index || 0;

      // Extract what was chosen and alternatives
      let choice = '';
      let alternatives: string[] | undefined;

      if (match[3]) {
        // Pattern with alternatives (X over Y)
        choice = match[2]?.trim() || '';
        alternatives = [match[3].trim()];
      } else if (match[2]) {
        choice = match[2].trim();
      }

      if (!choice || choice.length < 2) continue;

      const rationale = extractRationale(prompt, position);
      const entities = extractEntities(matchText + (rationale || ''));
      const constraints = extractConstraints(prompt, position);
      const tradeoffs = extractTradeoffs(prompt, position);

      const confidence = calculateConfidence(
        matchText,
        !!rationale,
        !!alternatives,
        entities.length
      );

      intents.push({
        type: 'decision',
        confidence,
        text: matchText.slice(0, 300),
        entities,
        rationale,
        alternatives,
        ...(constraints.length > 0 ? { constraints } : {}),
        ...(tradeoffs.length > 0 ? { tradeoffs } : {}),
        position,
      });
    }
  }

  // ==========================================================================
  // Detect Preferences
  // ==========================================================================
  for (const pattern of PREFERENCE_PATTERNS) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const matchText = match[0];
      const position = match.index || 0;

      const entities = extractEntities(matchText);

      intents.push({
        type: 'preference',
        confidence: entities.length > 0 ? 0.8 : 0.6,
        text: matchText.slice(0, 300),
        entities,
        position,
      });
    }
  }

  // ==========================================================================
  // Detect Problems
  // ==========================================================================
  for (const pattern of PROBLEM_PATTERNS) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const matchText = match[0];
      const position = match.index || 0;

      const entities = extractEntities(matchText);

      intents.push({
        type: 'problem',
        confidence: 0.75,
        text: matchText.slice(0, 300),
        entities,
        position,
      });
    }
  }

  // ==========================================================================
  // Detect Questions
  // ==========================================================================
  for (const pattern of QUESTION_PATTERNS) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const matchText = match[0];
      const position = match.index || 0;

      const entities = extractEntities(matchText);

      intents.push({
        type: 'question',
        confidence: 0.8,
        text: matchText.slice(0, 300),
        entities,
        position,
      });
    }
  }

  // ==========================================================================
  // Deduplicate overlapping intents
  // ==========================================================================
  const uniqueIntents = deduplicateIntents(intents);

  // Categorize
  const decisions = uniqueIntents.filter(i => i.type === 'decision' && i.confidence >= 0.7);
  const preferences = uniqueIntents.filter(i => i.type === 'preference');
  const problems = uniqueIntents.filter(i => i.type === 'problem');
  const questions = uniqueIntents.filter(i => i.type === 'question');

  const summary = buildSummary(decisions, preferences, problems, questions);

  return {
    intents: uniqueIntents,
    decisions,
    preferences,
    questions,
    problems,
    summary,
  };
}

/**
 * Remove overlapping intents, keeping higher confidence ones
 */
function deduplicateIntents(intents: UserIntent[]): UserIntent[] {
  if (intents.length <= 1) return intents;

  // Sort by position
  const sorted = [...intents].sort((a, b) => a.position - b.position);
  const result: UserIntent[] = [];

  for (const intent of sorted) {
    // Check if this overlaps with any existing intent
    const overlaps = result.some(existing => {
      const existingEnd = existing.position + existing.text.length;
      const intentEnd = intent.position + intent.text.length;
      return (
        (intent.position >= existing.position && intent.position < existingEnd) ||
        (existing.position >= intent.position && existing.position < intentEnd)
      );
    });

    if (!overlaps) {
      result.push(intent);
    } else {
      // Keep the one with higher confidence if same type
      const overlappingIndex = result.findIndex(existing => {
        const existingEnd = existing.position + existing.text.length;
        const intentEnd = intent.position + intent.text.length;
        return (
          existing.type === intent.type &&
          ((intent.position >= existing.position && intent.position < existingEnd) ||
            (existing.position >= intent.position && existing.position < intentEnd))
        );
      });

      if (overlappingIndex >= 0 && intent.confidence > result[overlappingIndex].confidence) {
        result[overlappingIndex] = intent;
      }
    }
  }

  return result;
}

/**
 * Build summary string for logging
 */
function buildSummary(
  decisions: UserIntent[],
  preferences: UserIntent[],
  problems: UserIntent[],
  questions: UserIntent[]
): string {
  const parts: string[] = [];

  if (decisions.length > 0) {
    parts.push(`${decisions.length} decision${decisions.length > 1 ? 's' : ''}`);
  }
  if (preferences.length > 0) {
    parts.push(`${preferences.length} preference${preferences.length > 1 ? 's' : ''}`);
  }
  if (problems.length > 0) {
    parts.push(`${problems.length} problem${problems.length > 1 ? 's' : ''}`);
  }
  if (questions.length > 0) {
    parts.push(`${questions.length} question${questions.length > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return 'No intents detected';
  }

  return `Detected: ${parts.join(', ')}`;
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Check if prompt contains decision-like language
 */
export function hasDecisionLanguage(prompt: string): boolean {
  const decisionKeywords = [
    'decided', 'chose', 'selected', 'let\'s use', 'going with',
    'will use', 'opting for', 'picked', 'prefer',
  ];
  const lower = prompt.toLowerCase();
  return decisionKeywords.some(k => lower.includes(k));
}

/**
 * Check if prompt contains problem/issue language
 */
export function hasProblemLanguage(prompt: string): boolean {
  const problemKeywords = [
    'error', 'bug', 'issue', 'problem', 'failing', 'broken',
    'not working', 'doesn\'t work', 'crash', 'timeout',
  ];
  const lower = prompt.toLowerCase();
  return problemKeywords.some(k => lower.includes(k));
}

/**
 * Check if prompt contains question-like language
 */
export function hasQuestionLanguage(prompt: string): boolean {
  const questionKeywords = [
    'how do i', 'how can i', 'how to',
    'what is', 'what are', 'what does',
    'why does', 'why is', 'why do',
    'where is', 'where are',
    'when should', 'can you explain', 'can you help',
  ];
  const lower = prompt.toLowerCase();
  return questionKeywords.some(k => lower.includes(k));
}

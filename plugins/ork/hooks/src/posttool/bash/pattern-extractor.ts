/**
 * Pattern Extractor - Automatic pattern extraction from bash events
 * Part of OrchestKit Plugin - Cross-Project Patterns (#48) + Best Practices (#49)
 *
 * Automatically extracts patterns from:
 * - git commit messages
 * - gh pr merge
 * - test results (pass/fail)
 * - build results
 *
 * CC 2.1.9 Compliant: Uses additionalContext for pattern injection
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';

interface PatternQueue {
  patterns: PatternEntry[];
}

interface PatternEntry {
  text: string;
  category: string;
  outcome: string;
  source: string;
  timestamp: string;
  project: string;
}

// Tech detection patterns
const TECH_PATTERNS: Record<string, RegExp> = {
  JWT: /jwt|jsonwebtoken/i,
  OAuth2: /oauth|oauth2/i,
  PostgreSQL: /postgres|postgresql|psql/i,
  Redis: /redis/i,
  React: /react/i,
  FastAPI: /fastapi/i,
  SQLAlchemy: /sqlalchemy/i,
  Alembic: /alembic/i,
  'cursor-pagination': /cursor.based|keyset/i,
  'offset-pagination': /offset.pagination/i,
  WebSocket: /websocket/i,
  SSE: /sse|server.sent/i,
  GraphQL: /graphql/i,
  REST: /rest.api|restful/i,
};

// Category patterns from commit prefixes
const CATEGORY_PATTERNS: Record<string, RegExp> = {
  feature: /^feat:|^feature:/i,
  bugfix: /^fix:|^bugfix:/i,
  refactor: /^refactor:/i,
  optimization: /^perf:|^performance:/i,
  security: /^security:|^sec:/i,
  testing: /^test:|^tests:/i,
};

// Best practice category detection
const BEST_PRACTICE_CATEGORIES: Record<string, RegExp> = {
  pagination: /cursor|pagination|offset|limit|page/i,
  caching: /cache|redis|memcache|ttl/i,
  authentication: /auth|jwt|oauth|token|login/i,
  validation: /validate|validation|schema|pydantic|zod/i,
  testing: /test|spec|coverage|mock/i,
  security: /security|encrypt|hash|secret|credential/i,
  performance: /performance|optimize|cache|index/i,
  error_handling: /error|exception|retry|fallback/i,
};

/**
 * Get project ID from directory
 */
function getProjectId(): string {
  const projectDir = getProjectDir();
  return projectDir.split('/').pop() || 'unknown';
}

/**
 * Extract tech and pattern info from text
 */
function extractPatternInfo(text: string): { tech: string; pattern: string } {
  const textLower = text.toLowerCase();
  let tech = 'unknown';
  let pattern = 'general';

  // Detect technologies
  for (const [name, regex] of Object.entries(TECH_PATTERNS)) {
    if (regex.test(textLower)) {
      tech = name;
      break;
    }
  }

  // Detect patterns from commit prefixes
  for (const [name, regex] of Object.entries(CATEGORY_PATTERNS)) {
    if (regex.test(text)) {
      pattern = name;
      break;
    }
  }

  return { tech, pattern };
}

/**
 * Detect best practice category
 */
function detectBestPracticeCategory(text: string): string {
  for (const [category, regex] of Object.entries(BEST_PRACTICE_CATEGORIES)) {
    if (regex.test(text)) {
      return category;
    }
  }
  return 'general';
}

/**
 * Queue a pattern for storage (batched on session end)
 */
function queuePattern(
  text: string,
  category: string,
  outcome: string,
  source: string,
  patternsQueue: string
): void {
  const timestamp = new Date().toISOString();
  const projectId = getProjectId();

  // Initialize queue file if needed
  if (!existsSync(patternsQueue)) {
    try {
      mkdirSync(require('path').dirname(patternsQueue), { recursive: true });
      writeFileSync(patternsQueue, JSON.stringify({ patterns: [] }));
    } catch {
      return;
    }
  }

  try {
    const data: PatternQueue = JSON.parse(readFileSync(patternsQueue, 'utf8'));
    data.patterns.push({
      text,
      category,
      outcome,
      source,
      timestamp,
      project: projectId,
    });
    writeFileSync(patternsQueue, JSON.stringify(data, null, 2));
    logHook('pattern-extractor', `Queued pattern: category=${category} outcome=${outcome} source=${source}`);
  } catch {
    // Ignore queue errors
  }
}

/**
 * Handle git commit pattern extraction
 */
function handleGitCommit(command: string, exitCode: number, patternsQueue: string): void {
  // Extract commit message
  let commitMsg = '';
  const msgMatch = command.match(/-m\s+["']([^"']+)["']/) ||
                   command.match(/-m\s+([^\s]+)/);
  if (msgMatch) {
    commitMsg = msgMatch[1];
  }

  if (!commitMsg) {
    return;
  }

  const { tech, pattern } = extractPatternInfo(commitMsg);
  const category = detectBestPracticeCategory(commitMsg);
  const outcome = exitCode === 0 ? 'success' : 'failed';

  // Build descriptive text
  let patternText = commitMsg;
  if (tech !== 'unknown') {
    patternText = `[${tech}] ${commitMsg}`;
  }

  queuePattern(patternText, category, outcome, 'commit', patternsQueue);
}

/**
 * Handle PR merge pattern extraction
 */
function handlePrMerge(command: string, exitCode: number, patternsQueue: string): void {
  if (exitCode !== 0) {
    return;
  }

  // PR merge is always a success pattern (reviewed code)
  let prInfo = 'PR merged successfully';
  const prMatch = command.match(/gh\s+pr\s+merge\s+(\d+)/);
  if (prMatch) {
    prInfo = `PR #${prMatch[1]} merged`;
  }

  queuePattern(prInfo, 'decision', 'success', 'pr-merge', patternsQueue);
}

/**
 * Handle test result pattern extraction
 */
function handleTestResult(command: string, exitCode: number, patternsQueue: string): void {
  let testFramework = 'unknown';

  if (/pytest|py\.test/.test(command)) testFramework = 'pytest';
  else if (/jest/.test(command)) testFramework = 'jest';
  else if (/vitest/.test(command)) testFramework = 'vitest';
  else if (/npm\s+test|yarn\s+test|bun\s+test/.test(command)) testFramework = 'npm-test';
  else if (/go\s+test/.test(command)) testFramework = 'go-test';

  const outcome = exitCode === 0 ? 'success' : 'failed';
  const patternText = `Tests ${outcome === 'success' ? 'passed' : 'failed'} (${testFramework})`;

  queuePattern(patternText, 'testing', outcome, 'test-run', patternsQueue);
}

/**
 * Handle build result pattern extraction
 */
function handleBuildResult(command: string, exitCode: number, patternsQueue: string): void {
  let buildTool = 'unknown';

  if (/npm\s+run\s+build/.test(command)) buildTool = 'npm';
  else if (/yarn\s+build/.test(command)) buildTool = 'yarn';
  else if (/cargo\s+build/.test(command)) buildTool = 'cargo';
  else if (/make/.test(command)) buildTool = 'make';
  else if (/docker\s+build/.test(command)) buildTool = 'docker';

  const outcome = exitCode === 0 ? 'success' : 'failed';
  const patternText = `Build ${outcome === 'success' ? 'succeeded' : 'failed'} (${buildTool})`;

  queuePattern(patternText, 'build', outcome, 'build', patternsQueue);
}

/**
 * Extract patterns from bash events
 */
export function patternExtractor(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process Bash tool
  if (toolName !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = getField<string>(input, 'tool_input.command') || '';
  const exitCode = input.exit_code ?? 0;

  if (!command) {
    return outputSilentSuccess();
  }

  const commandLower = command.toLowerCase();
  const projectDir = getProjectDir();
  const patternsQueue = `${projectDir}/.claude/feedback/patterns-queue.json`;

  // Route to appropriate handler
  if (/git\s+commit/.test(commandLower)) {
    handleGitCommit(command, exitCode, patternsQueue);
  } else if (/gh\s+pr\s+merge/.test(commandLower)) {
    handlePrMerge(command, exitCode, patternsQueue);
  } else if (/pytest|jest|vitest|npm\s+test|yarn\s+test|bun\s+test|go\s+test/.test(commandLower)) {
    handleTestResult(command, exitCode, patternsQueue);
  } else if (/npm\s+run\s+build|yarn\s+build|cargo\s+build|make|docker\s+build/.test(commandLower)) {
    handleBuildResult(command, exitCode, patternsQueue);
  }

  return outputSilentSuccess();
}

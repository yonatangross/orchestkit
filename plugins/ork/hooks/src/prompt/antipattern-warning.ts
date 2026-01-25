/**
 * Antipattern Warning - UserPromptSubmit Hook
 * Proactive anti-pattern detection and warning injection
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for warnings
 *
 * Enhanced with Mem0 semantic search hints for project/global anti-patterns.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir } from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Keywords that indicate implementation intent
const IMPLEMENTATION_KEYWORDS = [
  'implement',
  'add',
  'create',
  'build',
  'set up',
  'setup',
  'configure',
  'use',
  'write',
  'make',
  'develop',
];

// Known anti-patterns database
const KNOWN_ANTIPATTERNS: Array<{ pattern: string; warning: string }> = [
  {
    pattern: 'offset pagination',
    warning:
      'Offset pagination causes performance issues on large tables. Use cursor-based pagination instead.',
  },
  {
    pattern: 'manual jwt validation',
    warning:
      'Manual JWT validation is error-prone. Use established libraries like python-jose or jsonwebtoken.',
  },
  {
    pattern: 'storing passwords in plaintext',
    warning: 'Never store passwords in plaintext. Use bcrypt, argon2, or scrypt.',
  },
  {
    pattern: 'global state',
    warning:
      'Global mutable state causes testing and concurrency issues. Use dependency injection.',
  },
  {
    pattern: 'synchronous file operations',
    warning: 'Synchronous file I/O blocks the event loop. Use async file operations.',
  },
  {
    pattern: 'n+1 query',
    warning: 'N+1 queries cause performance problems. Use eager loading or batch queries.',
  },
  {
    pattern: 'polling for real-time',
    warning: 'Polling is inefficient for real-time updates. Consider SSE or WebSocket.',
  },
];

interface LearnedPattern {
  text: string;
  outcome?: string;
}

interface PatternsFile {
  patterns?: LearnedPattern[];
}

interface GlobalAntipattern {
  pattern: string;
  warning: string;
}

interface GlobalPatternsFile {
  antipatterns?: GlobalAntipattern[];
}

/**
 * Check if prompt contains implementation keywords
 */
function isImplementationPrompt(prompt: string): boolean {
  const promptLower = prompt.toLowerCase();

  for (const keyword of IMPLEMENTATION_KEYWORDS) {
    if (promptLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect best practice category from prompt
 */
function detectCategory(prompt: string): string {
  const promptLower = prompt.toLowerCase();

  if (/pagination|cursor|offset|page/i.test(promptLower)) return 'pagination';
  if (/auth|jwt|oauth|login|session/i.test(promptLower)) return 'authentication';
  if (/cache|redis|memo/i.test(promptLower)) return 'caching';
  if (/database|sql|postgres|query/i.test(promptLower)) return 'database';
  if (/api|endpoint|rest|graphql/i.test(promptLower)) return 'api';

  return 'general';
}

/**
 * Search local patterns for anti-patterns
 */
function searchLocalAntipatterns(prompt: string, projectDir: string): string[] {
  const promptLower = prompt.toLowerCase();
  const warnings: string[] = [];

  // Check known anti-patterns
  for (const { pattern, warning } of KNOWN_ANTIPATTERNS) {
    if (promptLower.includes(pattern)) {
      warnings.push(warning);
    }
  }

  // Check learned patterns file
  const patternsFile = join(projectDir, '.claude', 'feedback', 'learned-patterns.json');
  if (existsSync(patternsFile)) {
    try {
      const data: PatternsFile = JSON.parse(readFileSync(patternsFile, 'utf8'));
      const failedPatterns = (data.patterns || []).filter((p) => p.outcome === 'failed');

      for (const pattern of failedPatterns) {
        if (pattern.text) {
          const patternLower = pattern.text.toLowerCase();
          const firstWord = patternLower.split(' ')[0];
          if (firstWord && promptLower.includes(firstWord)) {
            warnings.push(`Previously failed: ${pattern.text}`);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check global patterns
  const globalPatternsFile = join(process.env.HOME || '', '.claude', 'global-patterns.json');
  if (existsSync(globalPatternsFile)) {
    try {
      const data: GlobalPatternsFile = JSON.parse(readFileSync(globalPatternsFile, 'utf8'));
      for (const { pattern, warning } of data.antipatterns || []) {
        if (promptLower.includes(pattern.toLowerCase())) {
          warnings.push(`${pattern}: ${warning}`);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return warnings;
}

/**
 * Generate mem0 user ID for a scope
 */
function getMem0UserId(scope: string, projectDir: string): string {
  const projectName = projectDir.split('/').pop() || 'unknown';
  return `project:${projectName}:${scope}`;
}

/**
 * Build mem0 search hint for the prompt
 */
function buildMem0SearchHint(prompt: string, projectDir: string): string {
  const category = detectCategory(prompt);
  const userId = getMem0UserId('best-practices', projectDir);
  const globalUserId = `global:best-practices`;

  return `Before implementing, search Mem0 for relevant patterns (graph memory enabled):

1. Project anti-patterns (category: ${category}):
   mcp__mem0__search_memories with:
   {"query": "${prompt.slice(0, 50)}", "user_id": "${userId}", "filters": {"metadata.outcome": "failed"}}

2. Project best practices:
   mcp__mem0__search_memories with:
   {"query": "${prompt.slice(0, 50)}", "user_id": "${userId}", "filters": {"metadata.outcome": "success"}}

3. Cross-project failures:
   mcp__mem0__search_memories with:
   {"query": "${prompt.slice(0, 50)}", "user_id": "${globalUserId}", "filters": {"metadata.outcome": "failed"}}`;
}

/**
 * Antipattern warning hook - detects and warns about known anti-patterns
 */
export function antipatternWarning(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  if (!prompt) {
    return outputSilentSuccess();
  }

  // Only check implementation prompts
  if (!isImplementationPrompt(prompt)) {
    return outputSilentSuccess();
  }

  logHook('antipattern-warning', 'Checking prompt for anti-patterns...');

  // Search for matching anti-patterns
  const warnings = searchLocalAntipatterns(prompt, projectDir);

  // Build mem0 search hints
  const mem0SearchHints = buildMem0SearchHint(prompt, projectDir);

  if (warnings.length > 0) {
    logHook('antipattern-warning', `Found anti-pattern warnings: ${warnings.join(', ')}`);

    // Build warning message with mem0 search hints
    const warningMessage = `## Anti-Pattern Warning

The following patterns have previously caused issues:

${warnings.map((w) => `- ${w}`).join('\n')}

Consider alternative approaches before proceeding.

${mem0SearchHints}`;

    return outputPromptContext(warningMessage);
  }

  // No local warnings - provide mem0 search hints for significant implementation tasks
  if (/implement|build|create|develop/.test(prompt.toLowerCase())) {
    return outputPromptContext(mem0SearchHints);
  }

  return outputSilentSuccess();
}

/**
 * Antipattern Warning - UserPromptSubmit Hook
 * Proactive anti-pattern detection and warning injection
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for warnings
 *
 * Uses local pattern files and knowledge graph for anti-pattern detection.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir } from '../lib/common.js';
import { getHomeDir } from '../lib/paths.js';
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

  // Check global patterns (use getHomeDir for cross-platform compatibility)
  const globalPatternsFile = join(getHomeDir(), '.claude', 'global-patterns.json');
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

  if (warnings.length > 0) {
    logHook('antipattern-warning', `Found anti-pattern warnings: ${warnings.join(', ')}`);

    const warningMessage = `## Anti-Pattern Warning

The following patterns have previously caused issues:

${warnings.map((w) => `- ${w}`).join('\n')}

Consider alternative approaches before proceeding.

Search knowledge graph for more context: mcp__memory__search_nodes with query="${prompt.slice(0, 50)}"`;

    return outputPromptContext(warningMessage);
  }

  return outputSilentSuccess();
}

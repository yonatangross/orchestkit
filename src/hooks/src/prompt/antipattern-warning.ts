/**
 * Antipattern Warning - UserPromptSubmit Hook
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for warnings
 *
 * Architecture (2 layers):
 * 1. STATIC: materializeAntipatternRules() writes .claude/rules/antipatterns.md
 *    at session start. CC loads this into every prompt for FREE — no per-turn cost.
 *    This handles the 7 known anti-patterns (offset pagination, N+1, etc.).
 *    Still called by sync-session-dispatcher.ts at SessionStart — DO NOT DELETE.
 *
 * 2. DYNAMIC: antipatternWarning() ran per-turn to check project-specific
 *    learned patterns (learned-patterns.json) and cross-project global patterns
 *    (global-patterns.json).
 *
 * @deprecated antipatternWarning() (#972): Migrated to type:prompt hook in hooks.json.
 * The LLM now classifies antipatterns directly — no regex needed. This function is
 * no longer called by unified-dispatcher.ts but remains here for reference.
 * materializeAntipatternRules() is still used by sync-session-dispatcher.ts.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir, writeRulesFile } from '../lib/common.js';
import { getHomeDir } from '../lib/paths.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static anti-patterns — materialized to rules file at session start, NOT checked at runtime
const STATIC_ANTIPATTERNS: Array<{ pattern: string; warning: string }> = [
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
 * Materialize static anti-patterns to a rules file (called once at session start).
 * CC loads .claude/rules/ files into every prompt automatically — zero per-turn cost.
 */
export function materializeAntipatternRules(projectDir: string): void {
  const lines = STATIC_ANTIPATTERNS.map(({ pattern, warning }) => `- **${pattern}**: ${warning}`);
  const content = `# Anti-Pattern Warnings\n\nAvoid these known anti-patterns:\n\n${lines.join('\n')}\n`;
  const rulesDir = join(projectDir, '.claude', 'rules');
  writeRulesFile(rulesDir, 'antipatterns.md', content, 'antipattern-warning');
}

/**
 * Search dynamic learned patterns (project-local + global).
 * Static patterns are NOT checked here — they're in the rules file.
 */
function searchDynamicPatterns(prompt: string, projectDir: string): string[] {
  const promptLower = prompt.toLowerCase();
  const warnings: string[] = [];

  // Check project-specific learned patterns
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

  // Check cross-project global patterns
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
 * Antipattern warning hook — checks dynamic learned patterns per-turn.
 * Static patterns are handled by the rules file (zero cost).
 */
export function antipatternWarning(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  if (!prompt) {
    return outputSilentSuccess();
  }

  // Check dynamic patterns (learned + global) — no keyword gate needed
  const warnings = searchDynamicPatterns(prompt, projectDir);

  if (warnings.length > 0) {
    logHook('antipattern-warning', `Found dynamic pattern warnings: ${warnings.join(', ')}`);

    const warningMessage = `## Anti-Pattern Warning

The following patterns have previously caused issues:

${warnings.map((w) => `- ${w}`).join('\n')}

Consider alternative approaches before proceeding.`;

    return outputPromptContext(warningMessage);
  }

  return outputSilentSuccess();
}

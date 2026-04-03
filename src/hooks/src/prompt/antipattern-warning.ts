/**
 * Antipattern Warning - Static Rules Materializer
 *
 * materializeAntipatternRules() writes .claude/rules/antipatterns.md
 * at session start. CC loads this into every prompt for FREE — no per-turn cost.
 * Called by sync-session-dispatcher.ts at SessionStart.
 *
 * Dynamic per-turn pattern matching (antipatternWarning, searchDynamicPatterns)
 * was removed in v7.27.1 (#1145) — migrated to type:prompt hook in hooks.json.
 * The LLM now classifies antipatterns directly — no regex needed.
 */

import { writeRulesFile } from '../lib/common.js';
import { join } from 'node:path';
import type { HookContext } from '../types.js';

// Static anti-patterns — materialized to rules file at session start
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

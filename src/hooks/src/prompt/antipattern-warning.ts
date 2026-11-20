/**
 * Antipattern Warning - Static Rules Materializer
 *
 * materializeAntipatternRules() writes .claude/rules/antipatterns.md
 * at session start. CC loads rules files into every prompt; they ride the
 * prompt cache, but they are not free: each copy is injected as context.
 * When the user-global copy ($CLAUDE_CONFIG_DIR/rules/, default ~/.claude/rules/)
 * or any ancestor dir's .claude/rules/ copy already carries identical content,
 * the project-level write is skipped so the same text is not duplicated once
 * per project dir. CC loads .claude/rules from every ancestor of the session
 * dir, so a worktree or subproject under a seeded root would otherwise load it
 * twice (measured 2026-10-01: four identical copies in one session).
 * Called by sync-session-dispatcher.ts at SessionStart.
 *
 * Dynamic per-turn pattern matching (antipatternWarning, searchDynamicPatterns)
 * was removed in v7.27.1 (#1145) — migrated to type:prompt hook in hooks.json.
 * The LLM now classifies antipatterns directly — no regex needed.
 */

import { writeRulesFile, rulesFileMatches, rulesFileExists } from '../lib/common.js';
import { getHomeDir } from '../lib/paths.js';
import { dirname, join } from 'node:path';

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
      'Manual JWT validation is error-prone. Use established libraries like PyJWT or jsonwebtoken.',
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
 * Render the static anti-patterns rules file content.
 * Exported so tests can place a byte-identical copy at the user-global path.
 */
export function buildAntipatternsContent(): string {
  const lines = STATIC_ANTIPATTERNS.map(({ pattern, warning }) => `- **${pattern}**: ${warning}`);
  return `# Anti-Pattern Warnings\n\nAvoid these known anti-patterns:\n\n${lines.join('\n')}\n`;
}

/**
 * User-global rules directory: $CLAUDE_CONFIG_DIR/rules, default ~/.claude/rules.
 */
function userRulesDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(getHomeDir(), '.claude');
  return join(configDir, 'rules');
}

/**
 * True when some ancestor of projectDir (not projectDir itself, not the
 * filesystem root) holds a byte-identical .claude/rules/antipatterns.md.
 */
function ancestorRulesMatch(projectDir: string, content: string): boolean {
  let dir = dirname(projectDir);
  while (dirname(dir) !== dir) {
    if (rulesFileMatches(join(dir, '.claude', 'rules'), 'antipatterns.md', content)) {
      return true;
    }
    dir = dirname(dir);
  }
  return false;
}

/**
 * Materialize static anti-patterns to a rules file (called once at session start).
 * CC loads .claude/rules/ files into every prompt (prompt-cached, not free).
 * Seeds only absent project files, preserving existing project policy.
 * Skips seeding when the user-global copy or an ancestor's copy is
 * byte-identical, or ORK_NO_RULE_SEED=1. Hooks never overwrite or delete existing rules files.
 */
export function materializeAntipatternRules(projectDir: string): void {
  if (process.env.ORK_NO_RULE_SEED === '1') return;

  const content = buildAntipatternsContent();
  const rulesDir = join(projectDir, '.claude', 'rules');

  if (
    rulesFileExists(rulesDir, 'antipatterns.md') ||
    rulesFileMatches(userRulesDir(), 'antipatterns.md', content) ||
    ancestorRulesMatch(projectDir, content)
  ) {
    return;
  }

  writeRulesFile(rulesDir, 'antipatterns.md', content, 'antipattern-warning');
}

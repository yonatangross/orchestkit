/**
 * Corpus types and parser for lesson-cards.
 *
 * The corpus is assembled from:
 * - configs/lesson-patterns.json from newest hq-ext under cache
 * - ~/.claude/hq/floor-N/lessons.md (newest three floor dirs)
 *
 * This module is pure: types, path helpers and the lessons.md parser.
 * The fs reads happen in the hooks module (register.ts) at session.start
 * or on /lessons reload, never inside tool.call.
 */

/** Home directory from the environment, without importing node:os (hooks module rule). */
export function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/** Slash-joined path segments; sufficient for read-only fs access on all platforms. */
export function joinPath(...parts: string[]): string {
  return parts.filter(p => p.length > 0).join('/');
}

/** One entry from hq-ext's configs/lesson-patterns.json */
export interface LessonPattern {
  id: string;
  severity: 'block' | 'warn';
  category: string;
  pattern?: string;
  trigger_pattern?: string;
  block_pattern?: string;
  check_patterns?: string[];
  require_pattern?: string;
  file_glob?: string;
  file_match?: string;
  exclude_paths?: string[];
  tool_names?: string[];
  message: string;
  why?: string;
  example_fix?: string;
  window_lines?: number;
  repos?: string[];
}

/** One bullet parsed from lessons.md */
export interface LessonBullet {
  heading: string;
  text: string;
  tokens: string[]; // First N tokens for indexing
}

/** In-memory corpus loaded at session.start */
export interface Corpus {
  patterns: LessonPattern[];
  bullets: LessonBullet[];
  loadedAt: number;
  loadError?: string;
}

/**
 * Parse a lessons.md file into indexed bullets.
 *
 * Format:
 * ## heading
 * - bullet text
 * - bullet text
 */
export function parseLessonsMd(content: string): LessonBullet[] {
  const bullets: LessonBullet[] = [];
  let currentHeading = '';

  for (const line of content.split('\n')) {
    const headingMatch = /^##\s+(.+)$/.exec(line);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      continue;
    }

    const bulletMatch = /^-\s+(.+)$/.exec(line);
    if (bulletMatch && currentHeading) {
      const text = bulletMatch[1].trim();
      // Extract first few command tokens for indexing
      // Tokens like 'gh', 'git', 'pnpm', 'herdr', 'vm_stat', etc.
      const tokens = text.split(/\s+/).slice(0, 3).filter(t => /^[a-z_-]/i.test(t));
      bullets.push({
        heading: currentHeading,
        text,
        tokens,
      });
    }
  }

  return bullets;
}

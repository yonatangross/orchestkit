/**
 * Corpus loader for lesson-cards.
 *
 * Reads:
 * - configs/lesson-patterns.json from newest hq-ext under cache
 * - ~/.claude/hq/floor-*/lessons.md (newest three files)
 *
 * All reads happen at session.start or on /lessons reload, never inside tool.call.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { $ } from './types.js';

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

/**
 * Find the newest hq-ext version directory.
 */
async function findNewestHqExt($: $): Promise<string | null> {
  const cacheBase = join(homedir(), '.claude', 'plugins', 'cache', 'yonatan-hq', 'hq-ext');

  try {
    const entries = await $.fs.list(cacheBase);
    if (!entries || entries.length === 0) return null;

    // Sort by version, highest first
    const versions = entries
      .filter(e => e.isDirectory)
      .map(e => e.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    return versions.length > 0 ? join(cacheBase, versions[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Load lesson-patterns.json from hq-ext cache.
 */
async function loadPatterns($: $, hqExtPath: string): Promise<LessonPattern[]> {
  const configPath = join(hqExtPath, 'configs', 'lesson-patterns.json');
  try {
    const content = await $.fs.read(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Load newest three lessons.md files.
 */
async function loadLessonsMds($: $): Promise<LessonBullet[]> {
  const hqBase = join(homedir(), '.claude', 'hq');
  const allBullets: LessonBullet[] = [];

  try {
    // Find floor-* directories
    const hqEntries = await $.fs.list(hqBase);
    if (!hqEntries) return [];

    const floorDirs = hqEntries
      .filter(e => e.isDirectory && e.name.startsWith('floor-'))
      .map(e => join(hqBase, e.name));

    // Collect lessons.md files with their mtime
    const lessonsFiles: { path: string; mtime: number }[] = [];
    for (const dir of floorDirs) {
      const lessonsPath = join(dir, 'lessons.md');
      try {
        const stat = await $.fs.stat(lessonsPath);
        if (stat) {
          lessonsFiles.push({ path: lessonsPath, mtime: stat.mtime ?? 0 });
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    // Sort by mtime, newest first, take top 3
    lessonsFiles.sort((a, b) => b.mtime - a.mtime);
    const newest = lessonsFiles.slice(0, 3);

    for (const { path } of newest) {
      try {
        const content = await $.fs.read(path, 'utf-8');
        if (typeof content === 'string') {
          allBullets.push(...parseLessonsMd(content));
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // hq directory doesn't exist
  }

  return allBullets;
}

/**
 * Load the full corpus at session.start.
 */
export async function loadCorpus($: $): Promise<Corpus> {
  const startTime = Date.now();

  try {
    const hqExtPath = await findNewestHqExt($);

    const [patterns, bullets] = await Promise.all([
      hqExtPath ? loadPatterns($, hqExtPath) : Promise.resolve([]),
      loadLessonsMds($),
    ]);

    return {
      patterns,
      bullets,
      loadedAt: Date.now(),
    };
  } catch (err) {
    return {
      patterns: [],
      bullets: [],
      loadedAt: startTime,
      loadError: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

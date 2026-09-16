/**
 * Hook registration for lesson-cards.
 *
 * Events:
 * - session.start: Load corpus (patterns + bullets)
 * - tool.call{tool=Bash}: Match command, return context
 * - tool.call{tool=Edit}: Match file/content, return context
 * - tool.call{tool=Write}: Match file/content, return context
 * - ui.render{component=ToolUse}: Append card under tool row
 * - command.register: /lessons reload command
 *
 * Hooks module format: exports register(on, options); $ is only ever used
 * as $.noun.event(...), so all $-taking helpers live in this file.
 */

import {
  parseLessonsMd,
  homeDir,
  joinPath,
  type Corpus,
  type LessonPattern,
  type LessonBullet,
} from '../src/corpus.js';
import { matchAll, matchFileEdit } from '../src/match.js';
import { buildCard, formatContext } from '../src/card.js';
import type { MatchedLesson } from '../src/types.js';

/** Minimal $ facade for the events this module uses. */
type Hook$ = {
  fs: {
    read: (path: string, encoding?: string) => Promise<string | Uint8Array>;
    list: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }> | null>;
    stat: (path: string) => Promise<{ size: number; mtime?: number; isFile: boolean; isDirectory: boolean } | null>;
  };
  ui: {
    notice: (toolUseId: string, message: string) => Promise<void>;
    invalidate: (component: string) => Promise<void>;
  };
};

type ToolCallEvent = {
  tool: string;
  args: Record<string, unknown>;
  tool_use_id?: string;
};

type UiRenderEvent = {
  component: string;
  requestId?: string;
};

type NextFn<E> = (ev: E) => Promise<unknown>;

// Module-scope state (per session)
let corpus: Corpus | null = null;
const matchMap = new Map<string, MatchedLesson[]>();

/**
 * Find the newest hq-ext version directory.
 */
async function findNewestHqExt($: Hook$): Promise<string | null> {
  const cacheBase = joinPath(homeDir(), '.claude', 'plugins', 'cache', 'yonatan-hq', 'hq-ext');

  try {
    const entries = await $.fs.list(cacheBase);
    if (!entries || entries.length === 0) return null;

    // Sort by version, highest first
    const versions = entries
      .filter(e => e.isDirectory)
      .map(e => e.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    return versions.length > 0 ? joinPath(cacheBase, versions[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Load lesson-patterns.json from hq-ext cache.
 */
async function loadPatterns($: Hook$, hqExtPath: string): Promise<LessonPattern[]> {
  const configPath = joinPath(hqExtPath, 'configs', 'lesson-patterns.json');
  try {
    const content = await $.fs.read(configPath, 'utf-8');
    if (typeof content !== 'string') return [];
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? (parsed as LessonPattern[]) : [];
  } catch {
    return [];
  }
}

/**
 * Load newest three lessons.md files.
 */
async function loadLessonsMds($: Hook$): Promise<LessonBullet[]> {
  const hqBase = joinPath(homeDir(), '.claude', 'hq');
  const allBullets: LessonBullet[] = [];

  try {
    // Find floor directories
    const hqEntries = await $.fs.list(hqBase);
    if (!hqEntries) return [];

    const floorDirs = hqEntries
      .filter(e => e.isDirectory && e.name.startsWith('floor-'))
      .map(e => joinPath(hqBase, e.name));

    // Collect lessons.md files with their mtime
    const lessonsFiles: { path: string; mtime: number }[] = [];
    for (const dir of floorDirs) {
      const lessonsPath = joinPath(dir, 'lessons.md');
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
async function loadCorpus($: Hook$): Promise<Corpus> {
  const startTime = Date.now();

  try {
    const hqExtPath = await findNewestHqExt($);

    const [patterns, bullets] = await Promise.all([
      hqExtPath ? loadPatterns($, hqExtPath) : Promise.resolve([] as LessonPattern[]),
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

/**
 * Register the lesson-cards hooks.
 */
export function register(on: (event: string, hook: unknown) => void, _options?: unknown): void {
  on('session.start', async ($: Hook$) => {
    corpus = await loadCorpus($);
    matchMap.clear();
  });

  on('tool.call', async ($: Hook$, e: ToolCallEvent, next?: NextFn<ToolCallEvent>) => {
    const { tool, args, tool_use_id } = e;
    const requestId = tool_use_id || `tool-${Date.now()}`;

    // First, let the tool execute
    const result = next ? ((await next(e)) ?? {}) : {};

    if (!corpus) {
      return result;
    }

    let matches: MatchedLesson[] = [];

    if (tool === 'Bash') {
      const command = String(args.command || '');
      if (command) {
        matches = matchAll(command, corpus.patterns, corpus.bullets);
      }
    } else if (tool === 'Edit') {
      const filePath = String(args.file_path || '');
      const newContent = String(args.new_content || args.content || '');
      if (filePath) {
        matches = matchFileEdit(filePath, newContent, corpus.patterns);
      }
    } else if (tool === 'Write') {
      const filePath = String(args.file_path || '');
      const content = String(args.content || '');
      if (filePath) {
        matches = matchFileEdit(filePath, content, corpus.patterns);
      }
    }

    if (matches.length === 0) {
      return result;
    }

    // Store matches for ui.render
    matchMap.set(requestId, matches);

    // Try to show notice during permission dialog (only works if dialog is open)
    try {
      await $.ui.notice(requestId, `lesson: ${matches[0].id}`);
    } catch {
      // Notice refused - dialog not open, ignore
    }

    // Add context for model
    const context = formatContext(matches[0]);
    return { ...result, context: [context] };
  });

  on('ui.render', async ($: Hook$, e: UiRenderEvent, next?: NextFn<UiRenderEvent>) => {
    if (e.component !== 'ToolUse') {
      return next ? await next(e) : {};
    }

    // Get the rendered tree
    const tree = next ? await next(e) : {};

    if (!e.requestId || !matchMap.has(e.requestId)) {
      return tree;
    }

    const matches = matchMap.get(e.requestId);
    if (!matches || matches.length === 0) {
      return tree;
    }

    // Append card under the tool row
    const card = buildCard(matches[0], e.requestId);

    const treeWithCard = tree as { children?: unknown[] };
    if (!treeWithCard.children) {
      treeWithCard.children = [];
    }
    treeWithCard.children.push(card);

    return tree;
  });

  on('command.register', async ($: Hook$, e: { command: string }) => {
    if (e.command === '/lessons') {
      // Reload corpus
      corpus = await loadCorpus($);
      matchMap.clear();
      // Invalidate UI to show updated state
      try {
        await $.ui.invalidate('ui.render');
      } catch {
        // Ignore if invalidate fails
      }
      return { message: 'Lessons reloaded' };
    }
    return {};
  });
}

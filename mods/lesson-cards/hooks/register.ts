/**
 * Hook registration for lesson-cards.
 *
 * Events:
 * - session.start: Load corpus (patterns + bullets)
 * - tool.call{tool=Bash}: Match command, return context
 * - tool.call{tool=Edit}: Match file/content, return context
 * - tool.call{tool=Write}: Match file/content, return context
 * - ui.render{component=ToolUse}: Append card under tool row
 * - command.run{command=lessons}: /lessons reload (declared with $.command.register at session start)
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
import { buildCard, formatContext, type CardElements } from '../src/card.js';
import type { MatchedLesson } from '../src/types.js';

/** Minimal $ facade for the events this module uses. */
type Hook$ = {
  env: {
    get: (name: string) => Promise<string | undefined>;
  };
  fs: {
    read: (path: string) => Promise<string>;
    list: (path: string) => Promise<Array<{ name: string; kind: 'file' | 'dir' | 'other' }> | null>;
    stat: (path: string) => Promise<{ size: number; mtimeMs: number; kind: 'file' | 'dir' | 'other' } | null>;
  };
  ui: {
    notice: (toolUseId: string, message: string) => Promise<void>;
    invalidate: (component: string) => Promise<void>;
    /** The AskUserQuestion dialog: resolves to the label the user picked. */
    ask: (question: string, options: readonly string[]) => Promise<unknown>;
    /** The element constructors this render may return (Box, Text, ...). */
    resolve: (e: UiRenderEvent) => Promise<CardElements>;
  };
  command: {
    register: (spec: { name: string; description: string }) => Promise<unknown>;
  };
};

type ToolCallEvent = {
  tool: string;
  tool_use_id?: string;
  [argument: string]: unknown;
};

type UiRenderEvent = {
  component: string;
  requestId?: string;
};

/** The two answers the block-lesson dialog offers. */
export const PROCEED = 'Proceed anyway';
export const CANCEL = 'Cancel';

type NextFn<E> = (ev: E) => Promise<unknown>;

type SessionStartEvent = { cwd: string; isInteractive: boolean };

// Module-scope state (per session)
let corpus: Corpus | null = null;
const matchMap = new Map<string, MatchedLesson[]>();

/**
 * Find the newest hq-ext version directory.
 */
async function findNewestHqExt($: Hook$, home: string): Promise<string | null> {
  const cacheBase = joinPath(home, '.claude', 'plugins', 'cache', 'yonatan-hq', 'hq-ext');

  try {
    const entries = await $.fs.list(cacheBase);
    if (!entries || entries.length === 0) return null;

    // Sort by version, highest first
    const versions = entries
      .filter(e => e.kind === 'dir')
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
    const content = await $.fs.read(configPath);
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
async function loadLessonsMds($: Hook$, home: string): Promise<LessonBullet[]> {
  const hqBase = joinPath(home, '.claude', 'hq');
  const allBullets: LessonBullet[] = [];

  try {
    // Find floor directories
    const hqEntries = await $.fs.list(hqBase);
    if (!hqEntries) return [];

    const floorDirs = hqEntries
      .filter(e => e.kind === 'dir' && e.name.startsWith('floor-'))
      .map(e => joinPath(hqBase, e.name));

    // Collect lessons.md files with their mtime
    const lessonsFiles: { path: string; mtime: number }[] = [];
    for (const dir of floorDirs) {
      const lessonsPath = joinPath(dir, 'lessons.md');
      try {
        const stat = await $.fs.stat(lessonsPath);
        if (stat && stat.kind === 'file') {
          lessonsFiles.push({ path: lessonsPath, mtime: stat.mtimeMs });
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
        const content = await $.fs.read(path);
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
  // A mod has no process.env: HOME comes from $.env (types/claude-code.d.ts `$.env.get("HOME")`).
  // With homeDir() alone the path was relative, resolved under the session's cwd, and the
  // corpus loaded 0 entries on CC 2.1.282.
  const home = (await $.env.get('HOME').catch(() => undefined)) || homeDir();
  const startTime = Date.now();

  try {
    const hqExtPath = await findNewestHqExt($, home);

    const [patterns, bullets] = await Promise.all([
      hqExtPath ? loadPatterns($, hqExtPath) : Promise.resolve([] as LessonPattern[]),
      loadLessonsMds($, home),
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
 * Match one tool call against the corpus: Bash by command, Edit and Write by
 * file path and new content. Pure over its inputs; the hook owns all I/O.
 */
function matchToolCall(e: ToolCallEvent, loaded: Corpus): MatchedLesson[] {
  const args: Record<string, unknown> = e;
  if (e.tool === 'Bash') {
    const command = String(args.command || '');
    return command ? matchAll(command, loaded.patterns, loaded.bullets) : [];
  }
  if (e.tool === 'Edit') {
    const filePath = String(args.file_path || '');
    const newContent = String(args.new_string || args.content || '');
    return filePath ? matchFileEdit(filePath, newContent, loaded.patterns) : [];
  }
  if (e.tool === 'Write') {
    const filePath = String(args.file_path || '');
    const content = String(args.content || '');
    return filePath ? matchFileEdit(filePath, content, loaded.patterns) : [];
  }
  return [];
}

/**
 * Register the lesson-cards hooks.
 */
export function register(on: (event: string, matcherOrHook: unknown, hook?: unknown) => void, _options?: unknown): void {
  on('session.start', async ($: Hook$, e: SessionStartEvent, next: NextFn<SessionStartEvent>) => {
    corpus = await loadCorpus($);
    matchMap.clear();
    await $.command.register({ name: 'lessons', description: 'Reload the lesson cards corpus' });
    return next(e);
  });

  on('tool.call', async ($: Hook$, e: ToolCallEvent, next?: NextFn<ToolCallEvent>) => {
    const requestId = e.tool_use_id || `tool-${Date.now()}`;

    if (!corpus) {
      return next ? ((await next(e)) ?? {}) : {};
    }

    // Match BEFORE the tool runs, so a block lesson can ask first.
    const matches = matchToolCall(e, corpus);
    if (matches.length === 0) {
      return next ? ((await next(e)) ?? {}) : {};
    }

    // Store matches for ui.render: the card draws under this tool row.
    matchMap.set(requestId, matches);

    // Try to show notice during permission dialog (only works if dialog is open)
    try {
      await $.ui.notice(requestId, `lesson: ${matches[0].id}`);
    } catch {
      // Notice refused - dialog not open, ignore
    }

    const lesson = matches[0];
    const context = formatContext(lesson);

    // A block lesson asks the human before the call runs, and only an explicit
    // "Proceed anyway" runs it. Cancel, Escape (the dialog throws "no answer"),
    // a typed free-text answer, and no dialog at all (headless -p) all deny:
    // a block lesson fails closed (estate-6 HOLD on #4429).
    if (lesson.severity === 'block' && lesson.source === 'pattern') {
      let answer: unknown;
      try {
        answer = await $.ui.ask(`lesson ${lesson.id}: ${lesson.message} Proceed anyway?`, [PROCEED, CANCEL]);
      } catch {
        answer = undefined;
      }
      if (answer !== PROCEED) {
        // { deny } is the tool.call refusal CC 2.1.282 reads: the call is not
        // run and the model sees the reason as a permission denial. A bare
        // { result: string } is refused for Bash (its output is an object).
        const why = answer === CANCEL ? 'the user chose Cancel' : 'no explicit "Proceed anyway" came back';
        return {
          deny: `lesson-cards: ${why} at lesson ${lesson.id}, so this call did not run. ${formatContext(lesson)}`,
        };
      }
    }

    const result = next ? ((await next(e)) ?? {}) : {};
    return { ...(result as Record<string, unknown>), context: [context] };
  });

  // Wrap, never mutate: next(e) hands back an opaque engine node ({ type, ref }),
  // so the card goes beside it in a new column Box built from $.ui.resolve(e).
  on('ui.render', { component: 'ToolUse' }, async ($: Hook$, e: UiRenderEvent, next?: NextFn<UiRenderEvent>) => {
    const tree = next ? await next(e) : null;

    if (e.component !== 'ToolUse' || !e.requestId) {
      return tree;
    }

    const matches = matchMap.get(e.requestId);
    if (!matches || matches.length === 0) {
      return tree;
    }

    const el = await $.ui.resolve(e);
    const card = buildCard(matches[0], e.requestId, el);
    return el.Box({ flexDirection: 'column', children: tree ? [tree, card] : [card] });
  });

  on('command.run', { command: 'lessons' }, async ($: Hook$) => {
    corpus = await loadCorpus($);
    matchMap.clear();
    try {
      await $.ui.invalidate('ui.render');
    } catch {
      // nothing drawn yet: nothing to refresh
    }
    const n = corpus ? corpus.patterns.length + corpus.bullets.length : 0;
    return { text: `Lessons reloaded (${n} entries)` };
  });
}

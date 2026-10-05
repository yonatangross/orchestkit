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
  joinPath,
  type Corpus,
  type LessonPattern,
  type LessonBullet,
} from '../src/corpus.js';
import { matchAll, matchFileEdit } from '../src/match.js';
import { askQuestion, buildCard, denyLine, formatContext, type CardElements } from '../src/card.js';
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

/**
 * What the $.ui.ask throw carries when the person presses Escape. CC 2.1.283
 * puts its tool rejection text there; the dismiss text is its fallback when
 * the dialog returns no text.
 */
const DISMISSED = ["The user doesn't want to proceed with this tool use", 'the dialog was dismissed'];

type NextFn<E> = (ev: E) => Promise<unknown>;

type SessionStartEvent = { cwd: string; isInteractive: boolean };

// Module-scope state (per session)
let corpus: Corpus | null = null;
/** True only after session.start says isInteractive; headless (-p) or no session.start never asks. */
let interactive = false;
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
  // On Windows HOME is normally unset and USERPROFILE set, so read it second through the
  // same env reader. Never read the process global: a mod worker does not have it.
  const home =
    (await $.env.get('HOME').catch(() => undefined)) ||
    (await $.env.get('USERPROFILE').catch(() => undefined)) ||
    '';
  const startTime = Date.now();

  // No home means every corpus path would be relative and resolve under the session's cwd.
  if (!home) {
    return { patterns: [], bullets: [], loadedAt: startTime, loadError: 'HOME and USERPROFILE are not set' };
  }

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
    // Register first: CC skips the whole hook when session.start throws, so a
    // corpus load failure must never take the /lessons command down with it
    // (measured on a Windows screen 2026-10-05: "Unknown command: /lessons").
    await $.command.register({ name: 'lessons', description: 'Reload the lesson cards corpus' });
    interactive = e.isInteractive === true;
    matchMap.clear();
    corpus = await loadCorpus($).catch((err: unknown) => ({
      patterns: [],
      bullets: [],
      loadedAt: Date.now(),
      loadError: err instanceof Error ? err.message : 'Unknown error',
    }));
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
    // "Proceed anyway" runs it. Cancel, Escape (the dialog throws "dismissed"),
    // a typed free-text answer, and no dialog at all (headless -p) all deny:
    // a block lesson fails closed (estate-6 HOLD on #4429).
    if (lesson.severity === 'block' && lesson.source === 'pattern') {
      // $.ui.ask is only ever called: CC's validator refuses reading it as a value.
      let answer: unknown;
      let outcome: 'answered' | 'dismissed' | 'no-dialog' = 'no-dialog';
      if (interactive) {
        try {
          answer = await $.ui.ask(askQuestion(lesson), [PROCEED, CANCEL]);
          outcome = 'answered';
        } catch (err) {
          // Escape throws "$.ui.ask: no answer (<rejection text>)". Any other
          // throw (no ask, a refused dialog) is not the user cancelling.
          const message = err instanceof Error ? err.message : '';
          outcome = DISMISSED.some((tail) => message.includes(tail)) ? 'dismissed' : 'no-dialog';
        }
      }
      if (answer !== PROCEED) {
        // { deny } is the tool.call refusal CC 2.1.282 reads: the call is not
        // run and the model sees the reason as a permission denial. A bare
        // { result: string } is refused for Bash (its output is an object).
        const why = outcome === 'no-dialog'
          ? 'Not run: no dialog to confirm.'
          : outcome === 'dismissed' || answer === CANCEL
            ? 'Cancelled: by you; not run.'
            : 'Not run: no "Proceed anyway".';
        return {
          deny: denyLine(lesson, why),
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
    corpus = await loadCorpus($).catch((err: unknown) => ({
      patterns: [],
      bullets: [],
      loadedAt: Date.now(),
      loadError: err instanceof Error ? err.message : 'Unknown error',
    }));
    matchMap.clear();
    try {
      await $.ui.invalidate('ui.render');
    } catch {
      // nothing drawn yet: nothing to refresh
    }
    const n = corpus ? corpus.patterns.length + corpus.bullets.length : 0;
    if (n === 0) {
      const reason = corpus?.loadError ? `: ${corpus.loadError}` : '';
      return {
        text: `Lessons reloaded (0 entries)${reason}. Lessons come from configs/lesson-patterns.json in the newest hq-ext cache and ~/.claude/hq/floor-*/lessons.md.`,
      };
    }
    return { text: `Lessons reloaded (${n} entries)` };
  });
}

/**
 * tool.list probe hook (R3).
 *
 * Answers every tool.list call with REMOVED_TOOL filtered out, and writes one
 * JSON marker file per call so the probe script can count how many tool
 * listings the engine built (main loop versus subagent) and see exactly what
 * each listing offered before and after the filter.
 *
 * Marker location, first hit wins:
 *   1. $.env.get('TOOL_LIST_PROBE_MARK')
 *   2. $.session.cwd() + '/tool-list-mark'
 *   3. $.env.get('TMPDIR') + '/tool-list-mark'
 *   4. '/tmp/tool-list-mark'
 * Each call appends '.' + a counter + '.' + Date.now() so every dispatch lands
 * in its own file. A marker failure never breaks the answer.
 *
 * Note: $.env.get and every other $.noun.event call must take literal
 * arguments; the loader lists the variables a module reads from the call
 * sites, so indirection through a constant fails the load.
 */

const REMOVED_TOOL = 'Read';
const MARK_BASENAME = 'tool-list-mark';

type ToolInfo = { name?: string } & Record<string, unknown>;

type Probe$ = {
  env: { get: (name: string) => Promise<string | undefined> };
  fs: { write: (path: string, text: string) => Promise<void> };
  session: { cwd: () => Promise<string> };
};

type NextFn = ((e: unknown) => Promise<unknown>) & { origin?: string };

let dispatchCount = 0;

function asList(answered: unknown): ToolInfo[] | null {
  if (Array.isArray(answered)) return answered as ToolInfo[];
  if (answered && typeof answered === 'object') {
    const v = (answered as { value?: unknown }).value;
    if (Array.isArray(v)) return v as ToolInfo[];
  }
  return null;
}

async function markBase($: Probe$): Promise<string> {
  try {
    const mark = await $.env.get('TOOL_LIST_PROBE_MARK');
    if (mark) return mark;
  } catch {
    // fall through to the next candidate
  }
  try {
    const cwd = await $.session.cwd();
    if (cwd) return `${cwd}/${MARK_BASENAME}`;
  } catch {
    // fall through to the tmp candidates
  }
  try {
    const tmp = await $.env.get('TMPDIR');
    if (tmp) return `${tmp}/${MARK_BASENAME}`;
  } catch {
    // fall through to the fixed path
  }
  return `/tmp/${MARK_BASENAME}`;
}

async function writeMark($: Probe$, record: Record<string, unknown>): Promise<void> {
  try {
    const base = await markBase($);
    const stamp = `${dispatchCount}.${Date.now()}`;
    await $.fs.write(`${base}.${stamp}`, `${JSON.stringify(record)}\n`);
  } catch {
    // Marker failure must not break the answer.
  }
}

export function register(on: (event: string, hook: unknown) => void): void {
  on('tool.list', async ($: Probe$, e: unknown, next?: NextFn) => {
    dispatchCount += 1;
    const answered = next ? await next(e) : undefined;
    const seen = asList(answered);

    if (seen === null) {
      await writeMark($, {
        removed: REMOVED_TOOL,
        origin: next && next.origin ? String(next.origin) : null,
        shape: 'unrecognized',
      });
      return answered ?? {};
    }

    const kept = seen.filter(t => t && t.name !== REMOVED_TOOL);
    await writeMark($, {
      removed: REMOVED_TOOL,
      origin: next && next.origin ? String(next.origin) : null,
      seen: seen.map(t => (t ? t.name : null)),
      kept: kept.map(t => (t ? t.name : null)),
    });

    if (seen.length === 0) {
      return answered;
    }
    return { value: kept };
  });
}

/**
 * Read the arguments the USER typed for a slash command from a CC transcript.
 *
 * Used by skill/review-post-gate (#4675): /ork:review-pr may post to GitHub only
 * when the user typed --post. The opt-in must come from the user, so an entry
 * counts only when all of these hold:
 *
 *   1. It is a non-meta `user` entry whose content is a STRING that IS the
 *      command, start to end: an optional `<command-message>`, then
 *      `<command-name>/name</command-name>`, then `<command-args>...</command-args>`
 *      (measured on CC 2.1.294, transcript d89b7eec). Text that only contains
 *      the tags (a task notification is such an entry) does not count. Skill bodies are isMeta
 *      with array content, tool results are array content, assistant text is
 *      type `assistant`: none of them match.
 *   2. It sits on the parentUuid chain of the assistant entry that holds THIS
 *      tool call (tool_use_id). CC writes that entry before the tool runs
 *      (measured 2026-10-08 on 2.1.294 in this lane's own transcript). A line
 *      the model appends to the file is not on the chain CC keeps in memory,
 *      so an appended fake entry never counts (#4678 XREVIEW P1).
 *   3. No uuid appears twice. A repeated uuid is a line written to replace a
 *      real one on the chain; the whole read fails closed.
 *   4. It is the NEAREST human turn on the chain. Walking up from the tool
 *      call, tool results and meta entries are passed over; the first other
 *      user entry is the turn that started this work. If that turn is not the
 *      command, nothing counts: an older `--post` line does not carry over to
 *      a later plain prompt. A Skill call the model makes writes only a
 *      tool_result entry (measured on 3 transcripts, 2026-10-08), so the model
 *      cannot write a command turn through the Skill tool.
 *
 * Known limit: an in-place edit of the real command entry keeps its uuid and
 * its place on the chain. A text guard cannot see a path built at run time,
 * so that edit is not stopped here (#4677 removes the write credential).
 *
 * Reads at most the final MAX_BYTES of the file. A chain that leaves that
 * window is not followed to its end, and the caller fails closed.
 */

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

const MAX_BYTES = 32 * 1024 * 1024;

function readTail(path: string): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const len = Math.min(size, MAX_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Entry {
  type?: unknown;
  isMeta?: unknown;
  uuid?: unknown;
  parentUuid?: unknown;
  message?: { role?: unknown; content?: unknown };
}

function holdsToolUse(e: Entry, toolUseId: string): boolean {
  if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) return false;
  return (e.message.content as unknown[]).some(
    (c) => typeof c === 'object' && c !== null && (c as { type?: unknown; id?: unknown }).type === 'tool_use' && (c as { id?: unknown }).id === toolUseId,
  );
}

/**
 * Args of the nearest user-typed invocation of any of `names` (e.g. '/ork:review-pr')
 * on the parentUuid chain of the entry holding `toolUseId`, split on whitespace.
 * null when the transcript is unreadable, the tool call is not found, a uuid
 * repeats, or no such invocation is on the chain.
 */
export function chainUserCommandArgs(
  transcriptPath: string | undefined,
  names: readonly string[],
  toolUseId: string | undefined,
): string[] | null {
  if (!transcriptPath || !toolUseId) return null;
  const text = readTail(transcriptPath);
  if (text === null) return null;
  const byUuid = new Map<string, Entry>();
  let start: Entry | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Entry;
    if (typeof e.uuid === 'string') {
      if (byUuid.has(e.uuid)) return null;
      byUuid.set(e.uuid, e);
    }
    if (holdsToolUse(e, toolUseId)) {
      if (start !== null) return null;
      start = e;
    }
  }
  if (start === null) return null;
  // Anchored to the whole entry, the shape CC writes for a typed command:
  // a notification or other text that only contains the tags never counts.
  const commandRe = new RegExp(
    `^(?:<command-message>[^<]*</command-message>\\n)?<command-name>(?:${names.map(escapeRe).join('|')})</command-name>(?:\\n?<command-args>([\\s\\S]*)</command-args>)?\\s*$`,
  );
  const seen = new Set<string>();
  let cur: Entry | undefined = start;
  while (cur) {
    if (typeof cur.uuid === 'string') {
      if (seen.has(cur.uuid)) return null;
      seen.add(cur.uuid);
    }
    const content = cur.message?.content;
    if (cur.type === 'user' && cur.isMeta !== true) {
      if (typeof content === 'string') {
        // The nearest human turn: the command, or nothing.
        const m = cur.message?.role === 'user' ? content.match(commandRe) : null;
        if (!m) return null;
        return (m[1] ?? '').split(/\s+/).filter(Boolean);
      }
      const onlyToolResults =
        Array.isArray(content) &&
        content.length > 0 &&
        content.every((c) => typeof c === 'object' && c !== null && (c as { type?: unknown }).type === 'tool_result');
      if (!onlyToolResults) return null;
    }
    cur = typeof cur.parentUuid === 'string' ? byUuid.get(cur.parentUuid) : undefined;
  }
  return null;
}

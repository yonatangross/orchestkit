/**
 * UI tree builder for lesson cards.
 *
 * Creates a Box containing the lesson card that renders under a ToolUse row.
 * The element constructors come from $.ui.resolve(e) in the hooks module: on
 * CC 2.1.282 a render hook may only return nodes built by those constructors.
 * A plain { type: 'Box' } object is refused as "not an element" and draws
 * nothing, which is why the card never showed before (measured 2026-09-25).
 */

import type { MatchedLesson } from './types.js';

/** One element constructor, as handed out by $.ui.resolve(e). */
export type ElementCtor = (props?: Record<string, unknown>) => unknown;

/** The subset of the resolved element table the card uses. */
export interface CardElements {
  Box: ElementCtor;
  Text: ElementCtor;
}

/** Border and title color per severity: block red, warn yellow, bullet gray. */
export function cardColor(lesson: MatchedLesson): 'red' | 'yellow' | 'gray' {
  if (lesson.source === 'bullet') return 'gray';
  return lesson.severity === 'block' ? 'red' : 'yellow';
}

/**
 * Build a lesson card from resolved elements.
 *
 * Structure:
 * - Round border box in the severity color
 *   - Title row: "lesson: <id>" (bold, colored) and the severity word
 *   - Message row
 *   - Fix row (dim, if available)
 */
export function buildCard(lesson: MatchedLesson, requestId: string, el: CardElements): unknown {
  const color = cardColor(lesson);
  const label = lesson.source === 'bullet' ? 'note' : lesson.severity;

  const rows: unknown[] = [
    el.Box({
      children: [
        el.Text({ bold: true, color, children: `lesson: ${lesson.id}` }),
        el.Text({ dimColor: true, children: `  ${label}` }),
      ],
    }),
    el.Text({ children: lesson.message }),
  ];

  if (lesson.fix) {
    rows.push(el.Text({ dimColor: true, children: `Fix: ${lesson.fix}` }));
  }

  return el.Box({
    key: `lesson-${requestId}`,
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: color,
    paddingX: 1,
    children: rows,
  });
}

/** Longest deny line, in code points; the card above it shows the full lesson and fix. */
export const MAX_DENY_CHARS = 240;

/** Longest short fix inside the deny line, in code points. */
export const MAX_FIX_CHARS = 110;

/** Cut to at most max code points (Array.from never splits a surrogate pair), marking a cut with "...". */
export function cutCodePoints(text: string, max: number): string {
  const points = Array.from(text);
  return points.length > max ? `${points.slice(0, max - 3).join('')}...` : text;
}

const COMMENT = /^\s*(#|\/\/)/;
const RIGHT_HEADING = /\b(RIGHT|BEST|FIX|DO)\b/i;
const WRONG_HEADING = /\b(WRONG|BAD|DON'?T|DO NOT|NEVER|AVOID)\b/i;

/**
 * The one line of a lesson's fix worth sending with a refusal. Fixes are
 * usually WRONG / RIGHT example blocks, so prefer the first code line under a
 * RIGHT or BEST heading; else the first code line outside a WRONG section;
 * else the first non-empty line. Undefined when the lesson has no fix.
 */
export function shortFix(fix: string | undefined): string | undefined {
  if (!fix) return undefined;
  const lines = fix.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let section: 'right' | 'wrong' | 'none' = 'none';
  let firstNeutral: string | undefined;
  for (const line of lines) {
    if (COMMENT.test(line)) {
      // A neutral comment ends a WRONG block ("use this instead").
      // WRONG is tested first: "# WRONG: Do not use this" also contains "Do".
      section = WRONG_HEADING.test(line) ? 'wrong' : RIGHT_HEADING.test(line) ? 'right' : 'none';
      continue;
    }
    if (section === 'right') return cutCodePoints(line, MAX_FIX_CHARS);
    if (section === 'none' && firstNeutral === undefined) firstNeutral = line;
  }
  // Never offer a WRONG example as the fix: with no code outside a WRONG
  // block there is no short fix.
  const sawHeading = lines.some(l => COMMENT.test(l));
  const pick = firstNeutral ?? (sawHeading ? undefined : lines[0]);
  return pick === undefined ? undefined : cutCodePoints(pick.replace(/\s+/g, ' '), MAX_FIX_CHARS);
}

/**
 * The block-lesson question: the lesson id and "Proceed anyway?" only.
 * The card above the dialog already shows the lesson; repeating the message
 * here drew the same paragraph twice on screen.
 */
export function askQuestion(lesson: MatchedLesson): string {
  return `lesson ${lesson.id}: Proceed anyway?`;
}

/**
 * True when why is a user cancel (Cancel button or Escape). Those must not
 * look like failures: no Fix line, and a "Cancelled: " head so Claude Code's
 * tool-result renderer leaves the string alone instead of prefixing "Error: ".
 * (CC 2.1.283: startsWith("Error: ") || startsWith("Cancelled: ") passes through.)
 */
export function isUserCancel(why: string): boolean {
  return why === 'Cancelled by you; not run.' || why.startsWith('Cancelled: ');
}

/**
 * The one-line reason a refused call carries: why, the lesson id, and (for a
 * real block, not a user cancel) a short fix. Claude Code draws a mod deny as
 * "Error: <deny>" unless the deny already starts with "Error: " or "Cancelled: ".
 * A cancel is not an error, so it uses the Cancelled: head and omits Fix; the
 * card above the row already shows the lesson and the alternative.
 */
export function denyLine(lesson: MatchedLesson, why: string): string {
  const cancel = isUserCancel(why);
  // CC leaves "Cancelled: ..." alone (no "Error:" glue). Keep the human phrase.
  const head = why === 'Cancelled by you; not run.'
    ? 'Cancelled: Cancelled by you; not run.'
    : why;
  const fix = cancel ? undefined : shortFix(lesson.fix);
  const tail = fix ? ` Fix: ${fix}` : '';
  return cutCodePoints(`${head} [lesson:${lesson.id}]${tail}`, MAX_DENY_CHARS);
}

/**
 * Format lesson context for model consumption.
 *
 * Returns the message and fix (if any), capped at a reasonable length.
 * This is added to the tool.call return context array.
 */
export function formatContext(lesson: MatchedLesson, maxLength = 32000): string {
  let text = `[lesson:${lesson.id}] ${lesson.message}`;
  if (lesson.fix) {
    text += ` Fix: ${lesson.fix}`;
  }
  // Cap at maxLength to avoid context bloat
  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + '...';
  }
  return text;
}

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

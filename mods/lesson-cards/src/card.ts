/**
 * UI tree builder for lesson cards.
 *
 * Creates a Box containing the lesson card that renders under a ToolUse row.
 * Uses plain Box/Text elements - no Client module needed.
 */

import type { MatchedLesson } from './types.js';

// Simple tree node types for UI rendering
export interface UINode {
  type: string;
  props?: Record<string, unknown>;
  children?: UINode[];
  key?: string;
  text?: string;
}

/**
 * Build a lesson card UI tree.
 *
 * Structure:
 * - Border box (1px border)
 *   - Title row: "lesson: <id>"
 *   - Message row
 *   - Fix row (if available)
 *
 * Colors:
 * - block: red border
 * - warn: yellow border
 * - bullet: grey/default border
 */
export function buildCard(lesson: MatchedLesson, requestId: string): UINode {
  const borderColor = lesson.severity === 'block' ? 'red' :
                      lesson.severity === 'warn' ? 'yellow' :
                      'gray';

  const children: UINode[] = [
    // Title row
    {
      type: 'Box',
      props: { marginBottom: 1 },
      children: [
        {
          type: 'Text',
          props: { bold: true, color: borderColor },
          text: `lesson: ${lesson.id}`,
        },
      ],
    },
    // Message row
    {
      type: 'Box',
      props: { marginBottom: 1 },
      children: [
        {
          type: 'Text',
          text: lesson.message,
        },
      ],
    },
  ];

  // Fix row (if available)
  if (lesson.fix) {
    children.push({
      type: 'Box',
      props: { marginTop: 1 },
      children: [
        {
          type: 'Text',
          props: { dimColor: true },
          text: `Fix: ${lesson.fix}`,
        },
      ],
    });
  }

  return {
    type: 'Box',
    props: {
      key: `lesson-${requestId}`,
      borderStyle: 'single',
      borderColor,
      paddingX: 1,
      paddingY: 1,
      marginTop: 1,
    },
    children,
  };
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

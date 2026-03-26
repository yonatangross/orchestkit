import type { FuseResultMatch } from "fuse.js";

interface HighlightProps {
  text: string;
  matches: readonly FuseResultMatch[] | undefined;
  fieldKey: string;
  className?: string;
}

/**
 * Renders text with highlighted match ranges from Fuse.js results.
 * Merges overlapping indices before rendering.
 */
export function Highlight({ text, matches, fieldKey, className }: HighlightProps) {
  if (!matches) return <span className={className}>{text}</span>;

  const fieldMatch = matches.find((m) => m.key === fieldKey);
  if (!fieldMatch?.indices?.length) return <span className={className}>{text}</span>;

  // Merge overlapping indices
  const sorted = [...fieldMatch.indices].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), highlighted: false });
    }
    parts.push({ text: text.slice(start, end + 1), highlighted: true });
    cursor = end + 1;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200/60 px-0.5 text-inherit dark:bg-yellow-500/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

interface HighlightProps {
  text: string;
  /** The active search query; occurrences are wrapped in <mark>. */
  query: string;
  className?: string;
}

/**
 * Highlights occurrences of `query` inside `text` (case-insensitive) by
 * wrapping each match in a <mark>. XSS-safe: the string is split into React
 * segments — no dangerouslySetInnerHTML, no HTML parsing of user input.
 */
export function Highlight({ text, query, className }: HighlightProps) {
  const q = query.trim();
  if (!q) return <span className={className}>{text}</span>;

  const haystack = text.toLowerCase();
  const needle = q.toLowerCase();

  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  let idx = haystack.indexOf(needle, cursor);

  while (idx !== -1) {
    if (idx > cursor) {
      parts.push({ text: text.slice(cursor, idx), highlighted: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), highlighted: true });
    cursor = idx + q.length;
    idx = haystack.indexOf(needle, cursor);
  }

  if (parts.length === 0) return <span className={className}>{text}</span>;

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

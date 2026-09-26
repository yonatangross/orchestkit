import type { ChangelogEntry } from "@/lib/generated/changelog-data";
import {
  HOW_TO_READ,
  formatChangelogDate,
  releaseItemCount,
} from "@/lib/changelog-format";

/** Plain key for the section tags below: one row per type, no order implied. */
export function ChangelogLegend() {
  return (
    <ul
      aria-label="Release section types"
      className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3"
    >
      {HOW_TO_READ.map((item) => (
        <li key={item.category} className="flex items-baseline gap-2">
          <span aria-hidden="true">{item.glyph}</span>
          <span className="font-medium text-fd-foreground">{item.label}</span>
          <span className="text-fd-muted-foreground">{item.hint}</span>
        </li>
      ))}
    </ul>
  );
}

export function RecentVersions({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {entries.map((entry) => {
        const count = releaseItemCount(entry);
        return (
          <li key={entry.version}>
            <a
              href={`#${entry.version}`}
              className="flex h-full flex-col rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-2.5 py-1.5 transition-colors hover:border-fd-primary/50"
            >
              <span className="font-mono text-[12px] font-medium text-fd-foreground">
                {entry.version}
              </span>
              <span className="font-mono text-[10px] text-fd-muted-foreground">
                {formatChangelogDate(entry.date)}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-fd-muted-foreground">
                {count} {count === 1 ? "change" : "changes"}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

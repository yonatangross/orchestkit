import type { ChangelogEntry } from "@/lib/generated/changelog-data";
import {
  HOW_TO_READ,
  TAG_BG,
  formatChangelogDate,
  releaseSectionMix,
} from "@/lib/changelog-format";

export function ChangelogLegend() {
  return (
    <ul className="flex flex-wrap gap-2">
      {HOW_TO_READ.map((item) => (
        <li
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-2.5 py-1.5 text-[12px] text-fd-foreground"
        >
          <span aria-hidden="true">{item.glyph}</span>
          <span className="font-medium">{item.label}</span>
          <span className="text-fd-muted-foreground">— {item.hint}</span>
        </li>
      ))}
    </ul>
  );
}

export function RecentVersions({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {entries.map((entry) => (
        <li key={entry.version}>
          <a
            href={`#${entry.version}`}
            className="inline-flex flex-col rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-2.5 py-1.5 transition-colors hover:border-fd-primary/50"
          >
            <span className="font-mono text-[12px] font-medium text-fd-foreground">
              {entry.version}
            </span>
            <span className="font-mono text-[10px] text-fd-muted-foreground">
              {formatChangelogDate(entry.date)}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export function ReleaseMix({ entry }: { entry: ChangelogEntry }) {
  const mix = releaseSectionMix(entry);
  if (mix.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {mix.map((item) => (
        <li
          key={item.heading}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${TAG_BG[item.type]}`}
        >
          <span>{item.heading}</span>
          <span className="font-mono tabular-nums opacity-70">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

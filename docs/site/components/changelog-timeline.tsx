"use client";

import { useState } from "react";
import {
  CHANGELOG_ENTRIES,
  type ChangelogEntry,
  type SectionType,
} from "@/lib/generated/changelog-data";

const TAG_BG: Record<SectionType, string> = {
  added: "bg-emerald-500/10 text-emerald-400",
  fixed: "bg-amber-500/10 text-amber-400",
  changed: "bg-cyan-500/10 text-cyan-400",
  removed: "bg-red-500/10 text-red-400",
  deprecated: "bg-orange-500/10 text-orange-400",
  security: "bg-red-500/10 text-red-400",
};

const SECTION_LABEL: Record<SectionType, string> = {
  added: "Added",
  fixed: "Fixed",
  changed: "Changed",
  removed: "Removed",
  deprecated: "Deprecated",
  security: "Security",
};

const INITIAL_VISIBLE = 5;

function VersionCard({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  const totalItems = entry.sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div
      className={`rounded-md border-l-2 bg-fd-card/60 px-4 py-3 ${
        isLatest ? "border-l-fd-primary" : "border-l-fd-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-fd-foreground">
            {entry.version}
          </span>
          <span className="font-mono text-[11px] text-fd-muted-foreground">
            {formatDate(entry.date)}
          </span>
          {isLatest && (
            <span className="rounded-sm bg-fd-primary/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-fd-primary">
              Latest
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-fd-muted-foreground">
            {totalItems} change{totalItems !== 1 ? "s" : ""}
          </span>
          {entry.compareUrl && (
            <a
              href={entry.compareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-fd-muted-foreground transition-colors hover:text-fd-primary"
            >
              diff &rarr;
            </a>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {entry.sections.map((s) => (
          <div key={s.type}>
            <span
              className={`inline-block rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${TAG_BG[s.type]}`}
            >
              {SECTION_LABEL[s.type]}
            </span>
            <ul className="mt-1 space-y-px">
              {s.items.map((item, i) => (
                <li
                  key={i}
                  className="pl-2 text-[13px] leading-[1.6] text-fd-foreground/75"
                  dangerouslySetInnerHTML={{
                    __html: markdownInline(item.split("\n")[0]),
                  }}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

function markdownInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-fd-primary hover:underline">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-fd-foreground/90">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="text-[11px] bg-fd-muted/50 px-1 py-px rounded text-fd-foreground/80">$1</code>'
    );
}

export function ChangelogTimeline() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll
    ? CHANGELOG_ENTRIES
    : CHANGELOG_ENTRIES.slice(0, INITIAL_VISIBLE);
  const hiddenCount = CHANGELOG_ENTRIES.length - INITIAL_VISIBLE;

  return (
    <div className="space-y-3" role="feed" aria-label="Changelog">
      {visible.map((entry, i) => (
        <VersionCard key={entry.version} entry={entry} isLatest={i === 0} />
      ))}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-md border border-dashed border-fd-border py-2 text-[13px] text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-primary"
        >
          {hiddenCount} older releases
        </button>
      )}
    </div>
  );
}

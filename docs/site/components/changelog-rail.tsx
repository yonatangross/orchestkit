"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHANGELOG_ENTRIES,
  type ChangelogEntry,
  type ChangelogSection,
} from "@/lib/generated/changelog-data";
import {
  TAG_BG,
  SECTION_GLYPH,
  formatChangelogDate,
  parseChangelogItem,
  releaseMixMermaid,
} from "@/lib/changelog-format";
import { ChangelogMermaid } from "@/components/changelog-mermaid";

const INITIAL_VISIBLE = 8;

function VersionRow({
  entry,
  isLatest,
  position,
  total,
  showDiagram,
}: {
  entry: ChangelogEntry;
  isLatest: boolean;
  position: number;
  total: number;
  showDiagram: boolean;
}) {
  return (
    <article
      id={entry.version}
      aria-posinset={position}
      aria-setsize={total}
      className="relative flex flex-col gap-4 border-b border-fd-border pb-10 md:flex-row md:gap-12"
    >
      <div className="top-24 flex h-min shrink-0 flex-col gap-1 md:sticky md:w-56">
        <h2
          className={`w-fit rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
            isLatest
              ? "bg-[var(--color-fd-primary-20)] text-fd-primary"
              : "bg-fd-muted text-fd-muted-foreground"
          }`}
        >
          {entry.version}
        </h2>
        <span className="font-mono text-[11px] text-fd-muted-foreground">
          {formatChangelogDate(entry.date)}
        </span>
        {isLatest ? (
          <span className="mt-1 w-fit rounded-sm bg-[var(--color-fd-primary-20)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-fd-primary">
            Latest
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-5">
        {showDiagram ? (
          <ChangelogMermaid chart={releaseMixMermaid(entry)} />
        ) : null}
        {entry.sections.map((s, sectionIndex) => (
          <SectionBlock key={`${s.type}-${sectionIndex}`} section={s} />
        ))}
        {entry.compareUrl ? (
          <a
            href={entry.compareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-[12px] text-fd-muted-foreground transition-colors hover:text-fd-primary"
          >
            Full diff on GitHub →
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SectionBlock({ section }: { section: ChangelogSection }) {
  return (
    <div>
      <h3
        className={`inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TAG_BG[section.type]}`}
      >
        <span aria-hidden="true">{SECTION_GLYPH[section.type]}</span>
        {section.heading}
      </h3>
      <ul className="mt-2 space-y-3">
        {section.items.map((item, i) => (
          <ChangeItem key={i} raw={item} />
        ))}
      </ul>
    </div>
  );
}

function ChangeItem({ raw }: { raw: string }) {
  const parsed = parseChangelogItem(raw);
  return (
    <li className="rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-3.5 py-3">
      <p className="text-[14px] leading-[1.5] text-fd-foreground">
        <span aria-hidden="true" className="mr-1.5">
          {parsed.glyph}
        </span>
        {parsed.scope ? (
          <span className="mr-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-fd-primary">
            {parsed.scope}
          </span>
        ) : null}
        {parsed.title}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-fd-muted-foreground">
        {parsed.rationale}
      </p>
      {parsed.issues.length > 0 || parsed.shas.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[11px]">
          {parsed.issues.map((r) => (
            <a
              key={`${r.label}-${r.href}`}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fd-primary hover:underline"
            >
              {r.label.startsWith("#") ? r.label : `#${r.label}`}
            </a>
          ))}
          {parsed.shas.map((r) => (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fd-muted-foreground hover:text-fd-primary"
            >
              {r.label}
            </a>
          ))}
        </p>
      ) : null}
    </li>
  );
}

function hashVersion(): string {
  if (typeof window === "undefined") return "";
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

export function ChangelogRail({
  initialVisible = INITIAL_VISIBLE,
}: {
  initialVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [targetVersion, setTargetVersion] = useState("");

  useEffect(() => {
    const sync = () => setTargetVersion(hashVersion());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const visible = useMemo(() => {
    if (showAll) return CHANGELOG_ENTRIES;
    const sliced = CHANGELOG_ENTRIES.slice(0, initialVisible);
    if (!targetVersion) return sliced;
    const extra = CHANGELOG_ENTRIES.find((e) => e.version === targetVersion);
    if (!extra || sliced.some((e) => e.version === extra.version)) return sliced;
    return [...sliced, extra];
  }, [showAll, targetVersion, initialVisible]);

  useEffect(() => {
    if (!targetVersion) return;
    document.getElementById(targetVersion)?.scrollIntoView({ block: "start" });
  }, [targetVersion, visible]);

  const hiddenCount = CHANGELOG_ENTRIES.length - initialVisible;
  const latestVersion = CHANGELOG_ENTRIES[0]?.version;
  const diagramVersions = new Set(
    CHANGELOG_ENTRIES.slice(0, initialVisible).map((e) => e.version),
  );
  if (targetVersion) diagramVersions.add(targetVersion);

  return (
    <div className="space-y-10" role="feed" aria-label="Changelog">
      {visible.map((entry) => (
        <VersionRow
          key={entry.version}
          entry={entry}
          isLatest={entry.version === latestVersion}
          position={
            CHANGELOG_ENTRIES.findIndex((e) => e.version === entry.version) + 1
          }
          total={CHANGELOG_ENTRIES.length}
          showDiagram={!showAll && diagramVersions.has(entry.version)}
        />
      ))}
      {!showAll && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-md border border-dashed border-fd-border py-2.5 text-[13px] text-fd-muted-foreground transition-colors hover:border-[var(--color-fd-primary-30)] hover:text-fd-primary"
        >
          {hiddenCount} older releases
        </button>
      ) : null}
    </div>
  );
}

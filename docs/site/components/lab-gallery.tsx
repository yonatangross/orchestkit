"use client";

import { useMemo, useState } from "react";
import { LAB_ENTRIES, type LabEntry } from "@/lib/generated/lab-data";

function LabCard({ entry }: { entry: LabEntry }) {
  return (
    <div
      className={`card-elevated card-lift flex flex-col rounded-[var(--radius-card)] border p-5 ${entry.featured ? "card-trace" : ""}`}
      style={{ borderColor: "var(--color-fd-border)", background: "var(--color-fd-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: "var(--color-fd-foreground)" }}>
          {entry.title}
        </h3>
        {entry.featured && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
            style={{ background: "var(--color-fd-primary-20)", color: "var(--color-fd-primary)" }}
          >
            featured
          </span>
        )}
      </div>
      <p className="mt-1 flex-1 text-sm leading-relaxed" style={{ color: "var(--color-fd-muted-foreground)" }}>
        {entry.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
        {entry.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border px-2 py-0.5"
            style={{ borderColor: "var(--color-fd-border)" }}
          >
            {t}
          </span>
        ))}
        <span className="ml-auto font-mono">{entry.date}</span>
      </div>
      <div className="mt-4 flex gap-3 text-sm font-medium">
        <a
          href={`/lab/${entry.slug}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-3 py-1.5"
          style={{ background: "var(--color-fd-primary)", color: "var(--color-fd-primary-foreground)" }}
        >
          Open playground ↗
        </a>
        {entry.caseStudy && (
          <a
            href={entry.caseStudy}
            className="rounded-md border px-3 py-1.5"
            style={{ borderColor: "var(--color-fd-border)", color: "var(--color-fd-foreground)" }}
          >
            Case study
          </a>
        )}
      </div>
    </div>
  );
}

export function LabGallery() {
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(
    () => [...new Set(LAB_ENTRIES.flatMap((e) => e.tags))].sort(),
    [],
  );
  const shown = tag ? LAB_ENTRIES.filter((e) => e.tags.includes(tag)) : LAB_ENTRIES;

  return (
    <div>
      <p className="mb-3 text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
        {LAB_ENTRIES.length} playgrounds · self-contained HTML, no build step · best on desktop
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTag(null)}
          className="rounded-full border px-3 py-1 text-xs"
          style={{
            borderColor: tag === null ? "var(--color-fd-primary)" : "var(--color-fd-border)",
            color: tag === null ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
          }}
        >
          all
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t === tag ? null : t)}
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: t === tag ? "var(--color-fd-primary)" : "var(--color-fd-border)",
              color: t === tag ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((e) => (
          <LabCard key={e.slug} entry={e} />
        ))}
      </div>
    </div>
  );
}

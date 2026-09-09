import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";
import {
  TAG_BG,
  SECTION_LABEL,
  formatChangelogDate,
  markdownInline,
  pickWhatsNewPreview,
} from "@/lib/changelog-format";

export function WhatsNewStrip() {
  const preview = pickWhatsNewPreview(CHANGELOG_ENTRIES, 3);
  if (!preview) return null;
  const { entry, items } = preview;

  return (
    <section
      aria-labelledby="whats-new-heading"
      className="border-b border-fd-border bg-[var(--color-fd-surface-sunken)]"
    >
      <div className="mx-auto max-w-[1200px] px-7 py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
              <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
              Release
            </span>
            <h2
              id="whats-new-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground"
            >
              What&apos;s new
            </h2>
          </div>
          <Link
            href="/changelog"
            className="inline-flex items-center gap-1.5 font-mono text-[13px] text-fd-primary underline-offset-2 transition-colors hover:underline"
          >
            Full changelog
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--color-fd-primary-20)] px-2 py-0.5 font-mono text-xs font-semibold text-fd-primary">
              {entry.version}
            </span>
            <span className="font-mono text-[11px] text-fd-muted-foreground">
              {formatChangelogDate(entry.date)}
            </span>
            {entry === CHANGELOG_ENTRIES[0] ? (
              <span className="rounded-sm bg-[var(--color-fd-primary-20)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-fd-primary">
                Latest
              </span>
            ) : null}
          </div>
          <ul className="mt-4 space-y-2">
            {items.map((row, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-block shrink-0 rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${TAG_BG[row.type]}`}
                >
                  {SECTION_LABEL[row.type]}
                </span>
                <span
                  className="text-[13px] leading-[1.55] text-fd-foreground/80"
                  dangerouslySetInnerHTML={{
                    __html: markdownInline(row.item.split("\n")[0]),
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

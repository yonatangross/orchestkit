import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChronoBoard } from "@/components/ui/chrono-board";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";
import { COUNTS, SITE } from "@/lib/constants";
import { buildReleaseChronoCards } from "@/lib/chrono-board-release";

export function WhatsNewStrip() {
  const cards = buildReleaseChronoCards({
    entries: CHANGELOG_ENTRIES,
    counts: COUNTS,
    latestVersion: SITE.version,
    itemLimit: 3,
  });
  if (cards.length === 0) return null;

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

        <ChronoBoard cards={cards} labelledBy="whats-new-heading" />
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { ChangelogRail } from "@/components/changelog-rail";
import {
  ChangelogLegend,
  RecentVersions,
} from "@/components/changelog-legend";
import { ChangelogMermaid } from "@/components/changelog-mermaid";
import { ChronoBoard } from "@/components/ui/chrono-board";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";
import { howToReadMermaid, recentTimelineMermaid } from "@/lib/changelog-format";
import { buildVersionChronoCards } from "@/lib/chrono-board-release";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Changelog",
  description: `All notable changes to ${SITE.name}, following Keep a Changelog and Semantic Versioning.`,
  alternates: { canonical: `${SITE.domain}/changelog` },
};

export default function ChangelogPage() {
  const latest = CHANGELOG_ENTRIES[0];

  return (
    <main className="mx-auto w-full max-w-[960px] px-7 py-16 sm:py-20">
      <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
        {CHANGELOG_ENTRIES.length} releases
        {latest ? ` · latest ${latest.version}` : ""}
      </p>
      <h1
        data-speakable-headline
        className="mt-3 text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl"
      >
        Changelog
      </h1>
      <p
        data-speakable-summary
        className="mt-4 max-w-[640px] text-base leading-7 text-fd-muted-foreground"
      >
        Every {SITE.name} release, newest first. Each bullet is a conventional
        commit unpacked into what changed, why it matters, and the PR or SHA to
        open. Follows{" "}
        <a
          href="https://keepachangelog.com/"
          className="text-fd-primary underline underline-offset-2"
        >
          Keep a Changelog
        </a>{" "}
        and{" "}
        <a
          href="https://semver.org/"
          className="text-fd-primary underline underline-offset-2"
        >
          Semantic Versioning
        </a>
        . Subscribe via{" "}
        <a href="/rss.xml" className="text-fd-primary underline underline-offset-2">
          RSS
        </a>
        .
      </p>

      <div className="mt-8 space-y-4">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
          How to read a release
        </p>
        <ChangelogLegend />
        {/* Same content as the chip legend above; at phone width the diagram
            scaled to ~4px text (visual audit 2026-09-25), so md and up only. */}
        <div className="hidden md:block">
          <ChangelogMermaid chart={howToReadMermaid()} />
        </div>
        <h2
          id="release-activity-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground"
        >
          Release activity
        </h2>
        <ChronoBoard
          cards={buildVersionChronoCards(CHANGELOG_ENTRIES, 5)}
          labelledBy="release-activity-heading"
        />
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
          Recent versions
        </p>
        {/* The version chips below carry the same six releases; at phone width
            this diagram rendered at ~3px text. md and up only. */}
        <div className="hidden md:block">
          <ChangelogMermaid chart={recentTimelineMermaid(CHANGELOG_ENTRIES, 6)} />
        </div>
        <RecentVersions entries={CHANGELOG_ENTRIES.slice(0, 6)} />
      </div>

      <div className="mt-12">
        <ChangelogRail />
      </div>
    </main>
  );
}

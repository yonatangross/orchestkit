import { COUNTS, SITE } from "@/lib/constants";
import type { ChangelogEntry, SectionType } from "@/lib/generated/changelog-data";
import {
  entryHeadline,
  formatChangelogDate,
  isProductChangelogItem,
  parseChangelogItem,
  pickWhatsNewPreview,
  releaseSectionMix,
} from "@/lib/changelog-format";

export type ChronoTone = SectionType | "live";

export type ChronoBoardCardModel = {
  id: string;
  title: string;
  description: string;
  date: string;
  status: string;
  tone: ChronoTone;
  active?: boolean;
  notesHref: string;
  diffHref?: string;
};

export const CHRONO_STATUS_LABEL: Record<ChronoTone, string> = {
  live: "Latest",
  added: "Shipped",
  fixed: "Fixed",
  changed: "Changed",
  removed: "Removed",
  deprecated: "Deprecated",
  security: "Security",
};

export function buildReleaseChronoCards({
  entries,
  counts = COUNTS,
  latestVersion = SITE.version,
  itemLimit = 3,
}: {
  entries: ChangelogEntry[];
  counts?: { skills: number; agents: number; hooks: number };
  latestVersion?: string;
  itemLimit?: number;
}): ChronoBoardCardModel[] {
  const latest = entries[0];
  const preview = pickWhatsNewPreview(entries, itemLimit);
  const live: ChronoBoardCardModel = {
    id: `live-${latestVersion}`,
    title: `OrchestKit ${latestVersion} live`,
    description: `${counts.skills} skills · ${counts.agents} agents · ${counts.hooks} hooks`,
    date: latest ? formatChangelogDate(latest.date) : "",
    status: CHRONO_STATUS_LABEL.live,
    tone: "live",
    active: true,
    notesHref: latest ? `/changelog#${latest.version}` : "/changelog",
    diffHref: latest?.compareUrl || undefined,
  };

  if (!preview) return [live];

  const items = preview.items.map((row, index) => {
    const parsed = parseChangelogItem(row.item);
    const entry = preview.entry;
    return {
      id: `${entry.version}-${index}`,
      title: parsed.title,
      description: parsed.rationale,
      date: formatChangelogDate(entry.date),
      status: CHRONO_STATUS_LABEL[row.type],
      tone: row.type,
      notesHref: `/changelog#${entry.version}`,
      diffHref: parsed.issues[0]?.href ?? entry.compareUrl ?? undefined,
    } satisfies ChronoBoardCardModel;
  });

  return [live, ...items];
}

export function buildVersionChronoCards(
  entries: ChangelogEntry[],
  take = 5,
): ChronoBoardCardModel[] {
  return entries.slice(0, take).map((entry, index) => {
    const product = entry.sections.flatMap((section) =>
      section.items
        .filter(isProductChangelogItem)
        .map((item) => ({ type: section.type, item })),
    );
    const lead = product[0] ??
      entry.sections.flatMap((section) =>
        section.items.map((item) => ({ type: section.type, item })),
      )[0];
    const mix = releaseSectionMix(entry);
    const tone: ChronoTone = index === 0 ? "live" : (lead?.type ?? "changed");
    const description = lead
      ? entryHeadline([lead.item])
      : mix.map((item) => `${item.count} ${item.heading}`).join(" · ") ||
        "Release notes";

    return {
      id: entry.version,
      title: entry.version,
      description,
      date: formatChangelogDate(entry.date),
      status: index === 0 ? CHRONO_STATUS_LABEL.live : CHRONO_STATUS_LABEL[tone],
      tone,
      active: index === 0,
      notesHref: `#${entry.version}`,
      diffHref: entry.compareUrl || undefined,
    };
  });
}

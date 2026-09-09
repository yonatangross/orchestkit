import { describe, expect, it } from "vitest";
import type { ChangelogEntry } from "@/lib/generated/changelog-data";
import {
  buildReleaseChronoCards,
  buildVersionChronoCards,
} from "@/lib/chrono-board-release";

const ENTRIES: ChangelogEntry[] = [
  {
    version: "10.0.0-beta.12",
    date: "2026-09-09",
    compareUrl: "https://github.com/yonatangross/orchestkit/compare/a...b",
    sections: [
      {
        type: "changed",
        heading: "Miscellaneous",
        items: ["**build:** stamp manifests"],
      },
    ],
  },
  {
    version: "10.0.0-beta.11",
    date: "2026-09-08",
    compareUrl: "https://github.com/yonatangross/orchestkit/compare/c...d",
    sections: [
      {
        type: "added",
        heading: "Features",
        items: [
          "**skills:** relative paths ([#4012](https://github.com/yonatangross/orchestkit/issues/4012))",
        ],
      },
    ],
  },
];

describe("buildReleaseChronoCards", () => {
  it("leads with live catalog counts and follows with product changelog items", () => {
    const cards = buildReleaseChronoCards({
      entries: ENTRIES,
      counts: { skills: 107, agents: 36, hooks: 172 },
      latestVersion: "10.0.0-beta.12",
      itemLimit: 3,
    });

    expect(cards[0]).toMatchObject({
      title: "OrchestKit 10.0.0-beta.12 live",
      description: "107 skills · 36 agents · 172 hooks",
      status: "Latest",
      tone: "live",
      active: true,
      notesHref: "/changelog#10.0.0-beta.12",
    });
    expect(cards[1]).toMatchObject({
      title: "relative paths",
      status: "Shipped",
      tone: "added",
      notesHref: "/changelog#10.0.0-beta.11",
      diffHref: "https://github.com/yonatangross/orchestkit/issues/4012",
    });
    expect(cards.some((card) => /System Status|Phoenix-Next|Server Maintenance/i.test(card.title))).toBe(
      false,
    );
  });

  it("skips plumbing-only bullets when picking product cards", () => {
    const cards = buildReleaseChronoCards({
      entries: ENTRIES,
      counts: { skills: 1, agents: 1, hooks: 1 },
      latestVersion: "10.0.0-beta.12",
    });
    expect(cards.map((card) => card.title)).not.toContain("stamp manifests");
  });
});

describe("buildVersionChronoCards", () => {
  it("maps each recent release to a timeline card", () => {
    const cards = buildVersionChronoCards(ENTRIES, 2);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      id: "10.0.0-beta.12",
      title: "10.0.0-beta.12",
      status: "Latest",
      tone: "live",
      notesHref: "#10.0.0-beta.12",
    });
    expect(cards[1]?.title).toBe("10.0.0-beta.11");
    expect(cards[1]?.description).toMatch(/relative paths/i);
  });
});

import { describe, expect, it } from "vitest";
import { HOOK_EVENT_PAGES, isHookEventPage } from "@/lib/hook-events";
import { groupedHookEvents, HOOK_PHASES } from "@/lib/hook-phases";

describe("hook phases", () => {
  it("covers every hook event page exactly once", () => {
    const grouped = groupedHookEvents();
    const slugs = grouped.flatMap((phase) => phase.events.map((e) => e.slug));
    expect(slugs).toHaveLength(HOOK_EVENT_PAGES.length);
    expect(new Set(slugs).size).toBe(HOOK_EVENT_PAGES.length);
    expect(slugs.sort()).toEqual(
      HOOK_EVENT_PAGES.map((e) => e.slug).sort(),
    );
  });

  it("keeps the mermaid at six nodes, not one per hook", () => {
    const declared = HOOK_PHASES.reduce((n, phase) => n + phase.slugs.length, 0);
    expect(declared).toBe(HOOK_EVENT_PAGES.length);
    expect(HOOK_PHASES).toHaveLength(7);
  });
});

describe("isHookEventPage", () => {
  it("matches a four-column event page, not the index or a skill", () => {
    expect(isHookEventPage(["reference", "hooks", "session-end"])).toBe(true);
    expect(isHookEventPage(["reference", "hooks"])).toBe(false);
    expect(isHookEventPage(["reference", "hooks", "spotlights"])).toBe(false);
    expect(isHookEventPage(["reference", "skills", "tdd"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChronoBoard } from "@/components/ui/chrono-board";
import type { ChronoBoardCardModel } from "@/lib/chrono-board-release";

const CARDS: ChronoBoardCardModel[] = [
  {
    id: "live",
    title: "OrchestKit 10.0.0-beta.12 live",
    description: "107 skills · 36 agents · 172 hooks",
    date: "Sep 9, 2026",
    status: "Latest",
    tone: "live",
    active: true,
    notesHref: "/changelog#10.0.0-beta.12",
    diffHref: "https://github.com/yonatangross/orchestkit/compare/a...b",
  },
  {
    id: "item",
    title: "relative paths",
    description: "A skill you invoke with /ork: changed.",
    date: "Sep 8, 2026",
    status: "Shipped",
    tone: "added",
    notesHref: "/changelog#10.0.0-beta.11",
  },
];

describe("ChronoBoard", () => {
  it("renders release cards with Notes/Diff actions and theme tokens", () => {
    const { container } = render(
      <ChronoBoard cards={CARDS} labelledBy="whats-new-heading" />,
    );

    expect(screen.getByText("OrchestKit 10.0.0-beta.12 live")).toBeTruthy();
    expect(screen.getByText("107 skills · 36 agents · 172 hooks")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Release notes for OrchestKit 10.0.0-beta.12 live" }).getAttribute("href"),
    ).toBe("/changelog#10.0.0-beta.12");
    expect(
      screen.getByRole("link", { name: "Diff for OrchestKit 10.0.0-beta.12 live" }).getAttribute("href"),
    ).toContain("github.com/yonatangross/orchestkit/compare");
    expect(screen.queryByText("Dismiss")).toBeNull();
    expect(screen.queryByText("System Status: Nominal")).toBeNull();

    const html = container.innerHTML;
    expect(html).not.toMatch(/slate-800|bg-green-400|bg-blue-400|bg-amber-400|#0A0A0A/);
    expect(html).toMatch(/--color-fd-primary|--yy-george/);
  });

  it("marks the live card as the current item", () => {
    const { container } = render(<ChronoBoard cards={CARDS} />);
    const current = container.querySelector("[aria-current='true']");
    expect(current?.textContent).toMatch(/10\.0\.0-beta\.12 live/);
  });
});

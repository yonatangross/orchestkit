import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NARROW_PAGE_SIZE, SkillBrowser } from "@/components/skill-browser";

// Twelve skills, more than one narrow page (NARROW_PAGE_SIZE = 8).
vi.mock("@/lib/generated/skills-data", () => {
  const SKILLS: Record<string, unknown> = {};
  for (let i = 1; i <= 12; i++) {
    const name = `skill-${String(i).padStart(2, "0")}`;
    SKILLS[name] = {
      name,
      description: i === 12 ? "Needle description for search" : `Description ${i}`,
      version: "1.0.0",
      author: "orchestkit",
      tags: ["testing"],
      userInvocable: i === 1,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: null,
      structure: {},
      plugins: ["ork"],
      relatedAgents: [],
    };
  }
  return { SKILLS };
});

vi.mock("@/lib/generated/types", () => ({}));

const cardButtons = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-expanded"));

const cardOf = (button: HTMLElement) => button.parentElement as HTMLElement;

describe("SkillBrowser narrow first page", () => {
  it("hides cards past the first page below lg and offers Show all", async () => {
    render(<SkillBrowser />);
    const showAll = await screen.findByRole("button", { name: "Show all 12 skills" });
    expect(showAll.className).toContain("lg:hidden");
    const cards = cardButtons();
    expect(cards).toHaveLength(12);
    cards.forEach((button, i) => {
      expect(cardOf(button).className.includes("max-lg:hidden")).toBe(i >= NARROW_PAGE_SIZE);
    });
    // The status tells phones the truth (8) and desktop the truth (12).
    const status = screen.getByRole("status");
    expect(status.querySelector(".lg\\:hidden")?.textContent).toMatch(/Showing\s*8\s*of 12 skills/);
    expect(status.querySelector(".max-lg\\:hidden")?.textContent).toMatch(/Showing\s*12\s*of 12 skills/);
  });

  it("Show all reveals every card and moves focus to the first one it revealed", async () => {
    render(<SkillBrowser />);
    fireEvent.click(await screen.findByRole("button", { name: "Show all 12 skills" }));
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
    for (const button of cardButtons()) {
      expect(cardOf(button).className).not.toContain("max-lg:hidden");
    }
    await waitFor(() => expect(document.activeElement).toBe(cardButtons()[NARROW_PAGE_SIZE]));
  });

  it("Show fewer collapses back to the first page and returns focus to Show all", async () => {
    // Expanded, the phone page ran 18,593px with no way back (gate NEW-5).
    Element.prototype.scrollIntoView ??= () => {};
    render(<SkillBrowser />);
    fireEvent.click(await screen.findByRole("button", { name: "Show all 12 skills" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show fewer skills" }));
    const showAll = await screen.findByRole("button", { name: "Show all 12 skills" });
    expect(screen.queryByRole("button", { name: "Show fewer skills" })).toBeNull();
    expect(cardOf(cardButtons()[NARROW_PAGE_SIZE]).className).toContain("max-lg:hidden");
    await waitFor(() => expect(document.activeElement).toBe(showAll));
  });

  it("a search shows every match with no cap", async () => {
    render(<SkillBrowser />);
    await screen.findByRole("button", { name: "Show all 12 skills" });
    fireEvent.change(screen.getByRole("textbox", { name: /search skills/i }), {
      target: { value: "Needle" },
    });
    await waitFor(() => expect(cardButtons()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
    expect(cardOf(cardButtons()[0]).className).not.toContain("max-lg:hidden");
  });

  it("names each card by its skill and describes it by badges and description", async () => {
    render(<SkillBrowser />);
    const card = await screen.findByRole("button", { name: "skill-01" });
    expect(card).toHaveAccessibleName("skill-01");
    expect(card).toHaveAccessibleDescription(/Command/);
    expect(card).toHaveAccessibleDescription(/Description 1/);
  });
});

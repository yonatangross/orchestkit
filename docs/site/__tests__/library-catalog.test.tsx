import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LibraryCatalog } from "@/components/library-catalog";
import { CATEGORY_BADGE_CLASS, categoryLabel } from "@/lib/category-colors";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));

vi.mock("@/components/lazy", () => ({
  LazySkillBrowser: () => <div>skill browser</div>,
}));

vi.mock("@/components/changelog-mermaid", () => ({
  ChangelogMermaid: ({ chart }: { chart: string }) => (
    <pre data-testid="hook-flow">{chart}</pre>
  ),
}));

describe("LibraryCatalog", () => {
  beforeEach(() => {
    search = new URLSearchParams();
    replace.mockClear();
  });

  it("keeps Skills/Agents/Hooks as real tab links", () => {
    render(<LibraryCatalog />);
    expect(
      screen.getByRole("tab", { name: /skills/i }).getAttribute("href"),
    ).toBe("/#library");
    expect(
      screen.getByRole("tab", { name: /agents/i }).getAttribute("href"),
    ).toBe("/?lib=agents#library");
    expect(
      screen.getByRole("tab", { name: /hooks/i }).getAttribute("href"),
    ).toBe("/?lib=hooks#library");
    expect(
      screen.getByRole("tab", { name: /skills/i }).querySelector("svg"),
    ).toBeTruthy();
  });

  it("adopts a ?lib=agents deep link from the URL", async () => {
    search = new URLSearchParams("lib=agents");
    render(<LibraryCatalog />);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: /agents/i }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });

  it("preserves host when switching tabs", async () => {
    search = new URLSearchParams("host=cursor");
    render(<LibraryCatalog />);
    fireEvent.click(screen.getByRole("tab", { name: /hooks/i }));
    expect(replace).toHaveBeenCalledWith("/?host=cursor&lib=hooks#library", {
      scroll: false,
      transitionTypes: ["catalog"],
    });
    expect(
      await screen.findByRole("heading", { name: /session/i }),
    ).toBeTruthy();
    expect(screen.getByTestId("hook-flow").textContent).toMatch(
      /Session --> Prompt/,
    );
  });

  it("shows a first page of agents below lg, named by the agent", async () => {
    search = new URLSearchParams("lib=agents");
    render(<LibraryCatalog />);
    const showAll = await screen.findByRole("button", { name: /^Show all \d+ agents$/ });
    const panel = screen.getByRole("tabpanel");
    const links = Array.from(panel.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(8);
    links.forEach((link, i) => {
      expect(link.className.includes("max-lg:hidden")).toBe(i >= 8);
    });
    // Named by the agent alone, not the whole card text run together (QA #20).
    const first = links[0];
    expect(first).toHaveAccessibleName(first.querySelector("h3")?.textContent ?? "");
    fireEvent.click(showAll);
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
    for (const link of panel.querySelectorAll("a")) {
      expect(link.className).not.toContain("max-lg:hidden");
    }
  });

  it("caps the phone agent column at the page, so Show all cannot widen it", async () => {
    // emulate-engineer's 13-provider slash list made every card 588px at 390 (dogfood ISSUE-001).
    search = new URLSearchParams("lib=agents");
    render(<LibraryCatalog />);
    await screen.findByRole("button", { name: /^Show all \d+ agents$/ });
    const grid = screen.getByRole("tabpanel").querySelector("a")?.parentElement as HTMLElement;
    expect(grid.className.split(" ")).toContain("grid-cols-1");
    const desc = document.getElementById("agent-card-emulate-engineer-desc");
    expect(desc?.textContent).toMatch(/\w+\/\w+\/\w+/);
    expect(desc?.className.split(" ")).toContain("wrap-anywhere");
  });

  it("labels agent categories like skill badges, inside the clamped description", async () => {
    // Gate 2026-09-25: agent tags read "testing" / "frontend" while skill
    // badges read "Testing" / "Frontend".
    search = new URLSearchParams("lib=agents");
    render(<LibraryCatalog />);
    await screen.findByRole("button", { name: /^Show all \d+ agents$/ });
    const panel = screen.getByRole("tabpanel");
    for (const link of panel.querySelectorAll("a")) {
      const desc = link.querySelector("[id^='agent-card-']") as HTMLElement;
      expect(desc.className.split(" ")).toContain("line-clamp-2");
      const badge = desc.firstElementChild as HTMLElement;
      expect(badge.className).toContain(CATEGORY_BADGE_CLASS);
      const label = badge.textContent ?? "";
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    }
    const testing = document.getElementById("agent-card-test-generator-desc");
    expect(testing?.firstElementChild?.textContent).toBe(categoryLabel("testing"));
    expect(categoryLabel("testing")).toBe("Testing");
    expect(categoryLabel("llm")).toBe("LLM");
  });

  it("draws the hook flow as text below md and keeps the diagram from md up", async () => {
    search = new URLSearchParams("lib=hooks");
    render(<LibraryCatalog />);
    const compact = await screen.findByTestId("hook-flow-compact");
    expect(compact.className.split(" ")).toContain("md:hidden");
    expect(compact.textContent).toMatch(/Session.*Prompt.*Tools.*Files.*Agents.*Tasks.*Model/);
    for (const node of compact.querySelectorAll("li")) {
      if (node.children.length === 0) expect(node.className).toContain("text-xs");
    }
    const diagram = screen.getByTestId("hook-flow").parentElement as HTMLElement;
    expect(diagram.className.split(" ")).toContain("max-md:hidden");
  });

  it("moves focus to the newly selected tab on arrow keys", async () => {
    render(<LibraryCatalog />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /agents/i })).toHaveFocus();
    });
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /skills/i })).toHaveFocus();
    });
  });
});

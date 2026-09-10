import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LibraryCatalog } from "@/components/library-catalog";

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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
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
  it("keeps Skills/Agents/Hooks as real tab links", () => {
    render(<LibraryCatalog tab="skills" />);
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

  it("preserves host when switching tabs", async () => {
    replace.mockClear();
    render(<LibraryCatalog tab="skills" host="cursor" />);
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

  it("moves focus to the newly selected tab on arrow keys", async () => {
    render(<LibraryCatalog tab="skills" />);
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

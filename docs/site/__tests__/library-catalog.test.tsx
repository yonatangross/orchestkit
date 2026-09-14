import { beforeEach, describe, expect, it, vi } from "vitest";
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

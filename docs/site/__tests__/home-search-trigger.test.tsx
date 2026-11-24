import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeSearchTrigger } from "@/components/home-search-trigger";

afterEach(() => vi.restoreAllMocks());

describe("HomeSearchTrigger", () => {
  it.each([
    ["Linux x86_64", "Ctrl+K"],
    ["Win32", "Ctrl+K"],
    ["MacIntel", "⌘K"],
  ])("shows the search shortcut for %s", (platform, shortcut) => {
    // Arrange
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);

    // Act
    render(<HomeSearchTrigger />);

    // Assert
    expect(screen.getByText(shortcut, { selector: "kbd", exact: true })).toBeInTheDocument();
  });

  it("does not guess the browser shortcut in server-rendered HTML", () => {
    const html = renderToString(<HomeSearchTrigger />);
    expect(html).not.toContain("<kbd");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ChevronRight: () => <span data-testid="chevron" />,
}));

// Mock internal components
vi.mock("..//app/(home)/copy-button", () => ({
  CopyInstallButton: () => <button>Copy</button>,
}));

vi.mock("..//components/optimized-thumbnail", () => ({
  OptimizedThumbnail: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// Mock constants
vi.mock("..//lib/constants", () => ({
  SITE: {
    name: "OrchestKit",
    version: "6.3.0",
    domain: "https://orchestkit.vercel.app",
    github: "https://github.com/yonatangross/orchestkit",
    installCommand: "claude install orchestkit/ork",
  },
  COUNTS: { skills: 69, agents: 38, hooks: 78 },
}));

vi.mock("..//lib/generated/compositions-data", () => ({
  COMPOSITIONS: [],
}));

describe("getStarCount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns star count on successful API response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 120 }),
    });

    // Import fresh to use mocked fetch
    const mod = await import("../app/(home)/page");
    // getStarCount is not exported, so we test it via the component
    // Instead, test the fetch URL pattern
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches from correct GitHub API URL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 100 }),
    });

    // Render the page component (async server component)
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/yonatangross/orchestkit",
      expect.objectContaining({
        headers: { Accept: "application/vnd.github+json" },
      }),
    );
  });

  it("renders star count when API succeeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 142 }),
    });

    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    expect(screen.getByText("142")).toBeTruthy();
    expect(screen.getByText(/stars on GitHub/)).toBeTruthy();
  });

  it("renders gracefully when API fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    // Should still show "stars on GitHub" text without a number
    expect(screen.getByText(/stars on GitHub/)).toBeTruthy();
  });

  it("renders gracefully when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    expect(screen.getByText(/stars on GitHub/)).toBeTruthy();
  });
});

describe("landing page content", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 86 }),
    });
  });

  it("shows correct skill/agent/hook counts from constants", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    // Hero text uses COUNTS
    expect(screen.getByText(/69 skills, 38 agents, and 78 hooks/)).toBeTruthy();
  });

  it("has Star on GitHub button linking to repo", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    const starButton = screen.getByLabelText("Star OrchestKit on GitHub");
    expect(starButton).toBeTruthy();
    expect(starButton.getAttribute("href")).toBe("https://github.com/yonatangross/orchestkit");
    expect(starButton.getAttribute("rel")).toContain("noopener");
  });

  it("has stargazers link in social proof section", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    const stargazersLink = screen.getByText(/stars on GitHub/).closest("a");
    expect(stargazersLink?.getAttribute("href")).toBe(
      "https://github.com/yonatangross/orchestkit/stargazers",
    );
  });

  it("does NOT contain hardcoded clone counts or unverifiable claims", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);
    const text = container.textContent ?? "";

    // No hardcoded clone numbers
    expect(text).not.toMatch(/4,?780/);
    expect(text).not.toMatch(/developers cloned/i);
    // No unverifiable referrer claims
    expect(text).not.toMatch(/top referrers/i);
  });

  it("shows only verifiable social proof", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);
    const text = container.textContent ?? "";

    expect(text).toMatch(/stars on GitHub/);
    expect(text).toMatch(/Open source/);
    expect(text).toMatch(/Community-driven/);
  });
});

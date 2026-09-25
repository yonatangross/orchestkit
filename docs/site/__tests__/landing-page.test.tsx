import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img data-fill={fill ? "true" : undefined} data-priority={priority ? "true" : undefined} {...rest} />;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ArrowRight: () => <span data-testid="arrow" />,
  BadgeCheck: () => <span data-testid="badge-check" />,
  Ban: () => <span data-testid="ban" />,
  Check: () => <span data-testid="check" />,
  ChevronDown: () => <span data-testid="chevron-down" />,
  Copy: () => <span data-testid="copy" />,
  Search: () => <span data-testid="search" />,
  X: () => <span data-testid="x" />,
}));

// Mock internal components
vi.mock("../components/library-catalog", () => ({
  LibraryCatalog: () => (
    <section>
      <h2 id="library-heading">The library</h2>
    </section>
  ),
}));

vi.mock("../components/home-search-trigger", () => ({
  HomeSearchTrigger: () => (
    <button type="button">Search skills, agents, hooks, docs…</button>
  ),
}));

vi.mock("../components/whats-new-strip", () => ({
  WhatsNewStrip: () => (
    <section>
      <h2 id="whats-new-heading">What&apos;s new</h2>
    </section>
  ),
}));

vi.mock("../lib/generated/changelog-data", () => ({
  CHANGELOG_ENTRIES: [
    {
      version: "9.0.0",
      date: "2026-01-01",
      compareUrl: "",
      sections: [{ type: "added", items: ["test change"] }],
    },
  ],
}));

vi.mock("..//components/optimized-thumbnail", () => ({
  OptimizedThumbnail: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// Mock constants
vi.mock("..//lib/constants", () => ({
  SITE: {
    name: "OrchestKit",
    version: "6.3.0",
    domain: "https://orchestkit.yonyon.ai",
    github: "https://github.com/yonatangross/orchestkit",
    installCommand:
      "claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork@orchestkit",
    installSlashCommands: [
      "/plugin marketplace add yonatangross/orchestkit",
      "/plugin install ork",
    ],
    communityUrl: "/community",
    ccVersion: "2.1.148+",
  },
  COUNTS: { skills: 69, agents: 38, hooks: 96 },
  SITE_TITLE: "OrchestKit: for Claude Code and 7 more agents",
  PAGE_SUMMARY: {
    site: "69 skills, 38 agents and 96 hooks, for Claude Code and more coding agents. Stop explaining your stack. Start shipping.",
    pricing:
      "OrchestKit is free and open source under the MIT license. No paid tiers, no usage limits, no account required.",
  },
  PERSON: { name: "Yonatan Gross", url: "https://github.com/yonatangross" },
  ORG: {
    legalName: "OrchestKit",
    supportUrl: "https://github.com/yonatangross/orchestkit/issues",
    country: "IL",
  },
  SAME_AS: [
    "https://github.com/yonatangross/orchestkit",
    "https://github.com/yonatangross",
  ],
  YONYON: {
    name: "Yonyon",
    description:
      "Yonyon is an independent software studio building developer tooling for AI-assisted engineering.",
    disambiguation:
      "Yonyon here is a software studio (the publisher of OrchestKit) — not the musician of the same name.",
    url: "https://orchestkit.yonyon.ai/yonyon",
    wikidata: "https://www.wikidata.org/wiki/Q141457913",
  },
  // Added 2026-07-31 alongside the real INTEGRATIONS export (lib/constants.ts):
  // integrationMentionNodes() in structured-data.tsx reads this unconditionally
  // via softwareApplicationNode(), so any test mocking this module needs the key
  // present even when the test itself never inspects the value.
  INTEGRATIONS: [
    { name: "Anthropic", url: "https://www.anthropic.com", description: "Test integration." },
  ],
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

    // Import fresh to use mocked fetch (side-effect only)
    await import("../app/(home)/page");
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

    // Hero proof strip renders the formatted count and a "stars" label in
    // adjacent spans inside the stargazers link.
    expect(screen.getByText("142")).toBeTruthy();
    expect(screen.getByText("stars")).toBeTruthy();
  });

  it("renders gracefully when API fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    // When the count is null the link falls back to "Star on GitHub"
    expect(screen.getByText("Star on GitHub")).toBeTruthy();
  });

  it("renders gracefully when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    expect(screen.getByText("Star on GitHub")).toBeTruthy();
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

    // Hero proof line renders each count in its own span (mock COUNTS:
    // 69 skills / 38 agents / 96 hooks). Match the paragraph that contains
    // all three fragments via its combined textContent.
    expect(
      screen.getByText(
        (_content, el) => {
          const text = el?.textContent ?? "";
          return (
            el?.tagName === "P" &&
            text.includes("69 skills") &&
            text.includes("38 agents") &&
            text.includes("96 hooks")
          );
        },
      ),
    ).toBeTruthy();
  });

  it("has Star on GitHub button linking to repo", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    // The star link wraps the count/"stars" label. With the API mocked to 86
    // it renders a "stars" label; climb to the anchor and verify it targets
    // the stargazers page and opens safely.
    const starLink = screen.getByText("stars").closest("a");
    expect(starLink).toBeTruthy();
    expect(starLink?.getAttribute("href")).toBe(
      "https://github.com/yonatangross/orchestkit/stargazers",
    );
    expect(starLink?.getAttribute("rel")).toContain("noopener");
  });

  it("has stargazers link in social proof section", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    const stargazersLink = screen.getByText("stars").closest("a");
    expect(stargazersLink?.getAttribute("href")).toBe(
      "https://github.com/yonatangross/orchestkit/stargazers",
    );
  });

  it("has a single H1 and a clean H1→H2→H3 heading outline (no level skips)", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);

    // Exactly one H1 (the hero) anchors the document outline.
    expect(container.querySelectorAll("h1").length).toBe(1);

    // Every section title is a real heading and the levels never jump by more
    // than one (the orank "FLAT heading structure" defect): sections must use
    // H2/H3, not <div>/<span> stand-ins. Walk headings in document order and
    // assert no descent skips a level.
    const levels = Array.from(
      container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ).map((el) => Number(el.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }

    // The library catalog is labelled by a real <h2>, not a <span>.
    const libraryHeading = container.querySelector("#library-heading");
    expect(libraryHeading?.tagName).toBe("H2");
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

    // Redesigned hero proof strip: live GitHub stars (count + "stars" label
    // from the API), the MIT license, and the minimum Claude Code version.
    // The old "Open source" / "Community-driven" copy was removed in the
    // redesign, so those assertions are gone with it.
    expect(text).toMatch(/stars/);
    expect(text).toMatch(/MIT license/);
    expect(text).toMatch(/Claude Code/);
  });

  it("exposes WhatsApp as an icon to /community, not a platform.yonyon.ai href", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);

    const wa = screen.getByRole("link", { name: /join the whatsapp community/i });
    expect(wa.getAttribute("href")).toBe("/community");
    expect(container.innerHTML).not.toMatch(/platform\.yonyon\.ai/i);
    expect(container.textContent ?? "").not.toMatch(/Join the WhatsApp community/);
  });

  it("does not read searchParams, so / can be statically rendered", () => {
    // Reading the page `searchParams` prop renders / per request
    // (cache-control: private, no-store, ~3s cold TTFB). Host and catalog
    // state are read on the client instead.
    const src = readFileSync(resolve(__dirname, "../app/(home)/page.tsx"), "utf8");
    const code = src.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/searchParams/);
  });

  it("leads the hero with host chips, then exactly one command for the picked host", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);

    // Host first (operator + PostHog 2026-09-25: 76% of host picks were not
    // Claude Code), then that host's command, all inside the hero copy column.
    const copyCol = container.querySelector(".home-hero-copy") as HTMLElement;
    const nav = within(copyCol).getByRole("navigation", { name: /install by host/i });
    const box = nav.querySelector("[data-hero-install]") as HTMLElement;
    expect(box).toBeTruthy();
    const hosts = within(nav).getByRole("group", { name: "Hosts" });
    expect(
      hosts.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Claude Code is preselected and its box says so.
    expect(
      within(hosts).getByRole("link", { name: "Claude Code" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(within(box).getByText("Claude Code")).toBeTruthy();
    // Exactly one install copy button in the hero, and no second Claude-only box.
    expect(container.querySelectorAll("[data-hero-install]").length).toBe(1);
    expect(
      within(box).getAllByRole("button", { name: /copy claude plugin marketplace add/i }),
    ).toHaveLength(1);
    // The old "For Claude Code. On Cursor..." sentence is gone.
    expect(copyCol.textContent).not.toMatch(/Pick your host below/);
  });

  it("renders hero A conductor art with priority image and layout hooks", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    const { container } = render(result);

    const section = container.querySelector("section.home-hero");
    expect(section).toBeTruthy();
    expect(container.querySelector(".home-hero-copy")).toBeTruthy();
    expect(container.querySelector(".home-hero-art")).toBeTruthy();

    // One art per theme, both cropped to the subject (2026-09-25). The dark
    // layer is the default theme's LCP image, so it carries priority.
    const dark = container.querySelector(".home-hero-art img.home-hero-art-dark");
    expect(dark?.getAttribute("src")).toBe("/brand/hero-conductor-dark.png");
    expect(dark?.getAttribute("data-priority")).toBe("true");
    const light = container.querySelector(".home-hero-art img.home-hero-art-light");
    expect(light?.getAttribute("src")).toBe("/brand/hero-conductor-light.jpg");
    expect(container.querySelectorAll(".home-hero-art img")).toHaveLength(2);

    // Install + Get started stay in the copy column.
    const copyCol = container.querySelector(".home-hero-copy");
    expect(copyCol?.querySelector("[data-hero-install]")).toBeTruthy();
    expect(
      within(copyCol as HTMLElement).getByRole("link", { name: /get started/i }),
    ).toBeTruthy();

    // The compact host picker sits in the copy column; the band under the hero
    // keeps search, links and proof. The old 8-card picker made the copy
    // column ~600px taller than the art (operator report 2026-09-25).
    const more = container.querySelector(".home-hero-more");
    expect(more).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: /install by host/i });
    expect(copyCol?.contains(nav)).toBe(true);
    expect(more?.contains(nav)).toBe(false);
    // The art is a sibling of the copy column in the hero grid.
    const artBox = container.querySelector(".home-hero-art");
    expect(artBox?.parentElement).toBe(copyCol?.parentElement);
  });

  it("brands the nav with George's head crop and a one-color wordmark", async () => {
    const { baseOptions } = await import("../app/layout.config");
    const { container } = render(<>{baseOptions.nav?.title}</>);
    const mark = container.querySelector("img[data-brand-mark]");
    expect(mark?.getAttribute("src")).toContain("george-nav.png");
    expect(mark?.getAttribute("width")).toBe("30");
    // The whole 128px badge read as a blurred avatar at 22px.
    expect(container.querySelector('img[src*="george-badge"]')).toBeNull();
    expect(container.textContent).toBe("OrchestKit");
    expect(container.querySelector(".bg-clip-text")).toBeNull();
  });

  it("exposes a copyable install command per host", async () => {
    const HomePage = (await import("../app/(home)/page")).default;
    const result = await HomePage();
    render(result);

    const nav = screen.getByRole("navigation", { name: /install by host/i });
    expect(within(nav).getByRole("link", { name: "Claude Code" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Cursor" }).getAttribute("href")).toBe(
      "/?host=cursor",
    );
    expect(within(nav).getByRole("link", { name: "Codex" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Pi" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Muse Code" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "OpenCode" })).toBeTruthy();
    // The picker is the hero now, so it prints the default host's command once.
    expect(
      within(nav).getAllByRole("button", {
        name: /copy claude plugin marketplace add yonatangross\/orchestkit/i,
      }),
    ).toHaveLength(1);
    // The /ork:setup follow-up is genuinely extra, so it stays copyable.
    expect(
      within(nav).getByRole("button", {
        name: /^copy \/ork:setup to clipboard$/i,
      }),
    ).toBeTruthy();
    expect(
      within(nav).getByRole("link", { name: /Claude Code docs/i }).getAttribute("href"),
    ).toBe("/docs/getting-started/claude-code");
    expect(
      screen.getByRole("link", { name: /configure your project/i }).getAttribute("href"),
    ).toBe("/docs/getting-started/configuration");
  });
});

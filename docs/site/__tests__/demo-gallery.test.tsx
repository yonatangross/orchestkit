import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DemoGallery } from "@/components/demo-gallery";

// ── Mock playground data ────────────────────────────────────
vi.mock("@/lib/playground-data", () => {
  const mockCompositions = [
    {
      id: "ScrapbookDemo",
      skill: "demo-producer",
      command: "npx remotion render ScrapbookDemo",
      hook: "Scrapbook Motion marketing demo",
      style: "scrapbook",
      format: "landscape",
      width: 1920,
      height: 1080,
      fps: 30,
      durationSeconds: 60,
      folder: "src/compositions",
      category: "core",
      primaryColor: "#0d9488",
      relatedPlugin: "ork",
      tags: ["marketing", "demo", "scrapbook"],
      // Has both CDN thumbnail and video
      thumbnailCdn: "https://cdn.sanity.io/images/test/production/scrapbook-thumb.png",
      videoCdn: "https://cdn.sanity.io/files/test/production/scrapbook-video.mp4",
    },
    {
      id: "ReleaseNotesLandscape",
      skill: "release-management",
      command: "npx remotion render ReleaseNotesLandscape",
      hook: "Auto-generated release notes video",
      style: "clean",
      format: "landscape",
      width: 1920,
      height: 1080,
      fps: 30,
      durationSeconds: 45,
      folder: "src/compositions",
      category: "devops",
      primaryColor: "#7c3aed",
      relatedPlugin: "orkl",
      tags: ["release", "changelog"],
      // Has CDN thumbnail only — no video
      thumbnailCdn: "https://cdn.sanity.io/images/test/production/release-thumb.png",
    },
    {
      id: "MemoryFabricVertical",
      skill: "memory-fabric",
      command: "npx remotion render MemoryFabricVertical",
      hook: "Knowledge graph memory visualization",
      style: "dark",
      format: "vertical",
      width: 1080,
      height: 1920,
      fps: 60,
      durationSeconds: 30,
      folder: "src/compositions",
      category: "memory",
      primaryColor: "#06b6d4",
      relatedPlugin: "ork",
      tags: ["memory", "graph", "visualization"],
      // No CDN fields — local fallback
    },
    {
      id: "AgentSelectorSquare",
      skill: "agent-selector",
      command: "npx remotion render AgentSelectorSquare",
      hook: "Interactive agent selection demo",
      style: "ocean",
      format: "square",
      width: 1080,
      height: 1080,
      fps: 30,
      durationSeconds: 15,
      folder: "src/compositions",
      category: "ai",
      primaryColor: "#059669",
      relatedPlugin: "ork",
      tags: ["agents", "interactive"],
      // No CDN fields — local fallback
    },
  ];

  return { COMPOSITIONS: mockCompositions };
});

describe("DemoGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial rendering ─────────────────────────────────────

  it("renders composition count", () => {
    render(<DemoGallery />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing");
    expect(screen.getByRole("status")).toHaveTextContent("4");
    expect(screen.getByRole("status")).toHaveTextContent("of 4 compositions");
  });

  it("renders all composition cards", () => {
    render(<DemoGallery />);
    expect(
      screen.getByLabelText("View details for Scrapbook Demo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("View details for Release Notes Landscape"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("View details for Memory Fabric Vertical"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("View details for Agent Selector Square"),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<DemoGallery />);
    expect(
      screen.getByPlaceholderText(
        "Search compositions by title, command, or tags...",
      ),
    ).toBeInTheDocument();
  });

  // ── Format filter ─────────────────────────────────────────

  it("renders format filter pills", () => {
    render(<DemoGallery />);
    // Check "All" is pressed by default
    const allBtn = screen.getAllByRole("button", { name: "All" })[0];
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by landscape format", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByRole("button", { name: "Landscape (16:9)" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("2");
    expect(
      screen.getByLabelText("View details for Scrapbook Demo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("View details for Release Notes Landscape"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("View details for Memory Fabric Vertical"),
    ).not.toBeInTheDocument();
  });

  it("filters by vertical format", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByRole("button", { name: "Vertical (9:16)" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Memory Fabric Vertical"),
    ).toBeInTheDocument();
  });

  it("filters by square format", () => {
    render(<DemoGallery />);

    fireEvent.click(screen.getByRole("button", { name: "Square (1:1)" }));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Agent Selector Square"),
    ).toBeInTheDocument();
  });

  // ── Category filter ───────────────────────────────────────

  it("renders category filter pills", () => {
    render(<DemoGallery />);
    // Category pills are inside a fieldset with legend "Category"
    const fieldset = screen.getByRole("group", { name: /category/i });
    expect(within(fieldset).getByText("Core")).toBeInTheDocument();
    expect(within(fieldset).getByText("DevOps")).toBeInTheDocument();
    expect(within(fieldset).getByText("Memory")).toBeInTheDocument();
    expect(within(fieldset).getByText("AI")).toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<DemoGallery />);

    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Memory"));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Memory Fabric Vertical"),
    ).toBeInTheDocument();
  });

  it("deselects category when clicked again", () => {
    render(<DemoGallery />);

    const fieldset = screen.getByRole("group", { name: /category/i });

    fireEvent.click(within(fieldset).getByText("Core"));
    expect(screen.getByRole("status")).toHaveTextContent("1");

    fireEvent.click(within(fieldset).getByText("Core"));
    expect(screen.getByRole("status")).toHaveTextContent("4");
  });

  // ── Search ────────────────────────────────────────────────

  it("filters by search query", () => {
    render(<DemoGallery />);

    const searchInput = screen.getByPlaceholderText(
      "Search compositions by title, command, or tags...",
    );
    fireEvent.change(searchInput, { target: { value: "release" } });

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Release Notes Landscape"),
    ).toBeInTheDocument();
  });

  it("filters by tag search", () => {
    render(<DemoGallery />);

    const searchInput = screen.getByPlaceholderText(
      "Search compositions by title, command, or tags...",
    );
    fireEvent.change(searchInput, { target: { value: "graph" } });

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Memory Fabric Vertical"),
    ).toBeInTheDocument();
  });

  it("shows clear search button when active", () => {
    render(<DemoGallery />);

    const searchInput = screen.getByPlaceholderText(
      "Search compositions by title, command, or tags...",
    );

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "test" } });
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(searchInput).toHaveValue("");
  });

  // ── Empty state ───────────────────────────────────────────

  it("shows empty state when nothing matches", () => {
    render(<DemoGallery />);

    const searchInput = screen.getByPlaceholderText(
      "Search compositions by title, command, or tags...",
    );
    fireEvent.change(searchInput, {
      target: { value: "nonexistent-comp-xyz" },
    });

    expect(
      screen.getByText("No compositions match your filters"),
    ).toBeInTheDocument();
  });

  it("clears filters from empty state", () => {
    render(<DemoGallery />);

    fireEvent.change(
      screen.getByPlaceholderText(
        "Search compositions by title, command, or tags...",
      ),
      { target: { value: "nonexistent" } },
    );

    // Use the button inside the empty state
    const buttons = screen.getAllByRole("button", { name: /clear all filters/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(screen.getByRole("status")).toHaveTextContent("4");
  });

  // ── Clear all ─────────────────────────────────────────────

  it("shows Clear all link when filters are active", () => {
    render(<DemoGallery />);

    expect(screen.queryByLabelText("Clear all filters")).not.toBeInTheDocument();

    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Core"));
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  // ── Combined filters ──────────────────────────────────────

  it("combines format and search filters", () => {
    render(<DemoGallery />);

    // Filter to landscape
    fireEvent.click(
      screen.getByRole("button", { name: "Landscape (16:9)" }),
    );

    // Search for "scrapbook"
    fireEvent.change(
      screen.getByPlaceholderText(
        "Search compositions by title, command, or tags...",
      ),
      { target: { value: "scrapbook" } },
    );

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByLabelText("View details for Scrapbook Demo"),
    ).toBeInTheDocument();
  });

  // ── Modal ─────────────────────────────────────────────────

  it("opens modal when card is clicked", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("1920x1080")).toBeInTheDocument();
    // Duration appears on both card and modal; scope to dialog
    expect(within(dialog).getByText("60s")).toBeInTheDocument();
    // "scrapbook" appears as Style value AND as a tag; verify at least one is present
    expect(within(dialog).getAllByText("scrapbook").length).toBeGreaterThanOrEqual(1);
  });

  it("closes modal when Close button is clicked", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on Escape key", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal when backdrop is clicked", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const backdrop = screen.getByRole("dialog");
    // Click the backdrop (the outer div with role="dialog")
    fireEvent.click(backdrop);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows composition metadata in modal", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Resolution")).toBeInTheDocument();
    expect(within(dialog).getByText("Duration")).toBeInTheDocument();
    expect(within(dialog).getByText("FPS")).toBeInTheDocument();
    expect(within(dialog).getByText("Style")).toBeInTheDocument();
    expect(within(dialog).getByText("Plugin")).toBeInTheDocument();
    expect(within(dialog).getByText("ork")).toBeInTheDocument();
  });

  it("shows command with copy button in modal", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("npx remotion render ScrapbookDemo"),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Copy command")).toBeInTheDocument();
  });

  it("shows tags in modal", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    expect(screen.getByText("marketing")).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
  });

  it("renders card thumbnails with correct src", () => {
    render(<DemoGallery />);

    const images = screen.getAllByRole("img");
    // ScrapbookDemo has thumbnailCdn — should use CDN URL
    const scrapbookImg = images.find((img) =>
      img.getAttribute("alt")?.includes("Scrapbook Demo"),
    );
    expect(scrapbookImg).toHaveAttribute(
      "src",
      "https://cdn.sanity.io/images/test/production/scrapbook-thumb.png",
    );
  });

  it("renders duration badge on cards", () => {
    render(<DemoGallery />);
    expect(screen.getByText("60s")).toBeInTheDocument();
    expect(screen.getByText("45s")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByText("15s")).toBeInTheDocument();
  });

  // ── CDN thumbnail fallback ────────────────────────────────

  it("uses CDN thumbnail when available", () => {
    render(<DemoGallery />);

    const images = screen.getAllByRole("img");
    // ReleaseNotesLandscape has thumbnailCdn
    const releaseImg = images.find((img) =>
      img.getAttribute("alt")?.includes("Release Notes Landscape"),
    );
    expect(releaseImg).toHaveAttribute(
      "src",
      "https://cdn.sanity.io/images/test/production/release-thumb.png",
    );
  });

  it("falls back to local thumbnail when no CDN URL", () => {
    render(<DemoGallery />);

    const images = screen.getAllByRole("img");
    // MemoryFabricVertical has no thumbnailCdn
    const memoryImg = images.find((img) =>
      img.getAttribute("alt")?.includes("Memory Fabric Vertical"),
    );
    expect(memoryImg).toHaveAttribute(
      "src",
      "/thumbnails/MemoryFabricVertical.png",
    );
  });

  // ── Video playback in modal ─────────────────────────────

  it("renders video player in modal when videoCdn exists", () => {
    render(<DemoGallery />);

    // ScrapbookDemo has videoCdn
    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const dialog = screen.getByRole("dialog");

    // happy-dom may not support getByRole("video"), so query by tag
    const videoEl = dialog.querySelector("video");
    expect(videoEl).not.toBeNull();
    expect(videoEl!.getAttribute("src")).toBe(
      "https://cdn.sanity.io/files/test/production/scrapbook-video.mp4",
    );
    expect(videoEl!.hasAttribute("controls")).toBe(true);
    expect(videoEl!.hasAttribute("autoplay")).toBe(true);
    expect(videoEl!.getAttribute("poster")).toBe(
      "https://cdn.sanity.io/images/test/production/scrapbook-thumb.png",
    );
  });

  it("shows thumbnail with 'coming soon' badge when no videoCdn", () => {
    render(<DemoGallery />);

    // ReleaseNotesLandscape has thumbnailCdn but no videoCdn
    fireEvent.click(
      screen.getByLabelText("View details for Release Notes Landscape"),
    );

    const dialog = screen.getByRole("dialog");

    // Should NOT have a video element
    expect(dialog.querySelector("video")).toBeNull();

    // Should show an img with CDN thumbnail
    const images = within(dialog).getAllByRole("img");
    const previewImg = images.find((img) =>
      img.getAttribute("alt")?.includes("Preview"),
    );
    expect(previewImg).toHaveAttribute(
      "src",
      "https://cdn.sanity.io/images/test/production/release-thumb.png",
    );

    // Should show "Video in production" badge
    expect(within(dialog).getByText("Video in production")).toBeInTheDocument();
  });

  it("shows local thumbnail fallback in modal when no CDN fields", () => {
    render(<DemoGallery />);

    // MemoryFabricVertical has no CDN fields at all
    fireEvent.click(
      screen.getByLabelText("View details for Memory Fabric Vertical"),
    );

    const dialog = screen.getByRole("dialog");

    // No video element
    expect(dialog.querySelector("video")).toBeNull();

    // Local fallback thumbnail
    const images = within(dialog).getAllByRole("img");
    const previewImg = images.find((img) =>
      img.getAttribute("alt")?.includes("Preview"),
    );
    expect(previewImg).toHaveAttribute(
      "src",
      "/thumbnails/MemoryFabricVertical.png",
    );

    // "Coming soon" badge
    expect(within(dialog).getByText("Video in production")).toBeInTheDocument();
  });

  it("video element has playsInline attribute", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Scrapbook Demo"),
    );

    const dialog = screen.getByRole("dialog");
    const videoEl = dialog.querySelector("video");
    expect(videoEl).not.toBeNull();
    // React renders playsInline as playsinline attribute
    expect(
      videoEl!.hasAttribute("playsinline") || videoEl!.hasAttribute("playsInline"),
    ).toBe(true);
  });

  // ── Card status indicators ──────────────────────────────

  it("shows 'In production' on hover for cards without video", () => {
    render(<DemoGallery />);

    // MemoryFabricVertical has no videoCdn
    const card = screen.getByLabelText(
      "View details for Memory Fabric Vertical",
    );
    // The "In production" text should exist in the card (visible on hover via CSS)
    expect(within(card).getByText("In production")).toBeInTheDocument();
  });

  it("does not show 'In production' on cards with video", () => {
    render(<DemoGallery />);

    // ScrapbookDemo has videoCdn
    const card = screen.getByLabelText("View details for Scrapbook Demo");
    expect(within(card).queryByText("In production")).not.toBeInTheDocument();
  });

  it("dims thumbnail in modal when no video available", () => {
    render(<DemoGallery />);

    fireEvent.click(
      screen.getByLabelText("View details for Release Notes Landscape"),
    );

    const dialog = screen.getByRole("dialog");
    const previewImg = within(dialog)
      .getAllByRole("img")
      .find((img) => img.getAttribute("alt")?.includes("Preview"));
    // Thumbnail should have opacity-60 class to indicate non-playable state
    expect(previewImg?.className).toContain("opacity-60");
  });
});

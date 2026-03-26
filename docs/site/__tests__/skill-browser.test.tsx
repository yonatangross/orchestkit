import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { SkillBrowser } from "@/components/skill-browser";

// ── Mock generated skills data ──────────────────────────────
vi.mock("@/lib/generated/skills-data", () => {
  const mockSkills: Record<string, any> = {
    implement: {
      name: "implement",
      description: "Full-power feature implementation with parallel agents",
      version: "4.0.0",
      author: "orchestkit",
      tags: ["development", "workflow", "implementation"],
      userInvocable: true,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: null,
      structure: {},
      plugins: ["ork"],
      relatedAgents: ["frontend-ui-developer", "backend-system-architect"],
    },
    "fastapi-advanced": {
      name: "fastapi-advanced",
      description: "Advanced FastAPI patterns including lifespan events",
      version: "1.0.0",
      author: "orchestkit",
      tags: ["backend", "fastapi", "python", "api"],
      userInvocable: false,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: "backend-system-architect",
      structure: {},
      plugins: ["ork"],
      relatedAgents: ["backend-system-architect"],
    },
    "react-server-components-framework": {
      name: "react-server-components-framework",
      description: "React Server Components with Next.js 16+",
      version: "2.0.0",
      author: "orchestkit",
      tags: ["react", "frontend", "nextjs", "component"],
      userInvocable: false,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: "frontend-ui-developer",
      structure: {},
      plugins: ["ork"],
      relatedAgents: ["frontend-ui-developer"],
    },
    "owasp-top-10": {
      name: "owasp-top-10",
      description: "OWASP Top 10 security vulnerabilities and mitigations",
      version: "1.0.0",
      author: "orchestkit",
      tags: ["security", "owasp", "vulnerability"],
      userInvocable: false,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: "security-auditor",
      structure: {},
      plugins: ["ork"],
      relatedAgents: ["security-auditor", "ai-safety-auditor"],
    },
    "e2e-testing": {
      name: "e2e-testing",
      description: "End-to-end testing with Playwright 1.58+",
      version: "1.0.0",
      author: "orchestkit",
      tags: ["testing", "playwright", "e2e"],
      userInvocable: false,
      context: "fork",
      allowedTools: [],
      skills: [],
      agent: "test-generator",
      structure: {},
      plugins: ["ork"],
      relatedAgents: ["test-generator"],
    },
  };

  return { SKILLS: mockSkills };
});

vi.mock("@/lib/generated/types", () => ({}));

describe("SkillBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skill count header", () => {
    render(<SkillBrowser />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing");
    expect(screen.getByRole("status")).toHaveTextContent("5");
    expect(screen.getByRole("status")).toHaveTextContent("of 5 skills");
  });

  it("renders all skill cards", () => {
    render(<SkillBrowser />);
    expect(screen.getByText("implement")).toBeInTheDocument();
    expect(screen.getByText("fastapi-advanced")).toBeInTheDocument();
    expect(screen.getByText("react-server-components-framework")).toBeInTheDocument();
    expect(screen.getByText("owasp-top-10")).toBeInTheDocument();
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
  });

  it("renders search input with placeholder", () => {
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("filters skills by search query on name", async () => {
    vi.useFakeTimers();
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );

    fireEvent.change(searchInput, { target: { value: "fastapi" } });
    await act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    // Highlight component splits text into spans, so use substring matcher
    expect(screen.getByText((_, el) => el?.textContent === "fastapi-advanced")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("filters skills by search query on description", async () => {
    vi.useFakeTimers();
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );

    fireEvent.change(searchInput, { target: { value: "Playwright" } });
    await act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("filters skills by search query on tags", async () => {
    vi.useFakeTimers();
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );

    fireEvent.change(searchInput, { target: { value: "owasp" } });
    await act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    // Highlight component splits text into spans, so use substring matcher
    expect(screen.getByText((_, el) => el?.textContent === "owasp-top-10")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows clear search button when search is active", () => {
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );

    // No clear button initially
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "test" } });
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();

    // Click clear
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(searchInput).toHaveValue("");
  });

  it("displays empty state when no skills match", async () => {
    vi.useFakeTimers();
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );

    fireEvent.change(searchInput, {
      target: { value: "nonexistent-skill-xyz" },
    });
    await act(() => vi.advanceTimersByTime(200));

    // Empty state now shows the query text
    expect(screen.getByText(/No skills match/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try broadening your search or removing some filters.",
      ),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders category filter pills", () => {
    render(<SkillBrowser />);
    // Category pills are inside a fieldset with legend "Category"
    const fieldset = screen.getByRole("group", { name: /category/i });
    expect(within(fieldset).getByText("Development")).toBeInTheDocument();
    expect(within(fieldset).getByText("Backend")).toBeInTheDocument();
    expect(within(fieldset).getByText("Frontend")).toBeInTheDocument();
    expect(within(fieldset).getByText("Security")).toBeInTheDocument();
    expect(within(fieldset).getByText("Testing")).toBeInTheDocument();
  });

  it("filters by category when pill is clicked", () => {
    render(<SkillBrowser />);

    // Click Security category pill (inside the fieldset)
    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Security"));

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(screen.getByText("owasp-top-10")).toBeInTheDocument();
  });

  it("toggles category filter off when clicked again", () => {
    render(<SkillBrowser />);

    const fieldset = screen.getByRole("group", { name: /category/i });

    // Click Security category on
    fireEvent.click(within(fieldset).getByText("Security"));
    expect(screen.getByRole("status")).toHaveTextContent("1");

    // Click again to deselect
    fireEvent.click(within(fieldset).getByText("Security"));
    expect(screen.getByRole("status")).toHaveTextContent("5");
  });

  it("renders plugin filter group with All, ork buttons", () => {
    render(<SkillBrowser />);
    const group = screen.getByRole("group", { name: "Filter by plugin" });
    expect(group).toBeInTheDocument();

    // All is active by default
    const allBtn = screen.getByRole("button", { name: "All" });
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by plugin when ork button is clicked", () => {
    render(<SkillBrowser />);

    // Click ork filter — all skills are in ork (v7 unified plugin)
    const orkBtn = screen.getByRole("button", { name: "ork" });
    fireEvent.click(orkBtn);

    expect(screen.getByRole("status")).toHaveTextContent("5");
    expect(screen.getByText("implement")).toBeInTheDocument();
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
    expect(screen.getByText("fastapi-advanced")).toBeInTheDocument();
  });

  it("shows Command badge for user-invocable skills", () => {
    render(<SkillBrowser />);
    // implement is userInvocable: true
    const commandBadges = screen.getAllByText("Command");
    expect(commandBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("expands skill card on click and shows detail panel", () => {
    render(<SkillBrowser />);

    // Find the implement card's button
    const cardButton = screen.getByRole("button", { name: /implement/i });
    expect(cardButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(cardButton);
    expect(cardButton).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses expanded card when clicked again", () => {
    render(<SkillBrowser />);

    const cardButton = screen.getByRole("button", { name: /implement/i });
    fireEvent.click(cardButton); // expand
    expect(cardButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(cardButton); // collapse
    expect(cardButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows Clear all button when any filter is active", () => {
    render(<SkillBrowser />);

    // No clear all initially
    expect(screen.queryByLabelText("Clear all filters")).not.toBeInTheDocument();

    // Apply category filter (scope to fieldset)
    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Backend"));
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("clears all filters when Clear all is clicked", () => {
    render(<SkillBrowser />);

    // Apply search + category
    const searchInput = screen.getByPlaceholderText(
      "Search skills by name, description, or tag...",
    );
    fireEvent.change(searchInput, { target: { value: "api" } });
    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Backend"));

    // Click clear all
    fireEvent.click(screen.getByLabelText("Clear all filters"));

    expect(searchInput).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("5");
  });

  it("clears filters from empty state button", async () => {
    vi.useFakeTimers();
    render(<SkillBrowser />);

    fireEvent.change(
      screen.getByPlaceholderText(
        "Search skills by name, description, or tag...",
      ),
      { target: { value: "nonexistent-xyz" } },
    );
    await act(() => vi.advanceTimersByTime(200));

    expect(screen.getByText(/No skills match/)).toBeInTheDocument();

    // In empty state, there's only one "Clear all filters" button visible
    const buttons = screen.getAllByRole("button", { name: /clear all filters/i });
    fireEvent.click(buttons[buttons.length - 1]);
    await act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole("status")).toHaveTextContent("5");
    vi.useRealTimers();
  });

  it("combines search + category + plugin filters", () => {
    render(<SkillBrowser />);

    // Filter to ork only
    fireEvent.click(screen.getByRole("button", { name: "ork" }));

    // Then search for "api"
    fireEvent.change(
      screen.getByPlaceholderText(
        "Search skills by name, description, or tag...",
      ),
      { target: { value: "api" } },
    );

    // Should show fastapi-advanced (ork, backend/api tag)
    expect(screen.getByText("fastapi-advanced")).toBeInTheDocument();
  });
});

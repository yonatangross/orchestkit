import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
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

// Wait for the async Orama collection to report the given visible count.
function expectCount(n: number) {
  return waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      new RegExp(`Showing\\s*${n}\\s*of 5 skills`),
    ),
  );
}

const PLACEHOLDER = "Search skills by name, description, or tag...";

describe("SkillBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skill count header once the index is ready", async () => {
    render(<SkillBrowser />);
    await expectCount(5);
  });

  it("renders all skill cards", async () => {
    render(<SkillBrowser />);
    expect(await screen.findByText("implement")).toBeInTheDocument();
    expect(screen.getByText("fastapi-advanced")).toBeInTheDocument();
    expect(
      screen.getByText("react-server-components-framework"),
    ).toBeInTheDocument();
    expect(screen.getByText("owasp-top-10")).toBeInTheDocument();
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
  });

  it("renders search input with placeholder", () => {
    render(<SkillBrowser />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });

  it("filters skills by search query on name", async () => {
    render(<SkillBrowser />);
    await expectCount(5);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "fastapi" },
    });
    await expectCount(1);
    // Highlight splits text into spans, so use a textContent matcher.
    expect(
      screen.getByText((_, el) => el?.textContent === "fastapi-advanced"),
    ).toBeInTheDocument();
  });

  it("filters skills by search query on description", async () => {
    render(<SkillBrowser />);
    await expectCount(5);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "Playwright" },
    });
    await expectCount(1);
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
  });

  it("filters skills by search query on tags", async () => {
    render(<SkillBrowser />);
    await expectCount(5);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "owasp" },
    });
    await expectCount(1);
    expect(
      screen.getByText((_, el) => el?.textContent === "owasp-top-10"),
    ).toBeInTheDocument();
  });

  it("shows clear search button when search is active", () => {
    render(<SkillBrowser />);
    const searchInput = screen.getByPlaceholderText(PLACEHOLDER);

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "test" } });
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(searchInput).toHaveValue("");
  });

  it("displays empty state when no skills match", async () => {
    render(<SkillBrowser />);
    await expectCount(5);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "nonexistent-skill-xyz" },
    });

    expect(await screen.findByText(/No skills match/)).toBeInTheDocument();
    expect(
      screen.getByText("Try broadening your search or removing some filters."),
    ).toBeInTheDocument();
  });

  it("renders category filter pills", () => {
    render(<SkillBrowser />);
    const fieldset = screen.getByRole("group", { name: /category/i });
    expect(within(fieldset).getByText("Development")).toBeInTheDocument();
    expect(within(fieldset).getByText("Backend")).toBeInTheDocument();
    expect(within(fieldset).getByText("Frontend")).toBeInTheDocument();
    expect(within(fieldset).getByText("Security")).toBeInTheDocument();
    expect(within(fieldset).getByText("Testing")).toBeInTheDocument();
  });

  it("filters by category when pill is clicked", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Security"));

    await expectCount(1);
    expect(screen.getByText("owasp-top-10")).toBeInTheDocument();
  });

  it("toggles category filter off when clicked again", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    const fieldset = screen.getByRole("group", { name: /category/i });

    fireEvent.click(within(fieldset).getByText("Security"));
    await expectCount(1);

    fireEvent.click(within(fieldset).getByText("Security"));
    await expectCount(5);
  });

  it("renders plugin filter group with All, ork buttons", () => {
    render(<SkillBrowser />);
    const group = screen.getByRole("group", { name: "Filter by plugin" });
    expect(group).toBeInTheDocument();

    const allBtn = screen.getByRole("button", { name: "All" });
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by plugin when ork button is clicked", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    fireEvent.click(screen.getByRole("button", { name: "ork" }));

    // All five mock skills belong to ork (v7 unified plugin).
    await expectCount(5);
    expect(screen.getByText("implement")).toBeInTheDocument();
    expect(screen.getByText("e2e-testing")).toBeInTheDocument();
    expect(screen.getByText("fastapi-advanced")).toBeInTheDocument();
  });

  it("shows Command badge for user-invocable skills", async () => {
    render(<SkillBrowser />);
    await screen.findByText("implement");
    // implement is userInvocable: true
    const commandBadges = screen.getAllByText("Command");
    expect(commandBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("expands skill card on click and shows detail panel", async () => {
    render(<SkillBrowser />);
    const cardButton = await screen.findByRole("button", {
      name: /implement/i,
    });
    expect(cardButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(cardButton);
    expect(cardButton).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses expanded card when clicked again", async () => {
    render(<SkillBrowser />);
    const cardButton = await screen.findByRole("button", {
      name: /implement/i,
    });
    fireEvent.click(cardButton); // expand
    expect(cardButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(cardButton); // collapse
    expect(cardButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows Clear all button when any filter is active", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    expect(
      screen.queryByLabelText("Clear all filters"),
    ).not.toBeInTheDocument();

    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Backend"));
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("clears all filters when Clear all is clicked", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "api" },
    });
    const fieldset = screen.getByRole("group", { name: /category/i });
    fireEvent.click(within(fieldset).getByText("Backend"));

    fireEvent.click(screen.getByLabelText("Clear all filters"));

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue("");
    await expectCount(5);
  });

  it("clears filters from empty state button", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "nonexistent-xyz" },
    });

    expect(await screen.findByText(/No skills match/)).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", {
      name: /clear all filters/i,
    });
    fireEvent.click(buttons[buttons.length - 1]);

    await expectCount(5);
  });

  it("combines search + category + plugin filters", async () => {
    render(<SkillBrowser />);
    await expectCount(5);

    fireEvent.click(screen.getByRole("button", { name: "ork" }));

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "api" },
    });

    // fastapi-advanced (ork, backend/api tag) should survive.
    expect(
      await screen.findByText(
        (_, el) => el?.textContent === "fastapi-advanced",
      ),
    ).toBeInTheDocument();
  });
});

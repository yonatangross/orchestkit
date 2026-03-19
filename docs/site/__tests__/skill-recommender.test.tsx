import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SkillRecommender } from "@/components/skill-recommender";

// Mock skills data with controlled test fixtures
vi.mock("@/lib/generated/skills-data", () => {
  const mockSkills: Record<string, any> = {
    implement: {
      name: "implement",
      description: "Full-power feature implementation with parallel subagents.",
      tags: ["implementation", "feature", "full-stack", "workflow"],
      userInvocable: true,
      skills: ["api-design", "verify", "memory"],
      agent: null,
    },
    "api-design": {
      name: "api-design",
      description: "API design patterns for REST/GraphQL.",
      tags: ["rest", "fastapi", "api-design", "graphql"],
      userInvocable: false,
      skills: [],
      agent: "backend-system-architect",
    },
    "testing-unit": {
      name: "testing-unit",
      description: "Unit testing patterns for isolated business logic.",
      tags: ["testing", "unit", "mocking", "vitest"],
      userInvocable: false,
      skills: [],
      agent: "test-generator",
    },
    verify: {
      name: "verify",
      description: "Comprehensive verification with parallel test agents.",
      tags: ["testing", "coverage", "quality"],
      userInvocable: true,
      skills: ["testing-unit", "memory"],
      agent: null,
    },
    "python-backend": {
      name: "python-backend",
      description: "Python backend patterns for asyncio, FastAPI.",
      tags: ["python", "fastapi", "asyncio", "sqlalchemy"],
      userInvocable: false,
      skills: [],
      agent: "backend-system-architect",
    },
    "security-patterns": {
      name: "security-patterns",
      description: "Security patterns for OWASP and defense-in-depth.",
      tags: ["security", "owasp", "authentication"],
      userInvocable: false,
      skills: [],
      agent: "security-auditor",
    },
    memory: {
      name: "memory",
      description: "Read-side memory operations.",
      tags: ["memory", "knowledge-graph"],
      userInvocable: true,
      skills: [],
      agent: null,
    },
    brainstorm: {
      name: "brainstorm",
      description: "Design exploration with parallel agents.",
      tags: ["planning", "brainstorm", "design"],
      userInvocable: true,
      skills: ["memory"],
      agent: null,
    },
  };
  return { SKILLS: mockSkills };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SkillRecommender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rendering ──────────────────────────────────────────

  it("renders step 1 with role options", () => {
    render(<SkillRecommender />);
    expect(screen.getByText("What's your role?")).toBeTruthy();
    expect(screen.getByText("Backend Dev")).toBeTruthy();
    expect(screen.getByText("Frontend Dev")).toBeTruthy();
    expect(screen.getByText("AI Engineer")).toBeTruthy();
    expect(screen.getByText("QA / Testing")).toBeTruthy();
  });

  it("renders progress bar with 4 segments", () => {
    const { container } = render(<SkillRecommender />);
    // 3 steps + 1 results = 4 progress segments
    const bars = container.querySelectorAll("[class*='rounded-full'][class*='h-1']");
    expect(bars.length).toBe(4);
  });

  // ── Step Navigation ────────────────────────────────────

  it("advances to step 2 after selecting a role", () => {
    render(<SkillRecommender />);
    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("What are you working on?")).toBeTruthy();
  });

  it("advances through all 3 steps to results", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByText("New Feature"));
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByText("Python / FastAPI"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Recommended for you")).toBeTruthy();
  });

  it("shows Back button on step 2 but not step 1", () => {
    render(<SkillRecommender />);
    expect(screen.queryByText("Back")).toBeNull();

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("Back button returns to previous step", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("What are you working on?")).toBeTruthy();

    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("What's your role?")).toBeTruthy();
  });

  it("Start over resets to step 1", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("QA / Testing"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Writing Tests"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Language Agnostic"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Recommended for you")).toBeTruthy();
    fireEvent.click(screen.getByText("Start over"));
    expect(screen.getByText("What's your role?")).toBeTruthy();
  });

  // ── Results ────────────────────────────────────────────

  it("shows selection summary in results", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("New Feature"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Python / FastAPI"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText(/Backend Dev/)).toBeTruthy();
    expect(screen.getByText(/New Feature/)).toBeTruthy();
    expect(screen.getByText(/Python \/ FastAPI/)).toBeTruthy();
  });

  it("returns results for backend + feature + python", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("New Feature"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Python / FastAPI"));
    act(() => vi.advanceTimersByTime(300));

    // Should find python-backend and api-design (matching backend + python tags)
    expect(screen.getByText("Python Backend")).toBeTruthy();
    expect(screen.getByText("Api Design")).toBeTruthy();
  });

  it("separates commands from reference skills in results", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("Backend Dev"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("New Feature"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Python / FastAPI"));
    act(() => vi.advanceTimersByTime(300));

    // Commands section should exist (implement is user-invocable + matches "feature")
    expect(screen.getByText(/commands you can invoke/i)).toBeTruthy();
  });

  it("returns results even with Language Agnostic (empty tags)", () => {
    render(<SkillRecommender />);

    fireEvent.click(screen.getByText("QA / Testing"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Writing Tests"));
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText("Language Agnostic"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Recommended for you")).toBeTruthy();
    // testing-unit should match via "testing"+"unit" tags
    expect(screen.getByText("Testing Unit")).toBeTruthy();
  });

  // ── Selection Feedback ─────────────────────────────────

  it("highlights selected card before advancing", () => {
    render(<SkillRecommender />);
    const btn = screen.getByText("Backend Dev").closest("button")!;

    fireEvent.click(btn);
    // Before timer fires, card should be highlighted
    expect(btn.className).toContain("border-fd-primary");

    act(() => vi.advanceTimersByTime(300));
    // Now should have advanced to step 2
    expect(screen.getByText("What are you working on?")).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupWizard } from "@/components/setup-wizard";

// ── Mock clipboard API ──────────────────────────────────────
const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: writeTextMock },
  writable: true,
  configurable: true,
});

// ── Mock generated plugins data ─────────────────────────────
vi.mock("@/lib/generated/types", () => ({}));
vi.mock("@/lib/generated/plugins-data", () => {
  const mockPlugins = [
    {
      name: "ork",
      description: "The complete AI development toolkit",
      fullDescription: "The complete OrchestKit toolkit with all skills, agents, and hooks.",
      category: "development",
      version: "7.0.0",
      skillCount: 69,
      agentCount: 38,
      hooks: 96,
      commandCount: 17,
      color: "#06b6d4",
      required: false,
      recommended: true,
      skills: [],
      agents: [],
      commands: [],
    },
  ];

  return { PLUGINS: mockPlugins };
});

describe("SetupWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial rendering ─────────────────────────────────────

  it("renders the setup wizard", () => {
    render(<SetupWizard />);
    expect(screen.getByText("Quick presets")).toBeInTheDocument();
  });

  it("starts on Step 0 (Stack Selection)", () => {
    render(<SetupWizard />);
    expect(
      screen.getByText("What is your primary stack?"),
    ).toBeInTheDocument();
  });

  it("renders all stack options on step 0", () => {
    render(<SetupWizard />);
    // Stack option buttons have descriptions alongside labels
    expect(screen.getByText("Server-side APIs, databases, microservices")).toBeInTheDocument();
    expect(screen.getByText("React, UI, design systems")).toBeInTheDocument();
    expect(screen.getByText("Both backend and frontend")).toBeInTheDocument();
    expect(screen.getByText("FastAPI, SQLAlchemy, data science")).toBeInTheDocument();
  });

  it("renders preset buttons", () => {
    render(<SetupWizard />);
    expect(screen.getByRole("button", { name: "Minimal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Everything" }),
    ).toBeInTheDocument();
  });

  // ── Step navigation ───────────────────────────────────────

  it("navigates to step 1 when Next is clicked", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(
      screen.getByText("What is your primary focus area?"),
    ).toBeInTheDocument();
  });

  it("navigates to step 2 when Next is clicked twice", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Optional features")).toBeInTheDocument();
  });

  it("navigates back when Back is clicked", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(
      screen.getByText("What is your primary focus area?"),
    ).toBeInTheDocument();

    // Use exact "Back" text (not /back/i which also matches "Backend")
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(
      screen.getByText("What is your primary stack?"),
    ).toBeInTheDocument();
  });

  it("disables Back button on step 0", () => {
    render(<SetupWizard />);
    const backBtn = screen.getByRole("button", { name: /^back$/i });
    expect(backBtn).toBeDisabled();
  });

  it("disables Next button on step 2", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("renders step indicators that can be clicked to navigate", () => {
    render(<SetupWizard />);

    // Click step 2 directly
    const step3 = screen.getByLabelText("Step 3: Features");
    fireEvent.click(step3);

    expect(screen.getByText("Optional features")).toBeInTheDocument();
  });

  // ── Stack selection ───────────────────────────────────────

  it("selects a stack when clicked", () => {
    render(<SetupWizard />);

    const pythonBtn = screen.getByRole("button", { name: /python/i });
    fireEvent.click(pythonBtn);
    expect(pythonBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("deselects stack when clicked again", () => {
    render(<SetupWizard />);

    const pythonBtn = screen.getByRole("button", { name: /python/i });
    fireEvent.click(pythonBtn);
    expect(pythonBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pythonBtn);
    expect(pythonBtn).toHaveAttribute("aria-pressed", "false");
  });

  // ── Focus area selection ──────────────────────────────────

  it("renders focus area options on step 1", () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Backend Architecture")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineering")).toBeInTheDocument();
    expect(screen.getByText("AI / LLM")).toBeInTheDocument();
    expect(screen.getByText("Video Production")).toBeInTheDocument();
    expect(screen.getByText("Product Strategy")).toBeInTheDocument();
  });

  // ── Feature toggles ──────────────────────────────────────

  it("renders feature toggles on step 2", () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByLabelText("Toggle Memory")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle Web Research")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle MCP Integration")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Toggle Accessibility Testing"),
    ).toBeInTheDocument();
  });

  it("toggles features on/off", () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Memory is on by default
    const memoryToggle = screen.getByLabelText("Toggle Memory");
    expect(memoryToggle).toHaveAttribute("aria-checked", "true");

    // Toggle off
    fireEvent.click(memoryToggle);
    expect(memoryToggle).toHaveAttribute("aria-checked", "false");

    // Toggle back on
    fireEvent.click(memoryToggle);
    expect(memoryToggle).toHaveAttribute("aria-checked", "true");
  });

  // ── Recommendation logic ──────────────────────────────────

  it("recommends ork by default", () => {
    render(<SetupWizard />);

    // Preview panel should show ork (the single unified plugin)
    expect(screen.getByText("ork")).toBeInTheDocument();
    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
  });

  it("recommends ork regardless of stack selection", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /python/i }));

    // v7: always recommends ork (single plugin)
    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
    expect(screen.getByText(/claude install orchestkit\/ork/)).toBeInTheDocument();
  });

  it("recommends ork when AI focus is selected", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByText("AI / LLM"));

    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
  });

  it("recommends ork when Security focus is selected", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const securityBtn = screen.getByRole("button", { name: /security/i });
    fireEvent.click(securityBtn);

    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
  });

  it("shows plugin skill count in stats", () => {
    render(<SetupWizard />);

    // ork has 69 skills (rendered as plugin.skillCount)
    expect(screen.getByText("69")).toBeInTheDocument();
  });

  // ── Install command and copy ──────────────────────────────

  it("shows install command", () => {
    render(<SetupWizard />);
    expect(
      screen.getByText(/claude install orchestkit\/ork/),
    ).toBeInTheDocument();
  });

  it("copies install command on Copy click", () => {
    render(<SetupWizard />);

    const copyBtn = screen.getByLabelText(
      "Copy install command to clipboard",
    );
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      "claude install orchestkit/ork",
    );
  });

  // ── Presets ───────────────────────────────────────────────

  it("applies Backend preset", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: "Backend" }));

    // v7: all presets recommend ork (single unified plugin)
    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
  });

  it("applies AI preset and recommends ork", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: "AI" }));

    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
    expect(screen.getByText(/claude install orchestkit\/ork/)).toBeInTheDocument();
  });

  it("applies Everything preset", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: "Everything" }));

    // v7: single ork plugin for everything
    expect(screen.getByText("The complete AI development toolkit")).toBeInTheDocument();
  });

  it("shows active preset button as pressed", () => {
    render(<SetupWizard />);

    const minimalBtn = screen.getByRole("button", { name: "Minimal" });
    expect(minimalBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(minimalBtn);
    expect(minimalBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("clears active preset when a manual selection is made", () => {
    render(<SetupWizard />);

    // Apply preset
    const backendPreset = screen.getByRole("button", { name: "Backend" });
    fireEvent.click(backendPreset);
    expect(backendPreset).toHaveAttribute("aria-pressed", "true");

    // Manual stack selection should clear preset
    fireEvent.click(screen.getByRole("button", { name: /python/i }));
    expect(backendPreset).toHaveAttribute("aria-pressed", "false");
  });

  // ── Decision rationale ────────────────────────────────────

  it("shows rationale for ork recommendation", () => {
    render(<SetupWizard />);

    // v7: ork is always recommended — rationale reflects unified plugin
    expect(
      screen.getByText(/covers your needs/i),
    ).toBeInTheDocument();
  });

  it("shows Python-specific rationale when Python is selected", () => {
    render(<SetupWizard />);

    fireEvent.click(screen.getByRole("button", { name: /python/i }));

    expect(
      screen.getByText(/python stack requires specialized/i),
    ).toBeInTheDocument();
  });
});

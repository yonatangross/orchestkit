import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillFlow } from "@/components/world/skill-flow";
import { SKILL_FLOWS } from "@/lib/generated/skill-flows-data";

vi.mock("@/lib/generated/skill-flows-data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generated/skill-flows-data")>(
    "@/lib/generated/skill-flows-data",
  );
  return {
    SKILL_FLOWS: {
      ...actual.SKILL_FLOWS,
      "test-pipeline": {
        tier: "table",
        lanes: [
          {
            id: "pre",
            label: "Pre-flight",
            nodes: [{ num: "STEP 0", label: "Verify Intent", does: "Ask.", out: null, tag: null }],
          },
          {
            id: "core",
            label: "Phases",
            nodes: [
              { num: "1", label: "Gather", does: "Collect.", out: "Dataset", tag: null },
              { num: "2", label: "Render", does: "Draw.", out: "Report", tag: null },
            ],
          },
          {
            id: "emit",
            label: "Optional tails",
            nodes: [
              { num: "3", label: "Podcast", does: "Emit.", out: ".m4a", tag: "optional" },
            ],
          },
        ],
      },
      "test-map": {
        tier: "sections",
        lanes: [
          {
            id: "map",
            label: "What it covers",
            nodes: [
              { num: "", label: "Authentication", does: "", out: null, tag: null },
              { num: "", label: "PII Masking", does: "", out: null, tag: null },
              { num: "", label: "Scanning", does: "", out: null, tag: null },
            ],
          },
        ],
      },
    },
  };
});

describe("SkillFlow", () => {
  it("renders nothing for a skill with no derived flow", () => {
    const { container } = render(<SkillFlow slug="does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a pipeline as an ordered list with lane labels and outputs", () => {
    const { container } = render(<SkillFlow slug="test-pipeline" />);

    expect(screen.getByRole("heading", { name: "How it runs" })).toBeTruthy();
    expect(screen.getByText("Pre-flight")).toBeTruthy();
    expect(screen.getByText("Phases")).toBeTruthy();
    expect(screen.getByText("Gather")).toBeTruthy();
    expect(screen.getByText(/Dataset/)).toBeTruthy();
    expect(screen.getByText("optional")).toBeTruthy();

    // A pipeline is a sequence, so it must be an <ol>, and it must draw connectors.
    expect(container.querySelectorAll("ol").length).toBe(3);
    expect(container.querySelectorAll("ul").length).toBe(0);
    expect(container.textContent).toContain("→");
  });

  it("renders a capability map with no ordering and no arrows", () => {
    const { container } = render(<SkillFlow slug="test-map" />);

    expect(screen.getByRole("heading", { name: "What it covers" })).toBeTruthy();
    expect(screen.getByText("Authentication")).toBeTruthy();

    // Implying a sequence the source never had would be a lie: no <ol>, no arrows.
    expect(container.querySelectorAll("ol").length).toBe(0);
    expect(container.querySelectorAll("ul").length).toBe(1);
    expect(container.textContent).not.toContain("→");
  });

  it("does not repeat the lane label when there is only one lane", () => {
    render(<SkillFlow slug="test-map" />);
    expect(screen.getAllByText("What it covers")).toHaveLength(1);
  });
});

describe("derived SKILL_FLOWS data", () => {
  const entries = Object.entries(SKILL_FLOWS);

  it("covers the shipped skills", () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  // Regression: assess has a "| Phase | Handoff File | Contents |" lookup table
  // whose first column is a bare number. Picking that table produced nodes
  // labelled "0", "1", "2", "3" instead of the real phase names.
  it("never yields a numeric-only node label", () => {
    const offenders: string[] = [];
    for (const [slug, flow] of entries) {
      for (const lane of flow.lanes) {
        for (const node of lane.nodes) {
          if (/^[0-9.]*$/.test(node.label)) offenders.push(`${slug}:${node.label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps node labels short enough to render as chips", () => {
    const tooLong = entries.flatMap(([slug, flow]) =>
      flow.lanes.flatMap((lane) =>
        lane.nodes.filter((n) => n.label.length > 45).map((n) => `${slug}:${n.label}`),
      ),
    );
    expect(tooLong).toEqual([]);
  });

  it("only marks pipeline tiers as ordered, and only those carry outputs", () => {
    for (const [slug, flow] of entries) {
      if (flow.tier !== "sections") continue;
      const hasOutputs = flow.lanes.some((l) => l.nodes.some((n) => n.out !== null));
      expect(hasOutputs, `${slug} is a section map but carries outputs`).toBe(false);
    }
  });

  it("parses assess's real phase table, not its handoff table", () => {
    const assess = SKILL_FLOWS["assess"];
    expect(assess?.tier).toBe("table");
    const core = assess.lanes.find((l) => l.id === "core");
    expect(core?.nodes.map((n) => n.label)).toContain("Target Understanding");
  });
});

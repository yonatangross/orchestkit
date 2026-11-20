import { describe, expect, it } from "vitest";
import { slugLabel } from "@/lib/slug-label";

describe("slugLabel", () => {
  it.each([
    ["ci-cd-engineer", "CI/CD Engineer"],
    ["ai-safety-auditor", "AI Safety Auditor"],
    ["api-design", "API Design"],
    ["mcp-visual-output", "MCP Visual Output"],
    ["llm-integrator", "LLM Integrator"],
    ["ui-finish-gate", "UI Finish Gate"],
    ["testing-e2e", "Testing E2E"],
    ["json-render-catalog", "Json Render Catalog"],
    ["database-engineer", "Database Engineer"],
    ["ai", "AI"],
    ["", ""],
  ])("%s -> %s", (slug, label) => {
    expect(slugLabel(slug)).toBe(label);
  });
});

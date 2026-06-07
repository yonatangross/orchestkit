import { describe, it, expect } from "vitest";
import { createCollection } from "@/lib/orama-browser";

// ── Mock skill data (SkillEntry-like: { key, skill:{name,description,tags}, category }) ──
interface MockSkillEntry {
  key: string;
  skill: { name: string; description: string; tags: string[] };
  category: string;
  plugins: string[];
}

const MOCK_SKILLS: MockSkillEntry[] = [
  {
    key: "implement",
    skill: {
      name: "implement",
      description: "Full-power feature implementation with parallel agents",
      tags: ["development", "workflow"],
    },
    category: "development",
    plugins: ["ork"],
  },
  {
    key: "cover",
    skill: {
      name: "cover",
      description: "Generate test suites then implement coverage gaps",
      tags: ["testing", "workflow"],
    },
    category: "development",
    plugins: ["extra"],
  },
  {
    key: "fastapi-advanced",
    skill: {
      name: "fastapi-advanced",
      description: "Advanced FastAPI patterns including lifespan events",
      tags: ["backend", "fastapi", "python", "api"],
    },
    category: "backend",
    plugins: ["ork"],
  },
  {
    key: "owasp-top-10",
    skill: {
      name: "owasp-top-10",
      description: "OWASP Top 10 security vulnerabilities and mitigations",
      tags: ["security", "owasp", "vulnerability"],
    },
    category: "security",
    plugins: ["ork"],
  },
  {
    key: "e2e-testing",
    skill: {
      name: "e2e-testing",
      description: "End-to-end testing with Playwright 1.58+",
      tags: ["testing", "playwright", "e2e"],
    },
    category: "testing",
    plugins: ["ork"],
  },
];

function makeCollection() {
  return createCollection<MockSkillEntry>(MOCK_SKILLS, {
    id: (e) => e.key,
    schema: {
      name: "string",
      description: "string",
      tags: "string[]",
      category: "enum",
      // Scalar enum — the orama-browser `where` emits `{in}`, which Orama only
      // supports on scalar enum / number fields (enum[] needs `containsAny`).
      plugins: "enum",
    },
    toDoc: (e) => ({
      name: e.skill.name,
      description: e.skill.description,
      tags: e.skill.tags,
      category: e.category,
      plugins: e.plugins[0],
    }),
    boost: { name: 3, tags: 1.5, description: 1.5 },
    facetField: "category",
  });
}

function keys(items: MockSkillEntry[]): string[] {
  return items.map((i) => i.key);
}

describe("createCollection (Orama-backed skill search)", () => {
  describe("term matching", () => {
    it("matches by exact name token", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "fastapi" });
      expect(keys(items)).toContain("fastapi-advanced");
    });

    it("matches by tag token", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "owasp" });
      expect(keys(items)).toContain("owasp-top-10");
    });

    it("matches by description keyword", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "Playwright" });
      expect(keys(items)).toContain("e2e-testing");
    });

    it("is case insensitive", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "FASTAPI" });
      expect(keys(items)).toContain("fastapi-advanced");
    });

    it("tolerates a 1-char typo (implment -> implement)", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "implment" });
      expect(keys(items)).toContain("implement");
    });

    it("returns all items for empty term", async () => {
      const c = makeCollection();
      const { items } = await c.query({ term: "" });
      expect(items).toHaveLength(MOCK_SKILLS.length);
    });
  });

  describe("where filtering", () => {
    it("filters by category (enum)", async () => {
      const c = makeCollection();
      const { items } = await c.query({
        term: "",
        where: { category: "security" },
      });
      expect(keys(items)).toEqual(["owasp-top-10"]);
    });

    it("filters by membership ({in}) on a scalar enum field", async () => {
      const c = makeCollection();
      const { items } = await c.query({
        term: "",
        where: { plugins: ["extra"] },
      });
      // Only the skill carrying the "extra" plugin survives.
      expect(keys(items)).toEqual(["cover"]);
    });

    it("membership accepts multiple values (OR semantics)", async () => {
      const c = makeCollection();
      const { items } = await c.query({
        term: "",
        where: { plugins: ["ork", "extra"] },
      });
      expect(items).toHaveLength(MOCK_SKILLS.length);
    });

    it("ignores empty where arrays (no filtering)", async () => {
      const c = makeCollection();
      const { items } = await c.query({
        term: "",
        where: { category: [], plugins: [] },
      });
      expect(items).toHaveLength(MOCK_SKILLS.length);
    });

    it("combines term + where", async () => {
      const c = makeCollection();
      const { items } = await c.query({
        term: "workflow",
        where: { category: "development" },
      });
      expect(keys(items).sort()).toEqual(["cover", "implement"]);
    });
  });

  describe("facets", () => {
    it("returns native facet counts over the term-filtered set", async () => {
      const c = makeCollection();
      const { facets } = await c.query({ term: "" });
      const byValue = Object.fromEntries(
        facets.map((f) => [f.value, f.count]),
      );
      expect(byValue.development).toBe(2);
      expect(byValue.backend).toBe(1);
      expect(byValue.security).toBe(1);
      expect(byValue.testing).toBe(1);
    });
  });

  describe("suggestions (did you mean?)", () => {
    it("populates suggestions on a near-miss with no exact hit", async () => {
      const c = makeCollection();
      // 'implmnt' is edit-distance 2 from 'implement' — beyond the strict
      // tolerance (1) so items is empty, but within the relaxed tolerance (2).
      const { items, suggestions } = await c.query({ term: "implmnt" });
      expect(items).toHaveLength(0);
      expect(keys(suggestions)).toContain("implement");
    });

    it("has no suggestions when there is an exact hit", async () => {
      const c = makeCollection();
      const { items, suggestions } = await c.query({ term: "fastapi" });
      expect(items.length).toBeGreaterThan(0);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe("ranking", () => {
    it("ranks a name match above a description-only match", async () => {
      const c = makeCollection();
      // 'implement' is the name of one skill and appears only in the
      // description of 'cover'. The name match (boost 3) must rank first.
      const { items } = await c.query({ term: "implement" });
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].key).toBe("implement");
    });
  });
});

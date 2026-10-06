import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentCard, cardKind, clip, skillCard, verdictOf } from "@/lib/og-card-data";

// The link cards must show only what the page itself says. These tests read
// real reference pages, so a generator change that moves the example or the
// tool list breaks here instead of shipping an empty or invented panel.
const page = (rel: string) => {
	const raw = readFileSync(join(__dirname, "..", "content/docs/reference", rel), "utf-8");
	const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	const description = fm?.[1].match(/^description:\s*"(.*)"\s*$/m)?.[1] ?? "";
	return { description, body: fm ? raw.slice(fm[0].length) : raw };
};

describe("cardKind", () => {
	it("routes reference skill and agent pages, everything else is a doc card", () => {
		expect(cardKind(["reference", "skills", "glyph"])).toBe("skill");
		expect(cardKind(["reference", "agents", "backend-system-architect"])).toBe("agent");
		expect(cardKind(["reference", "skills"])).toBe("doc");
		expect(cardKind(["getting-started"])).toBe("doc");
		expect(cardKind(undefined)).toBe("doc");
	});
});

describe("skillCard", () => {
	it("takes the glyph example render from the page, not an invented one", () => {
		const { description, body } = page("skills/glyph.mdx");
		const d = skillCard(description, body);
		expect(d.sampleIsInvoke).toBe(false);
		expect(d.sample.length).toBeGreaterThan(3);
		expect(d.sample.length).toBeLessThanOrEqual(14);
		// every sample line is a (possibly cut) line of the page body
		for (const line of d.sample) expect(body.includes(line)).toBe(true);
		expect(d.uses.length).toBeGreaterThan(0);
	});

	it("falls back to the invoke command when a page has no fenced example", () => {
		const body = '```bash title="Invoke"\n/ork:demo\n```\n\n## Examples\n\nJust prose here.\n';
		const d = skillCard("Demo skill. Use for a, b.", body);
		expect(d.sampleIsInvoke).toBe(true);
		expect(d.sample).toEqual(["/ork:demo"]);
	});
});

describe("agentCard", () => {
	it("lists real tools and the Agent(...) delegations", () => {
		const { description, body } = page("agents/backend-system-architect.mdx");
		const d = agentCard(description, body);
		expect(d.delegates).toEqual(["database-engineer", "test-generator"]);
		expect(d.tools).toContain("Read");
		expect(d.tools.some((t) => t.startsWith("Agent(") || t.startsWith("mcp__"))).toBe(false);
	});

	it("says nothing is delegated when the page lists no Agent(...) tool", () => {
		const d = agentCard("Solo: does one thing.", "## Tools Available\n\n- `Read`\n- `Bash`\n");
		expect(d.delegates).toEqual([]);
		expect(d.tools).toEqual(["Read", "Bash"]);
	});
});

describe("text helpers", () => {
	it("clips at a word boundary", () => {
		expect(clip("one two three four", 12)).toBe("one two...");
	});
	it("shortens a long first sentence at its colon", () => {
		const v = verdictOf("Render an answer as ASCII art plus semantic emojis inline with no setup questions: one render per reply, verdict first. More.");
		expect(v).toBe("Render an answer as ASCII art plus semantic emojis inline with no setup questions");
	});
});

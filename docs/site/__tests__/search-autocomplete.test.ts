import { describe, it, expect } from "vitest";
import GithubSlugger from "github-slugger";
import { SEARCH_SUGGEST_INDEX } from "@/lib/generated/search-suggest-index";
import {
	anchorFor,
	suggestCompletions,
	type SuggestEntry,
} from "@/lib/search-autocomplete";

const ENTRIES: SuggestEntry[] = [
	{ url: "/docs/hooks", title: "Hooks", headings: ["Overview", "Events"] },
	{
		url: "/docs/hooks/overview",
		title: "Hooks Overview",
		headings: ["Lifecycle", "Hook phases"],
	},
	{
		url: "/docs/reference/hooks/pre-tool-use",
		title: "Pre Tool Use",
		headings: ["Configuration", "Blocking decisions"],
	},
	{
		url: "/docs/agents/overview",
		title: "Agents Overview",
		headings: ["Activation", "Keywords"],
	},
	{
		url: "/docs/getting-started/installation",
		title: "Installation",
		headings: ["Requirements", "Hook it up"],
	},
];

describe("suggestCompletions", () => {
	it("returns nothing under 2 characters", () => {
		expect(suggestCompletions("h", ENTRIES)).toEqual([]);
		expect(suggestCompletions("", ENTRIES)).toEqual([]);
		expect(suggestCompletions("  ", ENTRIES)).toEqual([]);
	});

	it("ranks whole-string title prefixes first", () => {
		const out = suggestCompletions("hooks", ENTRIES);
		expect(out[0].url).toBe("/docs/hooks");
		expect(out[0].via).toBe("title");
	});

	it("suggests heading matches with anchor urls and breadcrumb label", () => {
		const out = suggestCompletions("lifecycle", ENTRIES);
		expect(out).toHaveLength(1);
		expect(out[0].url).toBe("/docs/hooks/overview#lifecycle");
		expect(out[0].via).toBe("heading");
		expect(out[0].label).toBe("Hooks Overview > Lifecycle");
	});

	it("matches multi-token queries by per-word prefix coverage", () => {
		const out = suggestCompletions("hook over", ENTRIES);
		expect(out[0].url).toBe("/docs/hooks/overview");
		expect(out[0].via).toBe("title");
	});

	it("tolerates a 1-edit typo on queries of 4+ chars", () => {
		const out = suggestCompletions("agenst", ENTRIES); // "agents" + transposition
		expect(out[0].url).toBe("/docs/agents/overview");
	});

	it("does not fuzzy-match short queries", () => {
		expect(suggestCompletions("agn", ENTRIES)).toEqual([]);
	});

	it("is deterministic across runs and respects max", () => {
		const a = suggestCompletions("hook", ENTRIES, 2);
		const b = suggestCompletions("hook", ENTRIES, 2);
		expect(a).toEqual(b);
		expect(a.length).toBeLessThanOrEqual(2);
	});

	it("matches tokens inside headings, not just title words", () => {
		// "blocking decisions" only exists as a heading on pre-tool-use.
		const out = suggestCompletions("blocking", ENTRIES);
		expect(out[0].url).toBe("/docs/reference/hooks/pre-tool-use#blocking-decisions");
	});
});

describe("anchorFor", () => {
	it.each(["Bulk Entity Deletion (mcp__memory__delete_entities)", "Café & 東京", "foo.bar / baz", "Hello  world"])("matches heading ids for %s", (heading) => {
		expect(anchorFor(heading)).toBe(new GithubSlugger().slug(heading));
	});

	it("links a real docs heading to its rendered id", () => {
		const page = SEARCH_SUGGEST_INDEX.find((entry) => entry.url === "/docs/hooks/overview")!;
		const heading = "SubagentStart / SubagentStop";
		expect(page.headings).toContain(heading);
		expect(suggestCompletions("subagentstart", [page])[0].url).toBe(`${page.url}#subagentstart--subagentstop`);
	});

	it("preserves inline code in the autocomplete index and heading href", () => {
		const page = SEARCH_SUGGEST_INDEX.find((entry) => entry.url === "/docs/hooks/spotlights/memory-validator")!;
		expect(page.headings).toContain("Bulk Entity Deletion (mcp__memory__delete_entities)");
		expect(suggestCompletions("bulk entity", [page])[0].url).toBe(`${page.url}#bulk-entity-deletion-mcp__memory__delete_entities`);
	});

	it("deduplicates preceding heading slugs independently per call", () => {
		const page = { url: "/docs/example", title: "Example", headings: ["Repeat", "Repeat!", "Repeat?"] };
		expect(suggestCompletions("repeat?", [page])[0].url).toBe("/docs/example#repeat-2");
		expect(suggestCompletions("repeat!", [page])[0].url).toBe("/docs/example#repeat-1");
		expect(suggestCompletions("repeat?", [page])[0].url).toBe("/docs/example#repeat-2");
	});
	it("slugifies like github-slugger", () => {
		expect(anchorFor("Blocking decisions")).toBe("blocking-decisions");
		expect(anchorFor("What's new?")).toBe("whats-new");
	});
});

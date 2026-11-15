// SEO PR-G (oc20 ruling, 15.11.2026): the five surfaces PR-F left still called
// OrchestKit "a free, open-source plugin for Claude Code". The repo ships for
// eight hosts (lib/host-installs.ts, lib/host-support.ts); each surface now
// names Claude Code, Cursor and Codex and no longer says Claude Code only.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { YONYON } from "@/lib/constants";

const OLD = "open-source plugin for Claude Code";
const src = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

function crossHarness(text: string, where: string) {
	expect(text, where).not.toContain(OLD);
	for (const name of ["Claude Code", "Cursor", "Codex"]) expect(text, `${where}: ${name}`).toContain(name);
}

describe("PR-G: no surface says Claude Code only", () => {
	it("agent card description", async () => {
		const { GET } = await import("@/app/api/well-known/agent-card/route");
		const card = await GET().json();
		crossHarness(card.description, "agent-card");
	});

	it("about page description and lead", async () => {
		const { metadata } = await import("@/app/(home)/about/page");
		crossHarness(String(metadata.description), "about description");
		const page = src("app", "(home)", "about", "page.tsx");
		expect(page).not.toContain(OLD);
		expect(page).toMatch(/lead=\{`[^`]*PRODUCT_LINE/);
	});

	it("Yonyon description in constants", () => {
		crossHarness(YONYON.description, "YONYON.description");
	});

	it("llms-full.txt header and the Yonyon Markdown lead", () => {
		for (const f of [["app", "llms-full.txt", "route.ts"], ["lib", "page-markdown.ts"]]) {
			const t = src(...f);
			expect(t, f.join("/")).not.toContain(OLD);
			expect(t, f.join("/")).toContain("PRODUCT_LINE");
		}
	});

	it("PRODUCT_LINE names the hosts and the hooks scope", async () => {
		const { PRODUCT_LINE } = await import("@/lib/host-support");
		crossHarness(PRODUCT_LINE, "PRODUCT_LINE");
	});
});

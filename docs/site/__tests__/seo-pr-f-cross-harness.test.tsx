// SEO PR-F (oc20 brief, 15.11.2026): say honestly what OrchestKit does on each
// agent host. The AEO probe found 0 of 12 answers naming OrchestKit, and
// /llms.txt said "Not a standalone CLI or editor; it extends the Claude Code
// agent." although the repo ships for eight hosts (lib/host-installs.ts).
// Facts come from HOST_SUPPORT, which is checked against HOST_INSTALLS here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { HOST_INSTALLS } from "@/lib/host-installs";

vi.mock("@/lib/docs-content", () => ({ SECTION_ORDER: [], orderedPages: () => [] }));

const HOOKS_ONLY = "Hooks run on Claude Code only";
const count = (s: string, sub: string) => s.split(sub).length - 1;

async function llms(): Promise<string> {
	const { GET } = await import("@/app/llms.txt/route");
	return GET().text();
}

describe("host support table", () => {
	it("covers every host in HOST_INSTALLS, with its install command", async () => {
		const { HOST_SUPPORT } = await import("@/lib/host-support");
		expect(HOST_SUPPORT.map((h) => h.id)).toEqual(HOST_INSTALLS.map((h) => h.id));
		for (const h of HOST_SUPPORT) {
			const spec = HOST_INSTALLS.find((s) => s.id === h.id);
			expect(h.install, h.id).toBe(spec?.copy ?? spec?.commands.join(" && "));
		}
	});
	it("claims hooks for Claude Code only", async () => {
		const { HOST_SUPPORT } = await import("@/lib/host-support");
		expect(HOST_SUPPORT.filter((h) => h.hooks).map((h) => h.id)).toEqual(["claude"]);
	});
});

describe("llms.txt says what works where", () => {
	it("drops the Claude-Code-only claims", async () => {
		const t = await llms();
		expect(t).not.toContain("Not a standalone CLI or editor");
		expect(t).not.toContain("plugin for Claude Code (Anthropic's agentic CLI)");
	});
	it("names every host and its install, and states the hooks limit once", async () => {
		const t = await llms();
		expect(t).toContain("## Where it runs");
		for (const h of HOST_INSTALLS) {
			expect(t, h.name).toContain(h.name);
		}
		expect(t).toContain("codex plugin add ork-codex@orchestkit-codex");
		expect(count(t, HOOKS_ONLY)).toBe(1);
	});
	it("keeps the counts", async () => {
		const t = await llms();
		const { COUNTS } = await import("@/lib/constants");
		expect(t).toContain(`${COUNTS.skills} skills`);
		expect(t).toContain(`${COUNTS.agents} agents`);
		expect(t).toContain(`${COUNTS.hooks} hooks`);
	});
});

describe("home answer-first section", () => {
	it("asks the probe question as an H2 and answers in the next paragraph", async () => {
		const { HostAnswer } = await import("@/components/host-answer");
		const { container } = render(<HostAnswer />);
		const h2 = container.querySelector("h2");
		expect(h2?.textContent).toBe("Which skill and agent pack works across Claude Code, Codex and Cursor?");
		const first = container.querySelector("h2 + p")?.textContent ?? "";
		const words = first.trim().split(/\s+/).length;
		expect(words).toBeGreaterThanOrEqual(25);
		expect(words).toBeLessThanOrEqual(70);
		for (const name of ["Claude Code", "Codex", "Cursor"]) expect(first).toContain(name);
		expect(count(container.textContent ?? "", HOOKS_ONLY)).toBe(1);
		expect(container.textContent).not.toMatch(/\bbest\b/i);
		expect(container.querySelector("details, [hidden]")).toBeNull();
	});
	it("is on the home page, and the 'What is OrchestKit?' lede names the hosts", () => {
		const page = readFileSync(join(process.cwd(), "app", "(home)", "page.tsx"), "utf8");
		expect(page).toMatch(/<HostAnswer\s*\/>/);
		const what = page.slice(page.indexOf('id="what-heading"'), page.indexOf("</section>", page.indexOf('id="what-heading"')));
		expect(what).toContain("Cursor");
		expect(what).toContain("Codex");
		expect(what).not.toContain("plugin for{\" \"}");
	});
});

describe("home FAQ answers match the host table", () => {
	it("the Cursor comparison answer says Cursor is a host", async () => {
		const { HOME_FAQS } = await import("@/components/structured-data");
		const f = HOME_FAQS.find((q) => q.question.includes("Cursor"));
		expect(f).toBeTruthy();
		expect(f?.answer).not.toContain("built specifically for the Claude Code agent");
		expect(f?.answer).toContain("Cursor loads the same ork plugin");
		expect(f?.answer).toContain("GitHub Copilot is not one of its hosts");
	});
	it("the What is OrchestKit answer names Claude Code, Cursor and Codex", async () => {
		const { HOME_FAQS } = await import("@/components/structured-data");
		const a = HOME_FAQS.find((q) => q.question === "What is OrchestKit?")?.answer ?? "";
		for (const name of ["Claude Code", "Cursor", "Codex"]) expect(a).toContain(name);
		expect(a).not.toContain("plugin for Claude Code.");
	});
});

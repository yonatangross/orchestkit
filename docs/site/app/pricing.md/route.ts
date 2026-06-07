import { COUNTS, SITE } from "@/lib/constants";

// /pricing.md — machine-readable pricing so agents can compare costs without
// scraping the HTML pricing page.
export const revalidate = false;

export function GET() {
	const body = [
		`# ${SITE.name} Pricing`,
		"",
		"> OrchestKit is free and open source under the MIT license. No paid tiers, no usage limits, no account required.",
		"",
		"## Plans",
		"",
		"| Plan | Price | Includes | Limits |",
		"| --- | --- | --- | --- |",
		`| OrchestKit (MIT) | $0 | All ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks | None |`,
		"",
		"## Notes",
		"",
		"- There is no premium tier and no seat licensing. The single open-source package contains every capability.",
		"- OrchestKit runs locally inside Claude Code; you own and run everything.",
		`- You separately need Claude Code and an Anthropic account to run the underlying agent (billed by Anthropic, independent of OrchestKit). Install OrchestKit with \`${SITE.installCommand}\`.`,
		"",
		`License: MIT. Source: ${SITE.github}`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

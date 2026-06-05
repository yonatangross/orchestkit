import { SITE } from "@/lib/constants";

// Custom robots.txt route (replaces the app/robots.ts metadata convention, which
// cannot emit arbitrary directives). Adds Content-Signal directives per
// https://contentsignals.org/ — permissive stance: OrchestKit is an open-source
// project that wants agents to discover, search, and learn from its docs.
export const revalidate = false;

export function GET() {
	const body = [
		"User-agent: *",
		"Allow: /",
		"",
		"# Content Signals — https://contentsignals.org/",
		"Content-Signal: ai-train=yes, search=yes, ai-input=yes",
		"",
		`Sitemap: ${SITE.domain}/sitemap.xml`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

import { apiPolicyMarkdown } from "@/lib/api-policy";

// /api-policy.md, the Markdown twin of /api-policy. Both render the SAME
// structure from lib/api-policy.ts, so the crawlable HTML page and the
// agent-readable document can never state different guarantees. Referenced from
// /llms.txt and advertised on every response via
// `Link: </api-policy.md>; rel="deprecation"`. No auth, see /auth.md.
export const revalidate = false;

export function GET() {
	return new Response(apiPolicyMarkdown(), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

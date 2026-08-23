import {
	API_POLICY_LEAD,
	API_POLICY_TITLE,
	apiPolicyMarkdown,
} from "@/lib/api-policy";
import { SITE } from "@/lib/constants";
import { withFrontmatter } from "@/lib/md-frontmatter";

// /api-policy.md, the Markdown twin of /api-policy. Both render the SAME
// structure from lib/api-policy.ts, so the crawlable HTML page and the
// agent-readable document can never state different guarantees. Referenced from
// /llms.txt and advertised on every response via
// `Link: </api-policy.md>; rel="deprecation"`. No auth, see /auth.md.
export const revalidate = false;

export function GET() {
	// Title and lead come from lib/api-policy.ts, the same two constants the HTML
	// page at /api-policy renders as its heading, its lead paragraph and its
	// schema.org headline, and that apiPolicyMarkdown() already renders as the
	// H1 and blockquote below. Nothing is restated here, so nothing can drift.
	const md = withFrontmatter(
		{
			title: API_POLICY_TITLE,
			description: API_POLICY_LEAD,
			canonical: `${SITE.domain}/api-policy`,
		},
		apiPolicyMarkdown(),
	);

	return new Response(md, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

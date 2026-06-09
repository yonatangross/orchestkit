import { buildLlmsTxt } from "@/lib/llms-txt";

// /api/llms.txt — section-scoped llms.txt for the API surface. Lets an agent
// fetch focused context about the programmatic endpoints without pulling the
// whole manual (/llms.txt). A static route segment takes precedence over the
// app/api/[...path] catch-all. The content generator lives in lib/llms-txt so
// the Markdown twin (/api/llms.txt.md) can share it — Next.js route modules may
// only export request handlers + reserved config, not arbitrary helpers.
export const revalidate = false;

export function GET() {
	const body = buildLlmsTxt();

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

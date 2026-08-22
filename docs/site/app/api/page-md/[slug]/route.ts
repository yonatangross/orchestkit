import { hasMarkdownTwin, pageMarkdown } from "@/lib/page-markdown";
import { problemResponse } from "@/lib/problem";
import { SITE } from "@/lib/constants";
import { notFoundExtensions } from "@/lib/not-found-body";

// Markdown twins for named non-/docs pages. Reached only via middleware, which
// rewrites /<slug>.md (and Accept: text/markdown on /<slug>) here for the slugs
// in MARKDOWN_TWIN_SLUGS. Kept as a route rather than a static .md file so the
// body renders from the same data as the HTML page on every build.
export const dynamic = "force-static";

export function generateStaticParams() {
	return [{ slug: "developers" }, { slug: "yonyon" }];
}

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	if (!hasMarkdownTwin(slug)) {
		// Defensive: middleware only rewrites known slugs, so this is unreachable
		// through the public URL space. Answering with the same structured 404 the
		// rest of the origin uses keeps the contract identical if that ever changes.
		return problemResponse(
			{
				type: `${SITE.domain}/api-policy`,
				title: "Resource not found",
				status: 404,
				detail: `No Markdown twin for "${slug}".`,
				instance: `/${slug}.md`,
			},
			{},
			notFoundExtensions(SITE.domain),
		);
	}
	return new Response(pageMarkdown(slug), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

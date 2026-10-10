import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { readDocBody } from "@/lib/docs-content";
import { CARD, agentCardElement, docCardElement, skillCardElement } from "@/lib/og-card";
import { agentCard, cardKind, skillCard } from "@/lib/og-card-data";
import { source } from "@/lib/source";

// Per-page link card. Skill pages show the skill's own example output, agent
// pages show their tools and the agents they delegate to, other pages show the
// title and description. Layout: ./approved-design/mockup.txt beside this route.
// The .mdx bodies and the fonts reach the function through
// outputFileTracingIncludes in next.config.mjs.

// Crawlers (X, LinkedIn, Slack) fetch the card once per share; a CDN copy makes
// the first fetch fast. A card only changes when its page changes, which ships
// with a deploy, so a day at the edge plus a week of stale-while-revalidate is safe.
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const font = (name: string) => readFile(join(process.cwd(), "assets", "og", name));

export async function GET(_req: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	const title = page?.data.title ?? "Documentation";
	const description = page?.data.description ?? "";
	const kind = page ? cardKind(params.slug) : "doc";
	const name = params.slug?.[2] ?? "";

	const [bold, medium, mono, body] = await Promise.all([
		font("Geist-Bold.ttf"),
		font("Geist-Medium.ttf"),
		font("GeistMono-Regular.ttf"),
		kind === "doc" || !page ? Promise.resolve(null) : readDocBody(page.slugs),
	]);

	const element =
		kind === "skill"
			? skillCardElement(title, `ork:${name}`, skillCard(description, body ?? ""))
			: kind === "agent"
				? agentCardElement(title, `ork:${name}`, agentCard(description, body ?? ""))
				: docCardElement(title, description);

	return new ImageResponse(element, {
		...CARD,
		emoji: "twemoji",
		fonts: [
			{ name: "Geist", data: bold, weight: 700, style: "normal" },
			{ name: "Geist", data: medium, weight: 500, style: "normal" },
			{ name: "Geist Mono", data: mono, weight: 400, style: "normal" },
		],
		headers: { "Cache-Control": CACHE },
	});
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import {
	breadcrumbNode,
	faqPageNode,
	organizationNode,
	softwareApplicationNode,
	StructuredData,
	yonyonOrganizationNode,
} from "@/components/structured-data";
import { COUNTS, SITE, YONYON } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Yonyon — the studio behind OrchestKit",
	description:
		"Yonyon is the independent software studio that builds and publishes OrchestKit, the curated skills/agents/hooks toolkit for Claude Code. Not the musician — the developer-tooling studio.",
	alternates: { canonical: `${SITE.domain}/yonyon` },
};

// Disambiguation-first FAQ. The first entry directly answers the name-collision
// query an agent or search engine forms from the apex domain "yonyon"; the rest
// route a "yonyon"-keyed visitor straight to OrchestKit's named dev resources.
const YONYON_FAQS = [
	{
		question: "Is Yonyon (OrchestKit) related to the musician of the same name?",
		answer:
			"No. On this site, Yonyon is an independent software studio — the publisher of OrchestKit, a free, open-source plugin for Claude Code. It is not affiliated with, and should not be confused with, the DJ/music producer who also uses the name Yonyon.",
	},
	{
		question: "What does Yonyon make?",
		answer: `Yonyon builds developer tooling for AI-assisted engineering. Its flagship product is OrchestKit — ${COUNTS.skills} skills, ${COUNTS.agents} agents, and ${COUNTS.hooks} lifecycle hooks for Claude Code, MIT-licensed and free.`,
	},
	{
		question: "Where are Yonyon's developer resources?",
		answer:
			"All of OrchestKit's developer resources live under orchestkit.yonyon.ai: the docs, a read-only OpenAPI spec at /api/openapi, an MCP server at /api/mcp, a natural-language /ask endpoint, llms.txt and llms-full.txt, and well-known agent/API discovery files. Source is on GitHub at github.com/yonatangross/orchestkit.",
	},
];

export default function YonyonPage() {
	return (
		<ContentPage
			title="Yonyon"
			path="/yonyon"
			lead="Yonyon is the independent software studio behind OrchestKit. This page exists to resolve the brand: when you search for “yonyon” in a developer context, this is the studio and the product you’re looking for."
		>
			<StructuredData
				nodes={[
					yonyonOrganizationNode(),
					organizationNode(),
					softwareApplicationNode(),
					faqPageNode(YONYON_FAQS),
					breadcrumbNode([
						{ name: SITE.name, url: SITE.domain },
						{ name: "Yonyon", url: YONYON.url },
					]),
				]}
			/>

			<h2>The studio</h2>
			<p>
				Yonyon is an independent software studio building developer tooling for
				AI-assisted engineering. It is the publisher of{" "}
				<Link href="/">OrchestKit</Link>, a free, open-source plugin for{" "}
				<a href="https://www.anthropic.com/claude-code">Claude Code</a>. The
				studio is run by{" "}
				<a href="https://github.com/yonatangross">Yonatan Gross</a>, and its work
				is published at <strong>orchestkit.yonyon.ai</strong>.
			</p>

			<h2>Not the musician</h2>
			<p>
				The name “Yonyon” collides with an unrelated DJ and music producer. To be
				explicit:{" "}
				<strong>
					this Yonyon is a software studio, the publisher of OrchestKit
				</strong>
				. If you arrived here looking for music, this isn’t it; if you arrived
				looking for the Claude Code toolkit, you’re in the right place.
			</p>

			<h2>The product: OrchestKit</h2>
			<p>
				OrchestKit bundles {COUNTS.skills} skills, {COUNTS.agents} agents, and{" "}
				{COUNTS.hooks} lifecycle hooks into one MIT-licensed package — encoding
				auth, migration, API, and testing patterns with security and quality
				gates on by default. It installs in one step with{" "}
				<code>{SITE.installCommand}</code> inside Claude Code {SITE.ccVersion}.
			</p>

			<h2>Developer resources</h2>
			<p>Everything is published at predictable, named URLs:</p>
			<ul>
				<li>
					<Link href="/docs">Documentation</Link> — guides, cookbook, and a full
					component reference.
				</li>
				<li>
					<Link href="/developers">Developer resource hub</Link> — the index of
					machine-readable surfaces.
				</li>
				<li>
					<a href="/api/openapi">OpenAPI spec</a> — read-only API over the docs.
				</li>
				<li>
					<a href="/api/mcp">MCP server</a> — connect agents over Streamable
					HTTP; see the{" "}
					<a href="/.well-known/mcp/server-card.json">server card</a>.
				</li>
				<li>
					<a href="/ask">/ask</a> — natural-language query endpoint (NLWeb).
				</li>
				<li>
					<a href="/llms.txt">llms.txt</a> ·{" "}
					<a href="/llms-full.txt">llms-full.txt</a> — agent-readable site index.
				</li>
				<li>
					<a href="https://github.com/yonatangross/orchestkit">GitHub</a> — source,
					issues, and releases.
				</li>
			</ul>

			<h2>Frequently asked questions</h2>
			{YONYON_FAQS.map((f) => (
				<div key={f.question}>
					<h3>{f.question}</h3>
					<p>{f.answer}</p>
				</div>
			))}

			<h2>Start here</h2>
			<p>
				New to the project? Read{" "}
				<Link href="/docs">the documentation</Link> or compare it with the{" "}
				<Link href="/alternatives">alternatives</Link>.
			</p>
		</ContentPage>
	);
}

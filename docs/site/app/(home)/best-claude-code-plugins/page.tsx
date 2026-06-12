import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { COUNTS, SITE } from "@/lib/constants";
import {
	StructuredData,
	organizationNode,
	personNode,
	techArticleNode,
	breadcrumbNode,
} from "@/components/structured-data";

// Honest category roundup — every entry verified live (June 2026), star counts
// approximate at time of writing. We maintain OrchestKit and say so up top;
// competitors get real links and their own README's framing.
export const metadata: Metadata = {
	title: "Best Claude Code plugins and marketplaces (2026)",
	description:
		"An honest roundup of Claude Code plugins and plugin marketplaces — Anthropic's official catalogs, the biggest community marketplaces, and where OrchestKit fits. Maintainer-disclosed.",
	alternates: { canonical: `${SITE.domain}/best-claude-code-plugins` },
};

type Entry = {
	name: string;
	url: string;
	by: string;
	what: string;
	signal: string;
};

const OFFICIAL: Entry[] = [
	{
		name: "claude-plugins-official",
		url: "https://github.com/anthropics/claude-plugins-official",
		by: "Anthropic",
		what: "The vetted official plugin catalog, auto-registered in Claude Code at startup — the de facto default marketplace.",
		signal: "~30k stars · Apache-2.0",
	},
	{
		name: "anthropics/skills",
		url: "https://github.com/anthropics/skills",
		by: "Anthropic",
		what: "Reference open-source skills and the home of the SKILL.md standard (since adopted by OpenAI Codex). More a standards repo than a catalog, but the root of the ecosystem.",
		signal: "~149k stars",
	},
	{
		name: "knowledge-work-plugins",
		url: "https://github.com/anthropics/knowledge-work-plugins",
		by: "Anthropic",
		what: "Role-oriented plugins for non-engineering knowledge work — sales, legal, finance, and similar.",
		signal: "~20k stars",
	},
	{
		name: "claude-plugins-community",
		url: "https://github.com/anthropics/claude-plugins-community",
		by: "Anthropic (community-reviewed)",
		what: "Community submissions mirrored after review.",
		signal: "newer, smaller",
	},
];

const COMMUNITY: Entry[] = [
	{
		name: "OrchestKit (this site)",
		url: "https://github.com/yonatangross/orchestkit",
		by: "Yonyon — that's us; see disclosure above",
		what: `${COUNTS.skills} skills, ${COUNTS.agents} specialist agents, and ${COUNTS.hooks} lifecycle hooks in one plugin: parallel-agent feature implementation and PR review, fail-closed security hooks, persistent memory, and a docs MCP server (hosted + Docker).`,
		signal: "MIT · no account, no hosted service",
	},
	{
		name: "claude-skills",
		url: "https://github.com/alirezarezvani/claude-skills",
		by: "alirezarezvani",
		what: "The most prolific community marketplace by skill count — 338 skills and 13 agents across many domains.",
		signal: "~18k stars · MIT",
	},
	{
		name: "claude-code-skills",
		url: "https://github.com/daymade/claude-code-skills",
		by: "daymade",
		what: "A curated set of ~61 deeper, narrower skills — quality-over-quantity philosophy.",
		signal: "~1.2k stars · MIT",
	},
	{
		name: "awesome-claude-plugins",
		url: "https://github.com/ComposioHQ/awesome-claude-plugins",
		by: "ComposioHQ",
		what: "40+ plugins including a connector plugin that bridges to ~500 external apps.",
		signal: "~1.7k stars",
	},
	{
		name: "claude-code-marketplace",
		url: "https://github.com/netresearch/claude-code-marketplace",
		by: "netresearch",
		what: "Enterprise-flavored marketplace with a TYPO3/PHP focus.",
		signal: "MIT",
	},
	{
		name: "claudecode-marketplace",
		url: "https://github.com/henkisdabro/claudecode-marketplace",
		by: "henkisdabro",
		what: "An opinionated pack oriented at Shopify, go-to-market, and LSP workflows.",
		signal: "smaller, focused",
	},
];

function EntryList({ entries }: { entries: Entry[] }) {
	return (
		<ul>
			{entries.map((e) => (
				<li key={e.url}>
					<a href={e.url} target="_blank" rel="noopener noreferrer">
						{e.name}
					</a>{" "}
					<em>({e.by})</em> — {e.what} <span>[{e.signal}]</span>
				</li>
			))}
		</ul>
	);
}

export default function BestPluginsPage() {
	return (
		<ContentPage
			title="Best Claude Code plugins and marketplaces (2026)"
			path="/best-claude-code-plugins"
			lead="The Claude Code plugin ecosystem, honestly surveyed: Anthropic's official catalogs, the biggest community marketplaces, and where our own plugin fits."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "Best Claude Code plugins and marketplaces (2026)",
						description: "An honest roundup of Claude Code plugins and plugin marketplaces — Anthropic's official catalogs, the biggest community marketplaces, and where OrchestKit fits. Maintainer-disclosed.",
						path: "/best-claude-code-plugins",
						datePublished: "2026-06-11",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "Best Claude Code Plugins", url: `${SITE.domain}/best-claude-code-plugins` },
					]),
				]}
			/>
			<p>
				<strong>Disclosure:</strong> this page lives on the {SITE.name} docs
				site and we maintain {SITE.name}, one of the entries below. Every other
				entry links to its own repository, was verified live in June 2026, and
				is described in its own README&apos;s terms. Star counts are
				approximate. If we got something wrong,{" "}
				<Link href="/contact">tell us and we will fix it</Link>.
			</p>
			<h2>Official (Anthropic)</h2>
			<EntryList entries={OFFICIAL} />
			<h2>Community plugins and marketplaces</h2>
			<EntryList entries={COMMUNITY} />
			<h2>Discovery and leaderboards</h2>
			<p>
				<a href="https://skills.sh" target="_blank" rel="noopener noreferrer">
					skills.sh
				</a>{" "}
				indexes skills across agents (Claude Code and OpenAI Codex both speak
				the SKILL.md standard) with real install counts —{" "}
				<a
					href="https://www.skills.sh/yonatangross/orchestkit"
					target="_blank"
					rel="noopener noreferrer"
				>
					{SITE.name}&apos;s listing is here
				</a>
				. The community list{" "}
				<a
					href="https://github.com/hesreallyhim/awesome-claude-code"
					target="_blank"
					rel="noopener noreferrer"
				>
					awesome-claude-code
				</a>{" "}
				tracks the wider tooling ecosystem beyond plugins.
			</p>
			<h2>How to choose</h2>
			<ul>
				<li>
					<strong>Start official</strong>: the auto-registered official catalog
					is zero-risk and covers common needs.
				</li>
				<li>
					<strong>Engineering depth</strong>: pick a plugin that encodes
					practices, not just prompts — look for hooks (enforcement that runs
					on every tool call) and tests in the plugin&apos;s own CI. This is{" "}
					{SITE.name}&apos;s lane ({COUNTS.hooks} hooks, security suite gating
					every release) — see{" "}
					<Link href="/compare">the detailed comparison</Link>.
				</li>
				<li>
					<strong>Breadth of integrations</strong>: ComposioHQ&apos;s connector
					approach reaches the most external apps.
				</li>
				<li>
					<strong>Building your own agent product instead?</strong> You want
					the SDK layer, not a plugin —{" "}
					<Link href="/claude-agent-sdk-vs-claude-code-plugins">
						Claude Agent SDK vs plugins, explained
					</Link>
					.
				</li>
			</ul>
		</ContentPage>
	);
}

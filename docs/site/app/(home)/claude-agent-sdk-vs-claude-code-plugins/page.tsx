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

// Category explainer targeting "claude agent sdk vs claude code plugins" — the
// two are different layers, not competitors; this page says so honestly and
// shows where OrchestKit (a plugin) sits.
export const metadata: Metadata = {
	title: "Claude Agent SDK vs Claude Code plugins — when you need which",
	description:
		"The Claude Agent SDK is a programmatic layer for building your own agents; Claude Code plugins extend Anthropic's coding CLI. They are complementary layers, not competitors. Here is how to choose.",
	alternates: {
		canonical: `${SITE.domain}/claude-agent-sdk-vs-claude-code-plugins`,
	},
};

export default function SdkVsPluginsPage() {
	return (
		<ContentPage
			title="Claude Agent SDK vs Claude Code plugins"
			path="/claude-agent-sdk-vs-claude-code-plugins"
			lead="They are not competitors — they are different layers of the same stack. The Agent SDK is for building your own agent products in code; plugins extend the Claude Code CLI you already use. Many teams end up using both."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "Claude Agent SDK vs Claude Code plugins — when you need which",
						description: "The Claude Agent SDK is a programmatic layer for building your own agents; Claude Code plugins extend Anthropic's coding CLI. They are complementary layers, not competitors. Here is how to choose.",
						path: "/claude-agent-sdk-vs-claude-code-plugins",
						datePublished: "2026-06-11",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "Claude Agent SDK vs Plugins", url: `${SITE.domain}/claude-agent-sdk-vs-claude-code-plugins` },
					]),
				]}
			/>
			<h2>The two layers</h2>
			<p>
				The <strong>Claude Agent SDK</strong> (TypeScript and Python) is
				Anthropic&apos;s programmatic layer: you write code that creates agent
				loops, wires tools, and manages context, and you ship that as your own
				application or service. It runs headless — there is no terminal UI —
				and you own the product around it.
			</p>
			<p>
				<strong>Claude Code plugins</strong> extend Claude Code, Anthropic&apos;s
				interactive agentic CLI. A plugin contributes skills (reusable knowledge
				and workflows), agents (specialist personas), hooks (lifecycle
				automation that runs on every tool call), and MCP servers — all inside
				the terminal session a developer already works in. You install one with{" "}
				<code>claude plugin install</code>; nothing about your application
				changes.
			</p>
			<h2>When you need which</h2>
			<ul>
				<li>
					<strong>Building an agent product</strong> (a support bot, a CI
					reviewer service, an internal automation) → the Agent SDK. You need
					programmatic control, your own deployment, your own UI.
				</li>
				<li>
					<strong>Making your day-to-day coding agent better</strong> (encode
					your team&apos;s patterns, enforce security gates, run parallel
					review agents on PRs) → a Claude Code plugin. Zero code to ship,
					works in every repo you open.
				</li>
				<li>
					<strong>Both</strong> is common: teams build customer-facing agents on
					the SDK while their engineers use plugins to build that very codebase
					faster and safer.
				</li>
			</ul>
			<h2>Where OrchestKit sits</h2>
			<p>
				{SITE.name} is a plugin — the largest open-source one we know of for
				Claude Code: {COUNTS.skills} skills, {COUNTS.agents} agents, and{" "}
				{COUNTS.hooks} lifecycle hooks, MIT-licensed, no account or hosted
				service. It does not compete with the Agent SDK; if you are building on
				the SDK, OrchestKit makes the engineers writing that code faster (its
				skills cover agent architecture, LLM testing, and MCP integration
				patterns, among {COUNTS.skills} others).
			</p>
			<p>
				See <Link href="/compare">how OrchestKit compares</Link> to other
				plugins and built-in Claude Code features, or start at the{" "}
				<Link href="/docs/getting-started/installation">installation guide</Link>
				.
			</p>
			<h2>Honest scope notes</h2>
			<p>
				This page describes Anthropic&apos;s products from public documentation;
				we are not affiliated with Anthropic beyond building on their platform.
				If something here drifts out of date,{" "}
				<Link href="/contact">tell us</Link> and we will fix it.
			</p>
		</ContentPage>
	);
}

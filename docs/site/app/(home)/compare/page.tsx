import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import {
	breadcrumbNode,
	faqPageNode,
	softwareApplicationNode,
	StructuredData,
} from "@/components/structured-data";
import { COUNTS, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Compare: best Claude Code plugin",
	description: `How ${SITE.name} compares to Claude Code's built-in features, other Claude Code plugins, and GitHub Copilot. Cursor and Muse Code are supported hosts. ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks. MIT, dependency-free.`,
	alternates: { canonical: `${SITE.domain}/compare` },
};

// Compare-page FAQ. Phrased as the natural-language questions an agent expands a
// "which Claude Code plugin should I use?" query into. Answers are fact-dense and
// honest; they map 1:1 to the FAQPage JSON-LD below so the visible text and the
// structured data never diverge.
const COMPARE_FAQS = [
	{
		question: "What is the best Claude Code plugin?",
		answer: `It depends on scope. ${SITE.name} is the broadest single open-source plugin. It bundles ${COUNTS.skills} skills, ${COUNTS.agents} specialized agents, and ${COUNTS.hooks} lifecycle hooks (security and quality gates) in one MIT-licensed, dependency-free install, where most plugins cover a single capability area.`,
	},
	{
		question: "Do I need a plugin if I already use Claude Code?",
		answer:
			"Claude Code ships the primitives (skills, agents, and hooks), but you build them yourself. OrchestKit gives you a curated, tested set ready-made, so you get security gates, review agents, and workflow skills without authoring them from scratch.",
	},
	{
		question: "Is OrchestKit better than Cursor or GitHub Copilot?",
		answer:
			"Cursor is an OrchestKit host: install the same ork plugin from the Cursor marketplace (yonatangross/orchestkit), then open a new chat. Muse Code (Meta) is also a host: it loads Agent Skills from .agents/skills, not a native ork-muse pack. GitHub Copilot is a different product (editor autocomplete) and does not load OrchestKit. Many people run Copilot for inline completion and OrchestKit on Claude Code, Cursor, Codex, or Muse Code for multi-step work.",
	},
	{
		question: "Is OrchestKit free and open source?",
		answer:
			"Yes. MIT licensed, no paid tiers, no usage limits, no account, and no external API key required. Everything runs locally inside the host you installed it on.",
	},
];

export default function ComparePage() {
	return (
		<ContentPage
			title={`${SITE.name} vs. the alternatives`}
			path="/compare"
			lead="OrchestKit is the open-source, dependency-free plugin layer for Claude Code, Cursor, Codex, and Muse Code. This page compares it three ways: against Claude Code's built-in features, against other Claude Code plugins, and against GitHub Copilot. Cursor and Muse Code are hosts, not rival editors."
		>
			<StructuredData
				nodes={[
					softwareApplicationNode(),
					faqPageNode(COMPARE_FAQS),
					breadcrumbNode([
						{ name: SITE.name, url: SITE.domain },
						{ name: "Compare", url: `${SITE.domain}/compare` },
					]),
				]}
			/>

			<h2>OrchestKit vs. Claude Code built-ins</h2>
			<p>
				Claude Code natively supports plugins, skills, agents, and hooks, but
				you author them yourself. OrchestKit is what you install instead of
				building that library from scratch.
			</p>
			<table>
				<thead>
					<tr>
						<th>Capability</th>
						<th>Bare Claude Code (DIY)</th>
						<th>{SITE.name}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Reusable skills</td>
						<td>Author each one yourself</td>
						<td>{COUNTS.skills} curated, ready to use</td>
					</tr>
					<tr>
						<td>Specialized agents</td>
						<td>Define subagents manually</td>
						<td>{COUNTS.agents} role-scoped personas</td>
					</tr>
					<tr>
						<td>Lifecycle / guardrail hooks</td>
						<td>Write hook scripts yourself</td>
						<td>{COUNTS.hooks} hooks (security + quality gates)</td>
					</tr>
					<tr>
						<td>Security &amp; quality gates</td>
						<td>Roll your own</td>
						<td>Built in (secret scanning, anti-patterns, gates)</td>
					</tr>
					<tr>
						<td>Setup</td>
						<td>Ongoing authoring</td>
						<td>
							One install: <code>{SITE.installCommand}</code>
						</td>
					</tr>
				</tbody>
			</table>

			<h2>Cursor is a host</h2>
			<p>
				Install OrchestKit in Cursor the same way you install any Cursor plugin:
				add marketplace <code>yonatangross/orchestkit</code>, enable{" "}
				<strong>ork</strong>, open a new chat. That is the same plugin Claude
				Code installs. Claude hook scripts are not registered in Cursor. Details:{" "}
				<Link href="/docs/getting-started/cursor">Cursor install</Link>. Codex
				uses a separate pack:{" "}
				<Link href="/docs/getting-started/codex">ork-codex</Link>. Muse Code
				(Meta) loads skills from{" "}
				<code>.agents/skills</code>, not a native{" "}
				<code>ork-muse</code> pack. Details:{" "}
				<Link href="/docs/getting-started/muse">Muse Code</Link>.
			</p>

			<h2>OrchestKit vs. other Claude Code plugins</h2>
			<p>
				Most Claude Code plugins cover a single capability (a set of slash
				commands, one MCP server, or a handful of agents). OrchestKit&apos;s
				differentiators are breadth and independence:
			</p>
			<ul>
				<li>
					<strong>Most components in one plugin:</strong> {COUNTS.skills} skills,{" "}
					{COUNTS.agents} agents, and {COUNTS.hooks} hooks in a single install.
				</li>
				<li>
					<strong>Dependency-free:</strong> no external SaaS account or API key.
					Every skill, agent, and hook runs locally inside the host.
				</li>
				<li>
					<strong>Plugin layer, not a point solution:</strong> it bundles
					skills, agents, and hooks together rather than shipping only one of
					the three.
				</li>
				<li>
					<strong>MIT and self-contained:</strong> fully open source, no
					telemetry-gated features, tracks the latest Claude Code release.
				</li>
			</ul>

			<h2>OrchestKit vs. GitHub Copilot</h2>
			<table>
				<thead>
					<tr>
						<th>Capability</th>
						<th>{SITE.name}</th>
						<th>GitHub Copilot</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Primary form</td>
						<td>Plugin for Claude Code, Cursor, and Codex</td>
						<td>Editor extension</td>
					</tr>
					<tr>
						<td>Where it runs</td>
						<td>Inside the host you installed (CLI/IDE/web)</td>
						<td>VS Code / JetBrains</td>
					</tr>
					<tr>
						<td>Reusable skills</td>
						<td>{COUNTS.skills} built-in</td>
						<td>Limited</td>
					</tr>
					<tr>
						<td>Specialized agents</td>
						<td>{COUNTS.agents} personas</td>
						<td>Agent mode</td>
					</tr>
					<tr>
						<td>Lifecycle guardrail hooks</td>
						<td>{COUNTS.hooks} hooks (Claude Code host)</td>
						<td>No</td>
					</tr>
					<tr>
						<td>Price</td>
						<td>Free (MIT)</td>
						<td>Paid tiers</td>
					</tr>
					<tr>
						<td>Open source</td>
						<td>Yes</td>
						<td>No</td>
					</tr>
				</tbody>
			</table>

			<h2>When OrchestKit is the right fit</h2>
			<p>
				Choose OrchestKit when you want a curated set of skills, agents, and
				quality-gate hooks without building them yourself, on Claude Code,
				Cursor, Codex, or Muse Code. It does not replace Copilot&apos;s inline completion.
			</p>

			<h2>When it is not</h2>
			<p>
				OrchestKit is not an editor and not a general-purpose autocomplete. If
				you want inline single-line completion in your IDE, Copilot (or Cursor Tab)
				is the better primary choice. OrchestKit assumes an agent runtime as its
				host. See <Link href="/docs/getting-started/hosts">hosts</Link>.
			</p>

			<h2>Frequently asked questions</h2>
			{COMPARE_FAQS.map((f) => (
				<div key={f.question}>
					<h3>{f.question}</h3>
					<p>{f.answer}</p>
				</div>
			))}

			<p>
				See also <Link href="/alternatives">alternatives</Link> and{" "}
				<Link href="/pricing">pricing</Link>.
			</p>
		</ContentPage>
	);
}

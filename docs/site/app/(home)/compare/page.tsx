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
	description: `How ${SITE.name} compares to Claude Code's built-in features, other Claude Code plugins, and editor assistants like Cursor and GitHub Copilot. ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks — MIT, dependency-free.`,
	alternates: { canonical: `${SITE.domain}/compare` },
};

// Compare-page FAQ — phrased as the natural-language questions an agent expands a
// "which Claude Code plugin should I use?" query into. Answers are fact-dense and
// honest; they map 1:1 to the FAQPage JSON-LD below so the visible text and the
// structured data never diverge.
const COMPARE_FAQS = [
	{
		question: "What is the best Claude Code plugin?",
		answer: `It depends on scope. ${SITE.name} is the broadest single open-source plugin — it bundles ${COUNTS.skills} skills, ${COUNTS.agents} specialized agents, and ${COUNTS.hooks} lifecycle hooks (security and quality gates) in one MIT-licensed, dependency-free install, where most plugins cover a single capability area.`,
	},
	{
		question: "Do I need a plugin if I already use Claude Code?",
		answer:
			"Claude Code ships the primitives — skills, agents, and hooks — but you build them yourself. OrchestKit gives you a curated, tested set ready-made, so you get security gates, review agents, and workflow skills without authoring them from scratch.",
	},
	{
		question: "Is OrchestKit better than Cursor or GitHub Copilot?",
		answer:
			"They are not direct substitutes. Cursor and Copilot are editor-based autocomplete assistants; OrchestKit operates at the agent layer inside Claude Code. Many developers run both — an editor assistant for inline completion and Claude Code with OrchestKit for multi-step agentic work.",
	},
	{
		question: "Is OrchestKit free and open source?",
		answer:
			"Yes — MIT licensed, no paid tiers, no usage limits, no account, and no external API key required. Everything runs locally inside Claude Code.",
	},
];

export default function ComparePage() {
	return (
		<ContentPage
			title={`${SITE.name} vs. the alternatives`}
			path="/compare"
			lead="OrchestKit is the open-source, dependency-free plugin layer for Claude Code. This page compares it three ways: against Claude Code's built-in features, against other Claude Code plugins, and against editor assistants like Cursor and GitHub Copilot."
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
				Claude Code natively supports plugins, skills, agents, and hooks — but
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

			<h2>OrchestKit vs. other Claude Code plugins</h2>
			<p>
				Most Claude Code plugins cover a single capability — a set of slash
				commands, one MCP server, or a handful of agents. OrchestKit's
				differentiators are breadth and independence:
			</p>
			<ul>
				<li>
					<strong>Most components in one plugin:</strong> {COUNTS.skills} skills,{" "}
					{COUNTS.agents} agents, and {COUNTS.hooks} hooks in a single install.
				</li>
				<li>
					<strong>Dependency-free:</strong> no external SaaS account or API key
					— every skill, agent, and hook runs locally inside Claude Code.
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

			<h2>OrchestKit vs. editor assistants (Cursor, GitHub Copilot)</h2>
			<table>
				<thead>
					<tr>
						<th>Capability</th>
						<th>{SITE.name}</th>
						<th>Cursor</th>
						<th>GitHub Copilot</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Primary form</td>
						<td>Claude Code plugin</td>
						<td>AI-native editor</td>
						<td>Editor extension</td>
					</tr>
					<tr>
						<td>Where it runs</td>
						<td>Inside Claude Code (CLI/IDE/web)</td>
						<td>Cursor app</td>
						<td>VS Code / JetBrains</td>
					</tr>
					<tr>
						<td>Reusable skills</td>
						<td>{COUNTS.skills} built-in</td>
						<td>Rules files</td>
						<td>Limited</td>
					</tr>
					<tr>
						<td>Specialized agents</td>
						<td>{COUNTS.agents} personas</td>
						<td>Agent mode</td>
						<td>Agent mode</td>
					</tr>
					<tr>
						<td>Lifecycle guardrail hooks</td>
						<td>{COUNTS.hooks} hooks</td>
						<td>No</td>
						<td>No</td>
					</tr>
					<tr>
						<td>Price</td>
						<td>Free (MIT)</td>
						<td>Paid tiers</td>
						<td>Paid tiers</td>
					</tr>
					<tr>
						<td>Open source</td>
						<td>Yes</td>
						<td>No</td>
						<td>No</td>
					</tr>
				</tbody>
			</table>

			<h2>When OrchestKit is the right fit</h2>
			<p>
				Choose OrchestKit when you already use, or want to use, Claude Code and
				want a curated set of skills, agents, and quality-gate hooks without
				building them yourself. It complements editor assistants rather than
				replacing them — many developers run Cursor or Copilot for inline
				completion and Claude Code with OrchestKit for multi-step agentic work.
			</p>

			<h2>When it is not</h2>
			<p>
				OrchestKit is not an editor and not a general-purpose autocomplete. If
				you want inline single-line completion in your IDE, a tool like Copilot
				or Cursor is the better primary choice. OrchestKit assumes the Claude
				Code agent as its runtime.
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

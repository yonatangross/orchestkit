import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { COUNTS, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Compare",
	description: `How ${SITE.name} compares to Cursor, GitHub Copilot, and a bare Claude Code setup. OrchestKit is a curated skill/agent/hook toolkit built for the Claude Code agent.`,
	alternates: { canonical: `${SITE.domain}/compare` },
};

export default function ComparePage() {
	return (
		<ContentPage
			title={`${SITE.name} vs. the alternatives`}
			path="/compare"
			lead="OrchestKit is built for Claude Code developers. It operates at a different layer than editor assistants like Cursor or GitHub Copilot — it makes the Claude Code agent more capable, rather than autocompleting in an editor."
		>
			<h2>Feature comparison</h2>
			<table>
				<thead>
					<tr>
						<th>Capability</th>
						<th>{SITE.name}</th>
						<th>Cursor</th>
						<th>GitHub Copilot</th>
						<th>Bare Claude Code</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Primary form</td>
						<td>Claude Code plugin</td>
						<td>AI-native editor</td>
						<td>Editor extension</td>
						<td>Agentic CLI</td>
					</tr>
					<tr>
						<td>Where it runs</td>
						<td>Inside Claude Code (CLI/IDE/web)</td>
						<td>Cursor app</td>
						<td>VS Code / JetBrains</td>
						<td>Terminal / IDE</td>
					</tr>
					<tr>
						<td>Reusable skills</td>
						<td>{COUNTS.skills} built-in</td>
						<td>Rules files</td>
						<td>Limited</td>
						<td>None bundled</td>
					</tr>
					<tr>
						<td>Specialized agents</td>
						<td>{COUNTS.agents} personas</td>
						<td>Agent mode</td>
						<td>Agent mode</td>
						<td>Subagents (manual)</td>
					</tr>
					<tr>
						<td>Lifecycle guardrail hooks</td>
						<td>{COUNTS.hooks} hooks</td>
						<td>No</td>
						<td>No</td>
						<td>Hooks (you write them)</td>
					</tr>
					<tr>
						<td>Price</td>
						<td>Free (MIT)</td>
						<td>Paid tiers</td>
						<td>Paid tiers</td>
						<td>Anthropic billing</td>
					</tr>
					<tr>
						<td>Open source</td>
						<td>Yes</td>
						<td>No</td>
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

			<p>
				See also <Link href="/alternatives">alternatives</Link> and{" "}
				<Link href="/pricing">pricing</Link>.
			</p>
		</ContentPage>
	);
}

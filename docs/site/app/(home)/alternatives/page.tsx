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
	title: "Alternatives",
	description: `Alternatives to ${SITE.name} and how they differ. OrchestKit is the curated skill/agent/hook toolkit purpose-built for Claude Code — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks, MIT.`,
	alternates: { canonical: `${SITE.domain}/alternatives` },
};

const ALTERNATIVES_FAQS = [
	{
		question: "What are the alternatives to OrchestKit?",
		answer:
			"The main alternatives fall in three groups: editor assistants (Cursor, GitHub Copilot) for inline completion; bare Claude Code with no plugin; and other single-purpose Claude Code plugins or skill marketplaces. OrchestKit differs by bundling skills, agents, and guardrail hooks into one MIT-licensed, dependency-free package.",
	},
	{
		question: "Is there a free, open-source alternative to OrchestKit?",
		answer: `OrchestKit itself is the free, open-source option — MIT licensed, no account, no API key. Bare Claude Code is also an option, but you author the ${COUNTS.skills}+ skills and ${COUNTS.hooks}+ hooks yourself rather than installing them ready-made.`,
	},
];

export default function AlternativesPage() {
	return (
		<ContentPage
			title={`Alternatives to ${SITE.name}`}
			path="/alternatives"
			lead="If you're evaluating AI development tooling, here is how the common alternatives relate to OrchestKit — and where each one is the better fit."
		>
			<StructuredData
				nodes={[
					softwareApplicationNode(),
					faqPageNode(ALTERNATIVES_FAQS),
					breadcrumbNode([
						{ name: SITE.name, url: SITE.domain },
						{ name: "Alternatives", url: `${SITE.domain}/alternatives` },
					]),
				]}
			/>

			<h2>Editor assistants: Cursor and GitHub Copilot</h2>
			<p>
				<a href="https://cursor.com">Cursor</a> and{" "}
				<a href="https://github.com/features/copilot">GitHub Copilot</a> are
				AI-native coding assistants centered on the editor: inline completion,
				chat, and an agent mode. They are excellent for typing-speed productivity
				inside your IDE. OrchestKit is not an editor — it extends the Claude Code
				agent with curated skills, agents, and guardrail hooks. Many teams use
				both: an editor assistant for inline work and Claude Code + OrchestKit
				for multi-step agentic tasks.
			</p>

			<h2>Bare Claude Code</h2>
			<p>
				You can run <a href="https://www.anthropic.com/claude-code">Claude Code</a>{" "}
				with no plugin. That gives you the raw agent but none of the bundled
				skills, specialist agents, or quality-gate hooks. OrchestKit is the
				batteries-included layer on top, so you don't rebuild the same scaffolding
				on every project.
			</p>

			<h2>Other Claude Code plugins and marketplaces</h2>
			<p>
				The Claude Code ecosystem includes community plugins and skill
				marketplaces. OrchestKit's differentiator is breadth and coherence: a
				single, tested, MIT-licensed package combining skills, agents, and hooks
				that are designed to work together, with security and quality gates on by
				default.
			</p>

			<h2>Frequently asked questions</h2>
			{ALTERNATIVES_FAQS.map((f) => (
				<div key={f.question}>
					<h3>{f.question}</h3>
					<p>{f.answer}</p>
				</div>
			))}

			<h2>How to choose</h2>
			<p>
				If your work is editor-centric autocomplete, pick an editor assistant. If
				you run agentic, multi-step development in Claude Code and want curated
				best practices without assembling them yourself, OrchestKit is the fit.
				See the side-by-side <Link href="/compare">comparison</Link>.
			</p>
		</ContentPage>
	);
}

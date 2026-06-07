import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { COUNTS, PERSON, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "About",
	description: `${SITE.name} is a free, open-source plugin for Claude Code with ${COUNTS.skills} skills, ${COUNTS.agents} agents, and ${COUNTS.hooks} lifecycle hooks.`,
	alternates: { canonical: `${SITE.domain}/about` },
};

export default function AboutPage() {
	return (
		<ContentPage
			title={`About ${SITE.name}`}
			path="/about"
			lead={`${SITE.name} is a free, open-source plugin for Claude Code — a curated toolkit of skills, agents, and quality-gate hooks that adds AI-assisted development best practices out of the box.`}
		>
			<h2>What OrchestKit is</h2>
			<p>
				OrchestKit is a plugin for{" "}
				<a href="https://www.anthropic.com/claude-code">Claude Code</a>,
				Anthropic's agentic command-line coding tool. It packages{" "}
				{COUNTS.skills} reusable skills, {COUNTS.agents} specialized agents, and{" "}
				{COUNTS.hooks} lifecycle hooks into a single install. The skills encode
				patterns for authentication, database migrations, API design, testing,
				and review; the agents are task-specific personas such as security
				auditors and backend architects; the hooks enforce security and quality
				gates automatically as you work.
			</p>
			<p>
				It is not a hosted service and not a general-purpose editor assistant. It
				is infrastructure that runs inside Claude Code to make the agent more
				capable, consistent, and safe.
			</p>

			<h2>Who builds it</h2>
			<p>
				OrchestKit is built and maintained by{" "}
				<a href={PERSON.url}>{PERSON.name}</a> as an open-source project under the
				MIT license. Development happens in the open on{" "}
				<a href={SITE.github}>GitHub</a>, where issues, discussions, and pull
				requests are welcome.
			</p>

			<h2>Why it exists</h2>
			<p>
				Teams adopting AI coding agents repeatedly rebuild the same scaffolding:
				prompt patterns, guardrails, review workflows, and memory. OrchestKit
				ships those as composable primitives so you can stop explaining your
				stack to the agent and start shipping. Everything is loaded on demand, so
				there is zero runtime cost when a capability is not in use.
			</p>

			<h2>Get started</h2>
			<p>
				Install with <code>{SITE.installCommand}</code> inside Claude Code{" "}
				{SITE.ccVersion}, then read the{" "}
				<Link href="/docs/getting-started/installation">installation guide</Link>.
				See <Link href="/pricing">pricing</Link> (it's free),{" "}
				<Link href="/compare">how it compares</Link>, or{" "}
				<Link href="/contact">how to get in touch</Link>.
			</p>
		</ContentPage>
	);
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { StructuredData, personNode } from "@/components/structured-data";
import { COUNTS, PERSON, SITE } from "@/lib/constants";
import contributorsData from "@/lib/contributors-data.json";

export const metadata: Metadata = {
	title: "About",
	description: `${SITE.name} is a free, open-source plugin for Claude Code with ${COUNTS.skills} skills, ${COUNTS.agents} agents, and ${COUNTS.hooks} lifecycle hooks.`,
	alternates: { canonical: `${SITE.domain}/about` },
};

type Contributor = {
	login: string;
	url: string;
	contributions: number;
	isBot: boolean;
};

const CONTRIBUTORS: Contributor[] = contributorsData.contributors;
const PEOPLE = CONTRIBUTORS.filter((c) => !c.isBot);
const BOTS = CONTRIBUTORS.filter((c) => c.isBot);

function ContributorList({ items, bot }: { items: Contributor[]; bot: boolean }) {
	return (
		<ul>
			{items.map((c) => (
				<li key={c.login}>
					<a href={c.url} rel="nofollow">
						{c.login}
					</a>
					{bot ? " (Bot)" : ""}: {c.contributions.toLocaleString("en-US")}{" "}
					{c.contributions === 1 ? "contribution" : "contributions"}
				</li>
			))}
		</ul>
	);
}

export default function AboutPage() {
	return (
		<ContentPage
			title={`About ${SITE.name}`}
			path="/about"
			lead={`${SITE.name} is a free, open-source plugin for Claude Code: a curated toolkit of skills, agents, and quality-gate hooks that adds AI-assisted development best practices out of the box.`}
		>
			<StructuredData nodes={[personNode()]} />
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

			<h2 id="creator">Creator</h2>
			<p>
				OrchestKit was created by{" "}
				<a href={PERSON.url} rel="author">
					<strong>{PERSON.name}</strong>
				</a>{" "}
				(GitHub: <a href={PERSON.url}>github.com/yonatangross</a>).
			</p>

			<h2>Who builds it</h2>
			<p>
				OrchestKit is built and maintained by{" "}
				<a href={PERSON.url} rel="author">
					<strong>{PERSON.name}</strong>
				</a>{" "}
				as an open-source project under the MIT license. {PERSON.name} is a
				software engineer who develops OrchestKit in the open, designing the
				skill, agent, and hook primitives, and curating the security and
				quality-gate patterns the plugin ships with.
			</p>
			<p>
				Development happens publicly on{" "}
				<a href={SITE.github}>GitHub</a>, where every skill, agent, and hook is
				version-controlled and reviewed. Issues, discussions, and pull requests
				are welcome; the fastest way to reach the maintainer is to{" "}
				<a href={`${SITE.github}/issues`}>open an issue</a> or follow{" "}
				<a href={PERSON.url}>{PERSON.name} on GitHub</a>.
			</p>

			<h2 id="contributors">Contributors</h2>
			<p>
				Everyone with a commit in the{" "}
				<a href={`${SITE.github}/graphs/contributors`}>GitHub repository</a>,
				from the GitHub contributors list as of{" "}
				<time dateTime={contributorsData.snapshotDate} className="whitespace-nowrap">
					{contributorsData.snapshotDate}
				</time>
				.
				Automation accounts are listed apart and marked Bot.
			</p>
			<h3>People</h3>
			<ContributorList items={PEOPLE} bot={false} />
			<h3>Bots</h3>
			<ContributorList items={BOTS} bot />

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
				Install from a terminal with <code>{SITE.installCommand}</code> (Claude
				Code {SITE.ccVersion}), then read the{" "}
				<Link href="/docs/getting-started/installation">installation guide</Link>.
				See <Link href="/pricing">pricing</Link> (it's free),{" "}
				<Link href="/compare">how it compares</Link>, or{" "}
				<Link href="/contact">how to get in touch</Link>.
			</p>
		</ContentPage>
	);
}

import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ORG, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Contact",
	description: `How to reach the ${SITE.name} maintainers — report issues, ask questions, and contribute on GitHub.`,
	alternates: { canonical: `${SITE.domain}/contact` },
};

export default function ContactPage() {
	return (
		<ContentPage
			title={`Contact ${SITE.name}`}
			path="/contact"
			lead="OrchestKit is developed in the open. The fastest way to reach the maintainers is on GitHub."
		>
			<h2>Report a bug or request a feature</h2>
			<p>
				Open an issue on the GitHub repository at{" "}
				<a href={ORG.supportUrl}>{ORG.supportUrl}</a>. Include your Claude Code
				version, the OrchestKit version, and steps to reproduce. Bugs and feature
				requests are triaged there.
			</p>

			<h2>Ask a question or start a discussion</h2>
			<p>
				Use{" "}
				<a href={`${SITE.github}/discussions`}>GitHub Discussions</a> for
				usage questions, ideas, and showcase posts. This keeps answers
				searchable for the whole community.
			</p>

			<h2>Report a security issue</h2>
			<p>
				Please do not file public issues for security vulnerabilities. Use{" "}
				<a href={`${SITE.github}/security/advisories/new`}>
					GitHub private vulnerability reporting
				</a>{" "}
				so the maintainers can address it before disclosure.
			</p>

			<h2>Contribute</h2>
			<p>
				Pull requests are welcome. Read the contributing guidelines in the{" "}
				<a href={SITE.github}>repository</a>, fork it, and open a PR against the
				default branch. OrchestKit is MIT-licensed, so contributions stay open
				for everyone.
			</p>
		</ContentPage>
	);
}

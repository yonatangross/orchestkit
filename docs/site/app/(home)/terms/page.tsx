import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ORG, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: `Terms for using the ${SITE.name} plugin (MIT license) and the public documentation site and API.`,
	alternates: { canonical: `${SITE.domain}/terms` },
};

export default function TermsPage() {
	return (
		<ContentPage
			title="Terms of Service"
			path="/terms"
			lead="OrchestKit is free, open-source software. These terms cover the plugin, this documentation site, and the public read-only API."
		>
			<h2>The software</h2>
			<p>
				The OrchestKit plugin is licensed under the{" "}
				<a href="https://opensource.org/license/mit">MIT License</a>. You may
				use, copy, modify, and redistribute it under those terms. The software
				is provided &quot;as is&quot;, without warranty of any kind — see the
				license text in the <a href={SITE.github}>source repository</a> for the
				full disclaimer of warranty and limitation of liability.
			</p>

			<h2>The documentation site and API</h2>
			<p>
				This site ({SITE.domain}) and its read-only API (search, NLWeb{" "}
				<code>/ask</code>, Markdown export, MCP server) are provided free of
				charge, without accounts and without an SLA. Rate limits apply (120
				requests per minute per IP per endpoint, communicated via{" "}
				<code>RateLimit-*</code> response headers) and abusive traffic may be
				blocked. Documentation content is part of the open-source project and
				may be reused under the repository&apos;s MIT license.
			</p>

			<h2>Acceptable use</h2>
			<p>
				Do not use the site or API to distribute malware, attempt to disrupt
				service for others, or misrepresent OrchestKit output as an official
				statement of the project. AI agents and crawlers are explicitly
				welcome within the published rate limits — see{" "}
				<a href="/llms.txt">/llms.txt</a> and <a href="/auth.md">/auth.md</a>.
			</p>

			<h2>Changes</h2>
			<p>
				These terms may change as the project evolves; the current version is
				always at {SITE.domain}/terms, and the page history is visible in the{" "}
				<a href={SITE.github}>source repository</a>.
			</p>

			<h2>Contact</h2>
			<p>
				Questions about these terms: open an issue at{" "}
				<a href={ORG.supportUrl}>{ORG.supportUrl}</a>.
			</p>
		</ContentPage>
	);
}

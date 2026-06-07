import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ORG, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Privacy",
	description: `How the ${SITE.name} documentation site and plugin handle data. No accounts, no PII sold, analytics are anonymous.`,
	alternates: { canonical: `${SITE.domain}/privacy` },
};

export default function PrivacyPage() {
	return (
		<ContentPage
			title="Privacy"
			path="/privacy"
			lead="OrchestKit is an open-source developer tool. There are no user accounts, and no personal data is sold or shared with advertisers."
		>
			<h2>The documentation site</h2>
			<p>
				This site ({SITE.domain}) collects anonymous, aggregate usage analytics
				(such as page views) to understand which docs are useful. Analytics are
				not tied to a personal identity, and no account or login is required to
				read the documentation.
			</p>
			<p>
				The homepage fetches the public GitHub star count from the GitHub API at
				request time. No data about you is sent to GitHub in that request beyond
				what your browser normally includes.
			</p>

			<h2>The OrchestKit plugin</h2>
			<p>
				The OrchestKit plugin runs locally inside Claude Code on your machine.
				Its skills, agents, and hooks execute in your environment. Any memory or
				telemetry the plugin records is stored locally in your project, under
				your control — it is not transmitted to OrchestKit.
			</p>

			<h2>Cookies and tracking</h2>
			<p>
				The site does not use advertising cookies or cross-site trackers. Theme
				preference may be stored in your browser's local storage purely to
				remember light or dark mode.
			</p>

			<h2>Questions</h2>
			<p>
				For any privacy question, open an issue at{" "}
				<a href={ORG.supportUrl}>{ORG.supportUrl}</a>. Because the project is
				open source, you can also inspect exactly what the site and plugin do in
				the <a href={SITE.github}>source repository</a>.
			</p>
		</ContentPage>
	);
}

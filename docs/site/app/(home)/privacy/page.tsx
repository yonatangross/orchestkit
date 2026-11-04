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
				On reference documentation pages under <code>/docs/reference/</code>, the
				site also records an anonymous session replay (pointer movement, clicks
				and scrolling) to understand why those pages are abandoned. All form and
				search input is masked, the search dialog is excluded entirely, and no
				request headers, bodies or query strings are captured. Nothing is
				recorded anywhere else on the site.
			</p>
			<p>
				The homepage fetches the public GitHub star count from the GitHub API at
				request time. No data about you is sent to GitHub in that request beyond
				what your browser normally includes.
			</p>

			<h2>The OrchestKit plugin</h2>
			<p>
				The OrchestKit plugin runs locally inside Claude Code on your machine.
				It has no server of its own: nothing it records is sent to OrchestKit or
				to its maintainers.
			</p>

			<h3>What it keeps on your machine</h3>
			<ul>
				<li>
					A telemetry log of hook events (event name, tool name, session id,
					branch, timestamp) in the plugin data folder, or in{" "}
					<code>.claude/telemetry/</code> of your project. Tool inputs and
					outputs are included after secrets are redacted (keys named like
					token, key, secret, password or auth, and known key formats) and every
					string is cut to 500 characters. Tool error messages are stored as
					they are. At the end of each session the file rotates once it passes
					10 MB, and rotated files older than 7 days are deleted. Your prompt
					text is not written to this log.
				</li>
				<li>
					A lifecycle event log at{" "}
					<code>~/.local/state/orchestkit/events.jsonl</code>, rotated at 10 MB,
					plus session state used by the safety hooks.
				</li>
			</ul>
			<p>
				This local logging has no single off switch, because the safety hooks
				read their own earlier events. To stop it, disable the plugin. To remove
				it, delete those folders.
			</p>

			<h3>What reaches the network by default</h3>
			<p>
				Only through command-line tools you already have, with your own login:
			</p>
			<ul>
				<li>
					<code>claude -p --model haiku</code> on the first prompt of a session,
					to give the session a title. It sends the git branch name and the first
					600 characters of that prompt to Anthropic under your own Claude Code
					account. Set <code>ORK_SESSION_IDENTITY=0</code> to turn it off.
				</li>
				<li>
					<code>gh issue view</code> when a subagent starts on a branch named
					after an issue (for example <code>issue/123-...</code>), and{" "}
					<code>gh pr view</code> / <code>gh pr list</code> before{" "}
					<code>gh pr merge --delete-branch</code>. These read from GitHub with
					your own <code>gh</code> login.
				</li>
			</ul>

			<h3>What reaches the network only if you turn it on</h3>
			<ul>
				<li>
					<strong>telemetry-sync and the webhook forwarder.</strong> Set the
					plugin's <code>webhookUrl</code> and <code>hookToken</code> options
					(or <code>ORCHESTKIT_HOOK_URL</code> and{" "}
					<code>ORCHESTKIT_HOOK_TOKEN</code>). Then a background hook at session
					end sends the local telemetry log described above to your URL, and
					hook events are sent there as they happen, signed with your token.
					Rotated log files are deleted after a successful send. How long the
					data is kept after that is up to whoever runs the URL you chose.
					Without both settings nothing is sent. To turn it off, remove them.
				</li>
				<li>
					<strong>Your own sinks.</strong> <code>telemetry.sinks</code> entries
					in <code>~/.claude/settings.local.json</code> send hook events to the
					https URLs you list there. Project settings are never read for this.
				</li>
				<li>
					<strong>A self-hosted collector.</strong>{" "}
					<code>ORK_HQ_TELEMETRY_URL</code> sends analytics entries to that URL
					with the token you configure.
				</li>
				<li>
					<strong>TypeSafe (api.typesafe.ai), a third party.</strong> Only with{" "}
					<code>ORK_TYPESAFE_API_KEY</code> set together with{" "}
					<code>ORK_SESSION_CATEGORY_PROVIDER</code> (sends the branch name and
					the first 600 characters of the first prompt) or{" "}
					<code>ORK_ROUTE_JEV</code> (sends up to 1,500 characters of a prompt
					after secrets, emails and phone numbers are redacted). Their data
					policy applies to what they receive.
				</li>
			</ul>
			<p>
				Every opt-in destination must be an https URL. The plugin ships no MCP
				servers, and no analytics, crash reporting or update checks of its own.
			</p>

			<h2>Cookies and tracking</h2>
			<p>
				The site does not use advertising cookies or cross-site trackers. Theme
				preference may be stored in your browser's local storage purely to
				remember light or dark mode. Analytics run through PostHog, which also
				sets a first-party cookie whose name begins with <code>ph_</code> (of
				the form <code>ph_&lt;project-key&gt;_posthog</code>) holding an
				anonymous distinct id, a device id, the session id, and the
				first-visit referrer and landing URL; that data stays with this
				site's own analytics and is not shared with advertisers. The site does
				not offer an opt-out or consent prompt for analytics; blocking or
				clearing cookies that begin with <code>ph_</code> in your browser
				settings is the only way to decline them.
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

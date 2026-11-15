import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";
import {
	StructuredData,
	organizationNode,
	personNode,
	techArticleNode,
	breadcrumbNode,
} from "@/components/structured-data";

// The CLI's own page (SEO gaps row 11, orank Discovery 5). Every command and
// option here is one packages/cli/src/cli-core.ts handles and its README
// documents; __tests__/seo-pr-e-cli-page.test.tsx checks the command list
// against the source. Published on npm as `orchestkit`, alias `ork`.
const TITLE = "OrchestKit CLI";
const DESCRIPTION =
	"OrchestKit CLI on npm: print the install command, search and read the docs, ask a question and emit MCP client config from a shell or CI job. Node 20 or later.";

const COMMANDS: Array<[string, string]> = [
	["orchestkit install", "print the Claude Code install command"],
	["orchestkit search <query>", "search the documentation"],
	["orchestkit ask <question>", "ask a natural-language question (NLWeb /ask)"],
	["orchestkit read <page>", "print a docs page as Markdown"],
	["orchestkit mcp [http|stdio]", "emit MCP client config"],
	["orchestkit doctor", "check Node, API reachability and the rate-limit budget"],
];

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: `${SITE.domain}/cli` },
};

export default function CliPage() {
	return (
		<ContentPage
			title={TITLE}
			path="/cli"
			lead="The scripting surface around OrchestKit. The plugin installs into Claude Code; this CLI works from a terminal or a CI job. Zero runtime dependencies."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: TITLE,
						description: DESCRIPTION,
						path: "/cli",
						datePublished: "2026-11-15",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: TITLE, url: `${SITE.domain}/cli` },
					]),
				]}
			/>
			<h2>Install</h2>
			<pre>
				<code>{"npx orchestkit --help     # no install\nnpm i -g orchestkit       # or install it"}</code>
			</pre>
			<p>
				Published on npm as{" "}
				<a href="https://www.npmjs.com/package/orchestkit">orchestkit</a>, also available as{" "}
				<code>ork</code>. Requires Node 20 or later.
			</p>
			<h2>Commands</h2>
			<ul>
				{COMMANDS.map(([cmd, what]) => (
					<li key={cmd}>
						<code>{cmd}</code>: {what}
					</li>
				))}
			</ul>
			<p>
				Options: <code>--limit &lt;n&gt;</code>, <code>--json</code>,{" "}
				<code>--base-url &lt;url&gt;</code> (or <code>ORCHESTKIT_BASE_URL</code>).
			</p>
			<h2>What it calls</h2>
			<p>
				The public, read-only docs API described in the{" "}
				<Link href="/openapi">OrchestKit OpenAPI specification</Link>. The same calls are
				importable from the package for scripts. For agents, see the{" "}
				<Link href="/docs/mcp">OrchestKit MCP server</Link>. Source:{" "}
				<a href={`${SITE.github}/tree/main/packages/cli`}>packages/cli</a>.
			</p>
		</ContentPage>
	);
}

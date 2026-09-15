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

export const metadata: Metadata = {
	title: "OrchestKit SDK packages",
	description:
		"OrchestKit SDK packages: npm CLI orchestkit, PyPI orchestkit, Go module github.com/yonatangross/orchestkit/sdk. Homepage is this domain.",
	alternates: { canonical: `${SITE.domain}/sdk` },
};

export default function SdkPage() {
	return (
		<ContentPage
			title="OrchestKit SDK packages"
			path="/sdk"
			lead="Official clients for the public OrchestKit docs API. Each package homepage is this domain so agents can verify they are ours."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "OrchestKit SDK packages",
						description:
							"OrchestKit SDK packages on npm, PyPI, and Go modules.",
						path: "/sdk",
						datePublished: "2026-09-15",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "OrchestKit SDK packages", url: `${SITE.domain}/sdk` },
					]),
				]}
			/>
			<h2>npm</h2>
			<p>
				Package <code>orchestkit</code>: CLI and library (
				<code>search</code>, <code>ask</code>, <code>read</code>).{" "}
				<a href="https://registry.npmjs.org/orchestkit">
					registry.npmjs.org/orchestkit
				</a>
				. Homepage {SITE.domain}/developers.
			</p>
			<h2>PyPI</h2>
			<p>
				Package <code>orchestkit</code>: the same docs API client in Python.{" "}
				<a href="https://pypi.org/project/orchestkit/">
					pypi.org/project/orchestkit
				</a>
				. Hook event schemas remain{" "}
				<a href="https://pypi.org/project/orchestkit-hook-contract/">
					orchestkit-hook-contract
				</a>
				, not a substitute for this client.
			</p>
			<h2>Go</h2>
			<p>
				Module{" "}
				<code>github.com/yonatangross/orchestkit/sdk</code>.{" "}
				<code>go get github.com/yonatangross/orchestkit/sdk</code>.
			</p>
			<p>
				OpenAPI for codegen: <Link href="/openapi">OrchestKit OpenAPI specification</Link>.
				Hub: <Link href="/developers">developer resources</Link>.
			</p>
		</ContentPage>
	);
}

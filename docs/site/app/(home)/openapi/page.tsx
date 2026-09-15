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
	title: "OrchestKit OpenAPI specification",
	description:
		"OrchestKit OpenAPI specification for the public read-only docs API: search, Markdown fetch, batch, and NLWeb /ask. Spec URL /openapi.json.",
	alternates: { canonical: `${SITE.domain}/openapi` },
};

export default function OpenapiPage() {
	return (
		<ContentPage
			title="OrchestKit OpenAPI specification"
			path="/openapi"
			lead="Machine-readable OpenAPI 3.1 description of the OrchestKit docs API. No authentication. Read-only."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "OrchestKit OpenAPI specification",
						description:
							"OrchestKit OpenAPI specification for the public read-only docs API.",
						path: "/openapi",
						datePublished: "2026-09-15",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "OrchestKit OpenAPI specification", url: `${SITE.domain}/openapi` },
					]),
				]}
			/>
			<p>
				Load the spec at <Link href="/openapi.json">/openapi.json</Link> (JSON) or{" "}
				<Link href="/api/openapi.yaml">/api/openapi.yaml</Link> (YAML). The same
				document is linked from the{" "}
				<Link href="/developers">developer resource hub</Link>.
			</p>
			<h2>What the API covers</h2>
			<ul>
				<li>Search documentation: GET /api/search</li>
				<li>Fetch a page as Markdown: GET /api/md/...</li>
				<li>Natural-language questions: GET or POST /ask (NLWeb)</li>
				<li>Batch Markdown fetch and async jobs, documented in the spec</li>
			</ul>
			<p>
				Errors use RFC 9457 Problem Details. Every response carries IETF
				RateLimit headers. Policy: <Link href="/api-policy">/api-policy</Link>.
			</p>
		</ContentPage>
	);
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import {
	breadcrumbNode,
	organizationNode,
	StructuredData,
	techArticleNode,
} from "@/components/structured-data";
import {
	API_POLICY_LEAD,
	API_POLICY_TITLE,
	apiPolicySections,
	SUNSET_NOTICE_MONTHS,
} from "@/lib/api-policy";
import { SITE } from "@/lib/constants";

// /api-policy, the crawlable HTML representation of the versioning,
// deprecation and sunset policy. The policy itself is not new: it has shipped at
// /api-policy.md since #2914 and is advertised on every response as
// `Link: </api-policy.md>; rel="deprecation"`. What was missing was an HTML
// document a crawler walking the sitemap could actually find, which is why the
// Is Agentic audit reported "no deprecation or sunset policy detected".
// Content comes from lib/api-policy.ts, the same source the Markdown twin and
// the OpenAPI description use.
export const metadata: Metadata = {
	title: "API Versioning, Deprecation & Sunset Policy",
	description: `How the ${SITE.name} by Yonyon docs API is versioned, how deprecations are announced (RFC 8594 Deprecation and Sunset headers), and the ${SUNSET_NOTICE_MONTHS}-month sunset guarantee.`,
	alternates: { canonical: `${SITE.domain}/api-policy` },
};

// Minimal inline-Markdown renderer for the policy strings, which use `code`,
// **bold** and [links](…). Deliberately not a Markdown library: the input is a
// closed set of literals in lib/api-policy.ts, not user content.
function renderInline(text: string, keyPrefix: string) {
	const parts: React.ReactNode[] = [];
	const pattern = /(\[[^\]]+\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)/g;
	let last = 0;
	let match: RegExpExecArray | null;
	let i = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > last) parts.push(text.slice(last, match.index));
		const token = match[0];
		const key = `${keyPrefix}-${i++}`;
		if (token.startsWith("`")) {
			parts.push(<code key={key}>{token.slice(1, -1)}</code>);
		} else if (token.startsWith("**")) {
			parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
		} else {
			const label = token.slice(1, token.indexOf("]"));
			const href = token.slice(token.indexOf("(") + 1, -1);
			parts.push(
				href.startsWith("http") && !href.startsWith(SITE.domain) ? (
					<a key={key} href={href} target="_blank" rel="noopener noreferrer">
						{label}
					</a>
				) : (
					<Link key={key} href={href.replace(SITE.domain, "") || "/"}>
						{label}
					</Link>
				),
			);
		}
		last = match.index + token.length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

export default function ApiPolicyPage() {
	return (
		<ContentPage
			title={API_POLICY_TITLE}
			path="/api-policy"
			lead={API_POLICY_LEAD}
		>
			<StructuredData
				nodes={[
					organizationNode(),
					techArticleNode({
						headline: API_POLICY_TITLE,
						description: `Versioning scheme, RFC 8594 Deprecation and Sunset headers, and the ${SUNSET_NOTICE_MONTHS}-month sunset guarantee for the ${SITE.name} docs API.`,
						path: "/api-policy",
						datePublished: "2026-08-21",
					}),
					breadcrumbNode([
						{ name: SITE.name, url: SITE.domain },
						{ name: "API Policy", url: `${SITE.domain}/api-policy` },
					]),
				]}
			/>
			{apiPolicySections().map((section) => (
				<section key={section.heading}>
					<h2>{section.heading}</h2>
					{section.intro?.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static literal list
						<p key={`${section.heading}-p${i}`}>
							{renderInline(p, `${section.heading}-p${i}`)}
						</p>
					))}
					{section.bullets?.length ? (
						<ul>
							{section.bullets.map((b) => (
								<li key={b}>{renderInline(b, b.slice(0, 24))}</li>
							))}
						</ul>
					) : null}
				</section>
			))}
			<h2>Machine-readable twin</h2>
			<p>
				The identical policy is served as Markdown at{" "}
				<Link href="/api-policy.md">/api-policy.md</Link> and summarised in the{" "}
				<a href="/openapi.json">OpenAPI 3.1 spec</a> under{" "}
				<code>info.description</code>, with the{" "}
				<code>Deprecation</code>, <code>Sunset</code> and <code>Link</code>{" "}
				response headers declared in <code>components.headers</code>. Every
				response on this origin also advertises the policy via{" "}
				<code>Link: &lt;/api-policy.md&gt;; rel=&quot;deprecation&quot;</code>.
			</p>
		</ContentPage>
	);
}

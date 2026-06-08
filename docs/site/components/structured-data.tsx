// JSON-LD structured data for AI-search entity recognition.
//
// `sameAs` on the Organization node is the single highest-leverage property for
// disambiguating the OrchestKit entity (the brand collides with an unrelated
// music artist in training corpora). One canonical Organization block is reused
// everywhere via @id linking so the entity graph never sees conflicting
// identifiers. Ratings are NEVER fabricated — GitHub stars are surfaced as an
// honest InteractionCounter, not a fake aggregateRating.

import { COUNTS, ORG, PERSON, SAME_AS, SITE } from "@/lib/constants";

const ORG_ID = `${SITE.domain}/#organization`;
const WEBSITE_ID = `${SITE.domain}/#website`;
const SOFTWARE_ID = `${SITE.domain}/#software`;
const PERSON_ID = `${PERSON.url}#person`;

const SUMMARY = `OrchestKit is a free, open-source plugin for Claude Code. It bundles ${COUNTS.skills} skills, ${COUNTS.agents} agents, and ${COUNTS.hooks} lifecycle hooks with built-in security patterns and quality gates.`;

type JsonLdNode = Record<string, unknown>;

function JsonLd({ data }: { data: JsonLdNode }) {
	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify output of a static, server-built object — no user input.
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function organizationNode(): JsonLdNode {
	return {
		"@type": "Organization",
		"@id": ORG_ID,
		name: SITE.name,
		legalName: ORG.legalName,
		url: SITE.domain,
		logo: `${SITE.domain}/favicon.svg`,
		description: SUMMARY,
		sameAs: [...SAME_AS],
		founder: { "@id": PERSON_ID },
		contactPoint: {
			"@type": "ContactPoint",
			contactType: "technical support",
			url: ORG.supportUrl,
		},
		// Country-level address — the maintainer's country (honest; no registered
		// business street address for a solo open-source project).
		address: {
			"@type": "PostalAddress",
			addressCountry: ORG.country,
		},
	};
}

// Service node — broadens schema-type coverage and describes the free offering.
export function serviceNode(): JsonLdNode {
	return {
		"@type": "Service",
		name: SITE.name,
		serviceType: "AI-assisted software development toolkit",
		description: SUMMARY,
		provider: { "@id": ORG_ID },
		areaServed: "Worldwide",
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
	};
}

export function personNode(): JsonLdNode {
	return {
		"@type": "Person",
		"@id": PERSON_ID,
		name: PERSON.name,
		url: PERSON.url,
		sameAs: [PERSON.url],
	};
}

export function websiteNode(): JsonLdNode {
	return {
		"@type": "WebSite",
		"@id": WEBSITE_ID,
		name: SITE.name,
		url: SITE.domain,
		publisher: { "@id": ORG_ID },
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${SITE.domain}/docs?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

// SoftwareApplication — a free dev tool. `offers.price` is "0" (honest), and
// GitHub stars (when known) surface as an InteractionCounter rather than a
// fabricated aggregateRating.
export function softwareApplicationNode(starCount?: number | null): JsonLdNode {
	const node: JsonLdNode = {
		"@type": "SoftwareApplication",
		"@id": SOFTWARE_ID,
		name: SITE.name,
		applicationCategory: "DeveloperApplication",
		applicationSubCategory: "AI development toolkit",
		operatingSystem: "macOS, Linux, Windows",
		softwareVersion: SITE.version,
		description: SUMMARY,
		url: SITE.domain,
		downloadUrl: SITE.github,
		license: "https://opensource.org/license/mit",
		publisher: { "@id": ORG_ID },
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		softwareRequirements: `Claude Code ${SITE.ccVersion}`,
	};
	if (typeof starCount === "number" && starCount > 0) {
		node.interactionStatistic = {
			"@type": "InteractionCounter",
			interactionType: "https://schema.org/LikeAction",
			userInteractionCount: starCount,
		};
	}
	return node;
}

export type Faq = { question: string; answer: string };

export function faqPageNode(faqs: Faq[]): JsonLdNode {
	return {
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({
			"@type": "Question",
			name: f.question,
			acceptedAnswer: { "@type": "Answer", text: f.answer },
		})),
	};
}

export function breadcrumbNode(
	items: Array<{ name: string; url: string }>,
): JsonLdNode {
	return {
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

// Homepage WebPage node carrying speakable markup. The selectors target the hero
// headline and value proposition so voice assistants read the right content.
function homeWebPageNode(): JsonLdNode {
	return {
		"@type": "WebPage",
		"@id": `${SITE.domain}/#webpage`,
		url: SITE.domain,
		name: `${SITE.name} — AI Development Toolkit`,
		isPartOf: { "@id": WEBSITE_ID },
		about: { "@id": ORG_ID },
		primaryImageOfPage: `${SITE.domain}/opengraph-image`,
		speakable: {
			"@type": "SpeakableSpecification",
			cssSelector: ["[data-speakable-headline]", "[data-speakable-summary]"],
		},
	};
}

// The default homepage FAQ — accurate, fact-dense answers (chunk-friendly for
// LLM retrieval). Kept here so the WebMCP/agent surfaces can reuse it later.
export const HOME_FAQS: Faq[] = [
	{
		question: "What is OrchestKit?",
		answer: SUMMARY,
	},
	{
		question: "Is OrchestKit free?",
		answer:
			"Yes. OrchestKit is open source under the MIT license. There are no paid tiers, no usage limits, and no account is required.",
	},
	{
		question: "How do I install OrchestKit?",
		answer: `Run \`${SITE.installCommand}\` inside Claude Code ${SITE.ccVersion}. The plugin installs all skills, agents, and hooks in one step.`,
	},
	{
		question: "What is Claude Code?",
		answer:
			"Claude Code is Anthropic's agentic command-line coding tool. OrchestKit is a plugin that extends it with curated skills, specialized agents, and lifecycle hooks.",
	},
	{
		question: "How does OrchestKit compare to GitHub Copilot or Cursor?",
		answer:
			"OrchestKit operates at a different layer. Copilot and Cursor are general-purpose AI coding assistants in the editor; OrchestKit is a curated toolkit of skills, agents, and quality-gate hooks built specifically for the Claude Code agent.",
	},
];

// Single homepage graph: Organization + Person + WebSite + WebPage(speakable) +
// SoftwareApplication + FAQPage, linked by @id.
export function HomepageStructuredData({
	starCount,
}: {
	starCount?: number | null;
}) {
	const graph = {
		"@context": "https://schema.org",
		"@graph": [
			organizationNode(),
			personNode(),
			websiteNode(),
			homeWebPageNode(),
			softwareApplicationNode(starCount),
			serviceNode(),
			faqPageNode(HOME_FAQS),
		],
	};
	return <JsonLd data={graph} />;
}

// Reusable wrapper for non-home pages that want an Organization + a page-specific
// node (e.g. a trust page emitting Organization + BreadcrumbList).
export function StructuredData({ nodes }: { nodes: JsonLdNode[] }) {
	return (
		<JsonLd
			data={{ "@context": "https://schema.org", "@graph": nodes }}
		/>
	);
}

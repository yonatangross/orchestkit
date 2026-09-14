import { COUNTS, ORG, SITE } from "@/lib/constants";

// A2A Agent Card — served at /.well-known/agent-card.json via a rewrite in
// next.config.mjs. Describes the capabilities an agent can use against this site
// (documentation search and skill discovery), the endpoints that back them, and
// where to get help. Spec: https://a2a-protocol.org
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const card = {
		protocolVersion: "0.3.0",
		name: SITE.name,
		description: `Documentation and capability discovery for ${SITE.name}, a free, open-source plugin for Claude Code (${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks).`,
		url: `${d}/api/mcp`,
		preferredTransport: "JSONRPC",
		version: SITE.version,
		provider: {
			organization: ORG.legalName,
			url: SITE.domain,
		},
		documentationUrl: `${d}/llms.txt`,
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: false,
		},
		// Public API, identity optional: an empty `security` array means no
		// scheme is REQUIRED to call any endpoint (A2A / OpenAPI convention).
		// `securitySchemes` names the one optional bearer, the anonymous identity
		// assertion minted at POST /agent/identity, so an agent that wants a
		// stable registration id knows how to present it. `identity_type` stays
		// "anonymous": that is the default every caller gets. See /auth.md.
		identity_type: "anonymous",
		securitySchemes: {
			agentIdentity: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description:
					"Optional. The identity assertion returned by POST /agent/identity (type anonymous). Grants nothing an anonymous caller lacks; a bearer this origin did not issue is answered 401 with resource_metadata.",
			},
		},
		security: [],
		defaultInputModes: ["text/plain", "application/json"],
		defaultOutputModes: ["application/json", "text/markdown"],
		skills: [
			{
				id: "search-docs",
				name: "Search documentation",
				description:
					"Full-text search across the OrchestKit documentation; returns matching pages with titles and URLs.",
				tags: ["docs", "search"],
				examples: ["How do I install OrchestKit?", "memory knowledge graph"],
			},
			{
				id: "list-skills",
				name: "List skills",
				description: `List all ${COUNTS.skills} OrchestKit skills from the agent-skills discovery index.`,
				tags: ["skills", "discovery"],
				examples: ["What skills are available?"],
			},
			{
				id: "get-skill",
				name: "Get a skill",
				description: "Fetch a single skill's documentation as Markdown by name.",
				tags: ["skills", "docs"],
				examples: ["Show me the implement skill"],
			},
		],
		additionalInterfaces: [
			{ transport: "HTTP+JSON", url: `${d}/ask` },
			{ transport: "JSONRPC", url: `${d}/api/mcp` },
		],
		contact: {
			support: ORG.supportUrl,
			source: SITE.github,
		},
	};

	return new Response(JSON.stringify(card, null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

import { COUNTS, SITE } from "@/lib/constants";
import { OPENAPI_COMPONENTS } from "@/lib/openapi/components";
import { OPENAPI_PATHS } from "@/lib/openapi/paths";

// Single source of truth for the OpenAPI 3.1 description of the public,
// read-only OrchestKit Docs API. Built here (rather than inline in the route)
// so the JSON surface (/api/openapi, /openapi.json) and the YAML twin
// (/api/openapi.yaml) serialize the *same* object — agent-readiness scanners
// (e.g. ora.ai) probe /openapi.json and /api/openapi.yaml by exact path.
export function buildOpenApiSpec() {
	return {
		openapi: "3.1.0",
		info: {
			title: `${SITE.name} Docs API`,
			version: SITE.version,
			summary: "Public, read-only API over the OrchestKit documentation.",
			description: `Read-only API for the ${SITE.name} documentation site (${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks). No authentication is required — see ${SITE.domain}/auth.md. Errors use the RFC 9457 Problem Details shape (served as application/json) and reference the Problem schema. **Versioning:** this is API v1, also reachable under the path-versioned alias \`/api/v1/*\` (e.g. \`/api/v1/search\`). Breaking changes ship under a new \`/api/vN\` prefix; the unversioned path tracks the latest. **Deprecation policy:** nothing is deprecated today. When an endpoint is eventually deprecated, its responses will carry the RFC 8594 \`Deprecation\` and \`Sunset\` HTTP headers (and a \`Link\` header with \`rel="deprecation"\` pointing at the migration notes); the endpoint keeps working until the date in \`Sunset\`. Breaking replacements ship under a new \`/api/vN\` prefix so existing integrations stay on their current version. **Rate limits:** 120 requests per minute per IP per endpoint, communicated via the IETF \`RateLimit-*\` response headers on every response; exceeding the window returns 429 with \`Retry-After\`. Cache responses and retry transient 5xx with exponential backoff. **Pagination:** list endpoints use opaque cursors — pass \`limit\`, then follow the \`Link: rel="next"\` header (or \`X-Next-Cursor\`) until absent. **Idempotency:** every endpoint is a read and therefore idempotent; an \`Idempotency-Key\` request header is accepted and echoed back so clients can correlate retries. **SDKs & packages:** Python — \`pip install orchestkit-hook-contract\` (https://pypi.org/project/orchestkit-hook-contract/); MCP stdio surface — \`docker run -i --rm ghcr.io/yonatangross/orchestkit-docs-mcp\`. Full policy page: ${SITE.domain}/api-policy.md.`,
			license: {
				name: "MIT",
				url: "https://opensource.org/license/mit",
			},
			contact: { name: SITE.name, url: SITE.github },
		},
		servers: [
			{ url: SITE.domain, description: "Production (latest)" },
			{ url: `${SITE.domain}/api/v1`, description: "Production (v1 alias)" },
		],
		paths: OPENAPI_PATHS,
		components: OPENAPI_COMPONENTS,
	};
}

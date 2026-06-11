import { SITE } from "@/lib/constants";

// /api-policy.md — dedicated API versioning, deprecation & sunset policy page.
// The same policy is summarized in the OpenAPI info.description; this page is
// the canonical, linkable statement (referenced from /llms.txt) so agents and
// scanners can discover it without parsing the spec. No auth — see /auth.md.
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const body = [
		`# ${SITE.name} API versioning, deprecation & sunset policy`,
		"",
		`> The ${SITE.name} docs API is public, read-only, and free. This page states how it is versioned, how deprecations are announced, and what guarantees integrations can rely on.`,
		"",
		"## Versioning",
		"",
		`- The current API is **v1**, reachable both unversioned (\`${d}/api/*\`) and under the path-versioned alias (\`${d}/api/v1/*\`).`,
		"- The unversioned path always tracks the latest version; pin `/api/v1/*` if you want path stability.",
		"- **Breaking changes never ship in place.** They ship under a new `/api/vN` prefix; existing prefixes keep their behavior.",
		"- Additive changes (new endpoints, new optional fields) ship continuously without a version bump.",
		"",
		"## Deprecation",
		"",
		"Nothing is deprecated today. When an endpoint is deprecated:",
		"",
		"- Its responses carry the RFC 8594 `Deprecation` header from the day of announcement.",
		"- A `Sunset` header states the date after which the endpoint may stop responding — **at least 6 months** after the deprecation announcement.",
		"- A `Link` header with `rel=\"deprecation\"` points at migration notes.",
		`- The deprecation is listed in the [changelog](${d}/docs/changelog) and on this page.`,
		"",
		"## Sunset guarantees",
		"",
		"- Deprecated endpoints keep working until the `Sunset` date.",
		"- After sunset, calls return `410 Gone` with an RFC 9457 problem body linking the replacement.",
		"",
		"## Webhooks",
		"",
		`${SITE.name} **does not emit webhooks** — the API is read-only and request/response only, so there is no webhook registration, no event delivery, and consequently no webhook signing scheme. (Mentions of "webhooks" elsewhere in the docs refer to skill/agent content that helps you build webhooks in *your* applications.)`,
		"",
		"## Stability of machine-readable surfaces",
		"",
		`- [OpenAPI spec](${d}/api/openapi) — regenerated every release; schema-compatible within a major version.`,
		`- [MCP server](${d}/api/mcp) — tool names and shapes follow the same deprecation policy as REST endpoints.`,
		`- [llms.txt](${d}/llms.txt) · [API catalog](${d}/.well-known/api-catalog) · [auth policy](${d}/auth.md)`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

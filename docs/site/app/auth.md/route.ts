import { SITE } from "@/lib/constants";

// /auth.md — agent-facing authentication walkthrough (WorkOS auth.md shape:
// Discover / Pick a method / Use the credential / Errors). OrchestKit's public
// documentation and search API require NO authentication, so this file says so
// plainly rather than describing a credential flow that does not exist.
// Spec: https://workos.com/auth-md
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const body = [
		`# Authenticating with the ${SITE.name} API`,
		"",
		"> The OrchestKit documentation and search API are public and read-only. No authentication, API key, or account is required. Agents call the endpoints directly.",
		"",
		"## Discover",
		"",
		"An agent discovers how to use this API in three steps, none of which require a credential:",
		"",
		`1. **RFC 9727 API catalog** — fetch \`${d}/.well-known/api-catalog\` (\`application/linkset+json\`). Its \`linkset\` \`item\` entries point to the OpenAPI spec, the \`/ask\` endpoint, and the MCP server.`,
		`2. **A2A agent card** — fetch \`${d}/.well-known/agent-card.json\` for the capabilities/skills and the transport endpoints.`,
		`3. **OpenAPI** — fetch \`${d}/api/openapi\` for the full request/response shapes.`,
		"",
		"No `WWW-Authenticate` challenge is returned by any endpoint, because no credential is needed — there is no protected-resource metadata (RFC 9728) and no authorization server, by design.",
		"",
		"## Pick a method",
		"",
		"There is one method: **anonymous access**. Every endpoint is reachable without a bearer token, cookie, or signature.",
		"",
		"**This API does not support agentic registration.** There is no `register_uri`, `claim_uri`, or `revocation_uri`, and no `agent_auth` block — there is nothing to register for. The OAuth 2.0 / RFC 9728 protected-resource flow is intentionally omitted; agents should not attempt a PRM fetch or a `401`-driven discovery handshake.",
		"",
		"## Use the credential",
		"",
		"No credential is used. Send the request directly. Examples:",
		"",
		"```http",
		`GET ${d}/api/search?query=install HTTP/1.1`,
		"Accept: application/json",
		"```",
		"",
		"```http",
		`POST ${d}/ask HTTP/1.1`,
		"Content-Type: application/json",
		"",
		'{ "query": "How do I install OrchestKit?" }',
		"```",
		"",
		"The MCP server at `" + d + "/api/mcp` (Streamable HTTP) is likewise open — connect without credentials.",
		"",
		"## Errors",
		"",
		"Errors use the RFC 9457 Problem Details shape — a machine-readable `type`, `title`, `status`, and `detail` — served as `application/json`. The error codes you may encounter:",
		"",
		"| HTTP status | `title` | When |",
		"| --- | --- | --- |",
		"| `400` | Missing query parameter / Invalid request body | Malformed request (e.g. empty `query`, non-JSON body). |",
		"| `404` | API endpoint not found / Not found | Unknown path or a non-existent doc page. |",
		"| `405` | Method Not Allowed | Wrong HTTP method (e.g. `GET` on `/api/mcp`). |",
		"| `429` | Too Many Requests | Not enforced today (no per-key quota); if a CDN edge returns it, honor `Retry-After`. |",
		"| `5xx` | — | Transient; retry with exponential backoff (1s, 2s, 4s). |",
		"",
		"Auth-specific codes are intentionally **not** used: you will never receive `401 Unauthorized` / `invalid_token` / `insufficient_scope` for a missing credential, because none is required.",
		"",
		"## Revocation",
		"",
		"Not applicable — there are no credentials to revoke.",
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

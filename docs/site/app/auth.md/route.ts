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
		`Capabilities are advertised at \`${d}/.well-known/api-catalog\` (RFC 9727) and \`${d}/.well-known/agent-card.json\` (A2A). The OpenAPI description is at \`${d}/api/openapi\`. No \`WWW-Authenticate\` challenge is returned, because no credential is needed.`,
		"",
		"## Pick a method",
		"",
		"There is one method: **anonymous access**. Every endpoint is reachable without a bearer token, cookie, or signature. There is no registration step and no `agent_auth` block, because there is nothing to register for.",
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
		"Errors are returned as RFC 9457 Problem Details (`application/problem+json`) with a machine-readable `type`, `title`, `status`, and `detail`. You will not receive `401 Unauthorized` for missing credentials, since none are required. A `404` means the resource does not exist; a `400` means the request was malformed (for example, a missing `query`).",
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

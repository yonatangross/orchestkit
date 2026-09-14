import {
	AS_METADATA_URL,
	IDENTITY_ENDPOINT,
	IDENTITY_TOKEN_TYPE,
	PRM_URL,
	SCOPES,
} from "@/lib/agent-identity";
import { SITE } from "@/lib/constants";

// The document's own summary, rendered as the blockquote below.
//
// It is NOT wrapped in YAML frontmatter, and that is deliberate. The auth.md
// spec (workos.com/auth-md/docs/auth-md) prescribes the document's opening:
// "A well-formed auth.md is organized as a numbered walkthrough an agent
// follows top to bottom. Here is what each section should cover: Title and
// intro - A one-line title (# auth.md) followed by a short preamble." The
// walkthrough's first section IS the title, so a header block above it puts
// non-walkthrough content ahead of the document's own first step.
//
// The same section closes with "Keep the file conservative in length and high
// in signal. Anything an agent doesn't need to register or operate against
// your API belongs in your main documentation, not in auth.md." A frontmatter
// title/description/canonical is exactly that: the spec enumerates what a
// consumer extracts (headings, the Discovery section, fenced code blocks, and
// the PRM as authoritative) and no metadata key is in that list.
//
// The other six served Markdown surfaces DO carry frontmatter and should keep
// it. This is the one document whose own specification constrains its opening.
// GH-3691.
const AUTH_LEAD =
	"The OrchestKit documentation and search API are public and read-only. No authentication, API key, or account is required. Identity is optional: an agent that wants a stable registration id can register anonymously at the identity endpoint and present the returned assertion as a bearer.";

// /auth.md: agent-facing authentication walkthrough (WorkOS auth.md shape:
// Discover / Pick a method / Use the credential / Errors). The public API
// requires NO authentication; the walkthrough says so plainly and then
// describes the one optional identity flow that does exist, without claiming
// a credential is ever required. Spec: https://workos.com/auth-md
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const scopeList = SCOPES.map((s) => `\`${s}\``).join(", ");
	const body = [
		`# Authenticating with the ${SITE.name} API`,
		"",
		`> ${AUTH_LEAD}`,
		"",
		"## Discover",
		"",
		"An agent discovers how to use this API in three steps, none of which require a credential:",
		"",
		`1. **RFC 9727 API catalog**: fetch \`${d}/.well-known/api-catalog\` (\`application/linkset+json\`). Its \`linkset\` \`item\` entries point to the OpenAPI spec, the \`/ask\` endpoint, the MCP server, and the two OAuth metadata documents below.`,
		`2. **A2A agent card**: fetch \`${d}/.well-known/agent-card.json\` for the capabilities/skills and the transport endpoints.`,
		`3. **OpenAPI**: fetch \`${d}/api/openapi\` for the full request/response shapes.`,
		"",
		"The OAuth discovery chain is published and every link in it resolves:",
		"",
		`- **RFC 9728 protected-resource metadata** at \`${PRM_URL}\`. \`authorization_servers\` names this origin, \`bearer_methods_supported\` is \`["header"]\`, \`scopes_supported\` is ${scopeList}. It also carries \`"authentication_required": false\`, which is the point: the PRM tells you HOW a bearer travels, not that you need one.`,
		`- **RFC 8414 authorization-server metadata** at \`${AS_METADATA_URL}\`, with the auth.md \`agent_auth\` block: \`identity_endpoint\`, \`identity_types_supported\` and \`identity_assertion.assertion_types_supported\`. There is no authorization endpoint, token endpoint, claim endpoint or events endpoint, so none is advertised; nothing in this document points at a URL that answers 404.`,
		"",
		"### When you will see a 401",
		"",
		"Only in two cases, and never for an anonymous request:",
		"",
		`- You sent \`Authorization: Bearer <token>\` and the token is not one this origin issued, or it has expired. The response is \`401\` with \`WWW-Authenticate: Bearer realm="...", error="invalid_token", resource_metadata="${PRM_URL}"\`. Drop the header and retry anonymously, or register again.`,
		`- You sent \`GET ${IDENTITY_ENDPOINT}\` with no bearer. That endpoint reads an identity back, so it needs one; the same \`WWW-Authenticate\` hint points you at the PRM.`,
		"",
		`Anonymous \`GET ${d}/api\`, \`POST ${d}/api/mcp\`, \`/api/search\`, \`/ask\` and every docs page answer as they always have. A discovery handshake that starts from a 401 is therefore only ever triggered by a credential you chose to send.`,
		"",
		"Sample discovery responses (live, abbreviated):",
		"",
		"```json",
		`// GET ${PRM_URL}`,
		"{",
		`  "resource": "${d}",`,
		`  "authorization_servers": ["${d}"],`,
		`  "scopes_supported": ${JSON.stringify([...SCOPES])},`,
		'  "bearer_methods_supported": ["header"],',
		`  "resource_documentation": "${d}/auth.md",`,
		'  "authentication_required": false',
		"}",
		"```",
		"",
		"```json",
		`// GET ${AS_METADATA_URL}`,
		"{",
		`  "issuer": "${d}",`,
		`  "scopes_supported": ${JSON.stringify([...SCOPES])},`,
		'  "response_types_supported": [],',
		'  "grant_types_supported": [],',
		'  "agent_auth": {',
		`    "skill": "${d}/auth.md",`,
		`    "identity_endpoint": "${IDENTITY_ENDPOINT}",`,
		'    "identity_types_supported": ["anonymous", "identity_assertion"],',
		`    "identity_assertion": { "assertion_types_supported": ["${IDENTITY_TOKEN_TYPE}"] }`,
		"  }",
		"}",
		"```",
		"",
		"## Pick a method",
		"",
		"Two methods, and the first one is the default you already have:",
		"",
		"1. **Anonymous access.** Send the request. No bearer, cookie, or signature. This is the sole method the documentation, search, `/ask` and MCP endpoints ever need.",
		`2. **Optional agent identity** (auth.md agentic registration, type \`anonymous\`). \`POST ${IDENTITY_ENDPOINT}\` with \`{"type":"anonymous"}\` returns a service-signed identity assertion (a 30-day JWT, \`typ: oauth-id-jag+jwt\`). Present it as \`Authorization: Bearer <identity_assertion>\` and \`GET ${IDENTITY_ENDPOINT}\` echoes your registration. Re-register before it expires with \`{"type":"identity_assertion","assertion_type":"${IDENTITY_TOKEN_TYPE}","assertion":"<the token>"}\`; the registration id is preserved.`,
		"",
		"Identity registration is served only when the deployment holds a private signing key and answers 503 otherwise.",
		"",
		"What the identity does NOT do: it grants no scope an anonymous caller lacks (`scopes` in the registration response equals the anonymous scope set), there is no claim ceremony (`claim` is `null`), and there is no token endpoint to exchange the assertion at: the assertion is the bearer. `service_auth` registration is not offered; the endpoint answers `service_auth_not_enabled`.",
		"",
		"## Use the credential",
		"",
		"Anonymous, the normal case:",
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
		"With an optional identity:",
		"",
		"```http",
		`POST ${IDENTITY_ENDPOINT} HTTP/1.1`,
		"Content-Type: application/json",
		"",
		'{ "type": "anonymous" }',
		"```",
		"",
		"```http",
		`GET ${IDENTITY_ENDPOINT} HTTP/1.1`,
		"Authorization: Bearer <identity_assertion from the response above>",
		"Accept: application/json",
		"```",
		"",
		"The MCP server at `" + d + "/api/mcp` (Streamable HTTP) is open: connect without credentials. A bearer sent to it is verified the same way as everywhere else and adds nothing.",
		"",
		"## Errors",
		"",
		"Errors use the RFC 9457 Problem Details shape (a machine-readable `type`, `title`, `status`, and `detail`) served as `application/json`. Registration errors from the identity endpoint use the OAuth `error` / `error_description` envelope instead, because that is what the auth.md skill parses. The codes you may encounter:",
		"",
		"| HTTP status | `title` or `error` | When |",
		"| --- | --- | --- |",
		"| `400` | Missing query parameter / Invalid request body | Malformed request (e.g. empty `query`, non-JSON body). |",
		"| `400` | `invalid_request`, `unsupported_assertion_type`, `invalid_issuer`, `invalid_signature`, `expired`, `service_auth_not_enabled` | Identity endpoint registration errors. |",
		`| \`401\` | Unauthorized, \`error="invalid_token"\` | You presented a bearer this origin did not issue, or one that expired. Carries \`WWW-Authenticate\` with \`resource_metadata\`. |`,
		`| \`401\` | Unauthorized (no \`error\` code) | \`GET ${IDENTITY_ENDPOINT}\` without a bearer. Same hint. |`,
		"| `404` | API endpoint not found / Not found | Unknown path or a non-existent doc page. |",
		"| `405` | Method Not Allowed | Wrong HTTP method (e.g. `GET` on `/api/mcp`). |",
		"| `429` | Too Many Requests | The published per-route limit (see `/api-policy.md`); honor `Retry-After`. |",
		"| `5xx` | (none) | Transient; retry with exponential backoff (1s, 2s, 4s). |",
		"",
		"A `401` for a rejected bearer looks like this:",
		"",
		"```http",
		"HTTP/1.1 401 Unauthorized",
		`WWW-Authenticate: Bearer realm="${SITE.name} Docs API", error="invalid_token", error_description="The bearer is not a well-formed identity assertion.", resource_metadata="${PRM_URL}"`,
		"Content-Type: application/json; charset=utf-8",
		"",
		"{",
		`  "type": "${d}/auth.md",`,
		'  "title": "Unauthorized",',
		'  "status": 401,',
		'  "detail": "... Identity is optional on this API: retry without an Authorization header for anonymous access ...",',
		`  "resource_metadata": "${PRM_URL}"`,
		"}",
		"```",
		"",
		"`insufficient_scope` is never returned: there is one scope and everyone holds it. `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`, `interaction_required`, `login_required`, `consent_required` and `registration_not_supported` are OAuth-flow errors, and there is no OAuth flow beyond the anonymous registration above.",
		"",
		"## Revocation",
		"",
		"An identity assertion cannot be revoked before it expires; there is nothing it unlocks that revoking would protect. Stop sending it and you are anonymous again.",
		"",
		"## Webhooks",
		"",
		`${SITE.name} does not emit webhooks (the API is read-only, request/response only), so there is no webhook registration and no webhook signature scheme to verify. Mentions of "webhooks" in the documentation are skill/agent content for building webhooks in your own applications. See the [API policy](/api-policy.md) page.`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

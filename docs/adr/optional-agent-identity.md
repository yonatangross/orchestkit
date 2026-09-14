# ADR: Optional agent identity, and where the 401 hint may appear

**Status**: Accepted
**Date**: 2026-09-14
**Decision**: Publish the full OAuth discovery chain for orchestkit.yonyon.ai, issue an optional anonymous identity, and raise the `WWW-Authenticate` discovery hint only on a rejected bearer or on the one endpoint that needs an identity. Never on an anonymous request.

## Context

The OrchestKit docs API is public by design. Anonymous reads of `/api`, `/api/mcp`, `/api/search`, `/ask` and every docs page are the product; there is no tenant data, no quota tied to a caller, and no write surface.

Agent-readiness scanners (orank on ora.ai) score three related things: RFC 9728 protected-resource metadata, RFC 8414 authorization-server metadata with the auth.md `agent_auth` block, and a `401` that carries `WWW-Authenticate: Bearer resource_metadata="..."` so an agent can find the metadata from a refused request. Before this change the site served a PRM with empty `authorization_servers`, `scopes_supported` and `bearer_methods_supported`, no AS metadata, and never a 401.

The portfolio site paid for the obvious shortcut already (portfolio GH-670): a 401 hint returned unconditionally on a site with nothing protected scored, and it was a lie. The check is satisfied honestly only by a request that actually deserves a 401.

## Decision

1. **Identity is optional.** `POST /agent/identity` with `{"type":"anonymous"}` returns a service-signed identity assertion (HS256 JWT, `typ: oauth-id-jag+jwt`, issuer and audience this origin, 30-day expiry). An agent may present it as `Authorization: Bearer`. It grants no scope an anonymous caller lacks; the only thing it unlocks is `GET /agent/identity`, which echoes the registration back. Re-registration with an assertion this origin issued preserves the registration id. `service_auth` is refused (`service_auth_not_enabled`): there is no email claim ceremony.

2. **The discovery chain is complete and every link resolves.** The PRM names this origin as its authorization server, lists the single `docs.read` scope and `bearer_methods_supported: ["header"]`, and adds `authentication_required: false`. The AS metadata carries `issuer`, the agent_auth block (`skill`, `identity_endpoint`, `identity_types_supported: ["anonymous","identity_assertion"]`, `identity_assertion.assertion_types_supported`) and nothing else that would answer 404: no authorization, token, registration, claim or events endpoint is advertised because none exists. `grant_types_supported` and `response_types_supported` are empty for the same reason. The chain test (`docs/site/__tests__/auth-chain.test.ts`) walks auth.md to PRM to AS metadata to every advertised URL and fails on a phantom.

3. **The 401 hint appears in exactly two places.**
   - Middleware: a request on any path that presents a bearer this origin did not issue, or one that has expired, gets `401` with `WWW-Authenticate: Bearer realm="...", error="invalid_token", error_description="...", resource_metadata="<PRM URL>"` (RFC 6750 section 3.1 plus the RFC 9728 hint). A request with no `Authorization` header, or with another scheme, is routed exactly as before.
   - `GET /agent/identity` with no bearer: `401` with the same `resource_metadata` hint and no `error` code, since no token was sent. This is the one genuinely protected endpoint.
   - Anonymous `GET /api` stays 200. Anonymous `POST /api/mcp` stays 200. `GET /api/mcp` keeps answering 405 from its handler. No path returns 401 to a caller that sent no credential, except the identity read-back.

4. **The signing key is honest about what it protects.** `AGENT_IDENTITY_SECRET` makes the assertion unforgeable. The fixed-phrase fallback exists only for local and test use. Production requires the secret: without it, `POST /agent/identity` answers 503 and every bearer is refused. This applies even though identity currently grants no more than anonymous access, so an eventual privilege attaches to a key that was private from the start.

## Consequences

- `auth.md` describes optional identity and the two 401 cases, and no longer claims a 401 can never occur.
- The A2A agent card lists the optional bearer in `securitySchemes` and keeps `security: []` (nothing required) and `identity_type: "anonymous"` (the default every caller gets).
- Middleware returns a Promise only when a bearer is present; the no-bearer path stays synchronous, so the existing direct-call tests are unchanged.
- `/agent/identity` is added to the served-path allowlist and to the agent-surface classifier (`identity`), so it is rate-limited and observable like the rest of the agent surface.
- `pricing.md` discovery (llms.txt line and sitemap entry) was already in place at HEAD and is unchanged by this decision.

## Rejected

- **Always-401 with the hint.** Scores, and lies. Rejected on the GH-670 precedent.
- **A real token endpoint (RFC 7523 JWT-bearer exchange).** Would need key management and a second token type for a privilege that does not exist. The assertion is the bearer; the metadata omits the endpoint instead of advertising a 404.
- **Advertising `service_auth` or a claim ceremony.** No email verification exists here; listing it would send agents into a `*_not_enabled` error the metadata should have spared them.

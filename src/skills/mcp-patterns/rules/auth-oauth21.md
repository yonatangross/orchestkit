---
title: "OAuth 2.1 Authorization for MCP Servers"
impact: "HIGH"
impactDescription: "Without proper OAuth 2.1 + RFC 8707, tokens leak across services (confused deputy), clients accept any server's token, and attackers replay authorization codes"
tags: [oauth, authorization, pkce, rfc8707, resource-indicators, mcp-spec-2025-11-25, mtls, oidc]
---

## OAuth 2.1 Authorization for MCP Servers

MCP servers are OAuth 2.1 Resource Servers (spec 2025-11-25). Clients MUST use PKCE with S256, bind tokens to the target resource via RFC 8707, and never pass tokens through to downstream services.

**Incorrect -- no PKCE, no resource indicator, token passthrough:**
```typescript
// BAD: Missing PKCE and resource parameter
const authUrl = `${authServer}/authorize?client_id=${clientId}&redirect_uri=${redirect}`;

// BAD: Passing client's token to upstream API (confused deputy)
async function callUpstreamApi(clientToken: string) {
  return fetch("https://api.example.com/data", {
    headers: { Authorization: `Bearer ${clientToken}` }, // NEVER DO THIS
  });
}

// BAD: No audience validation on the resource server
function validateToken(token: string) {
  const decoded = jwt.verify(token, publicKey);
  return decoded; // Missing audience check — accepts ANY valid token
}
```

**Correct -- PKCE S256 + RFC 8707 resource binding:**
```typescript
import crypto from "node:crypto";

// 1. PKCE: Generate verifier and S256 challenge
function createPkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// 2. Authorization request with resource indicator (RFC 8707)
function buildAuthUrl(
  authServer: string, clientId: string, redirectUri: string,
  mcpServerUri: string, scopes: string[],
) {
  const { verifier, challenge } = createPkce();
  const state = crypto.randomBytes(16).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: mcpServerUri, // MUST match MCP server's canonical URI
    scope: scopes.join(" "),
    state,
  });
  return { url: `${authServer}/authorize?${params}`, verifier, state };
}

// 3. Token exchange — resource parameter MUST match authorization request
async function exchangeCode(
  tokenEndpoint: string, code: string, verifier: string,
  clientId: string, redirectUri: string, mcpServerUri: string,
) {
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code,
      code_verifier: verifier, client_id: clientId,
      redirect_uri: redirectUri, resource: mcpServerUri,
    }),
  });
  return res.json();
}
```

**Correct -- token validation + confused deputy prevention:**
```typescript
// 4. MCP server validates audience (RFC 8707 + RFC 9068)
function validateAccessToken(token: string, expectedAudience: string) {
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    audience: expectedAudience, // MUST be this server's canonical URI
    issuer: trustedIssuer,
  });
  return decoded;
}

// 5. Upstream calls use a SEPARATE token — never forward the client's token
async function callUpstream(upstreamTokenEndpoint: string) {
  const { access_token } = await fetch(upstreamTokenEndpoint, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "upstream:read" }),
  }).then((r) => r.json());
  return access_token; // Scoped to upstream, NOT the client's token
}
```

**Correct -- discovery, registration, and incremental scope consent:**
```typescript
// 6. Protected Resource Metadata discovery (RFC 9728)
async function discoverAuthServer(mcpServerUrl: string) {
  const origin = new URL(mcpServerUrl).origin;
  const meta = await fetch(`${origin}/.well-known/oauth-protected-resource`).then((r) => r.json());
  const asUrl = meta.authorization_servers[0];
  // Try OAuth 2.0 AS Metadata, then OIDC Discovery
  for (const p of ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"]) {
    const res = await fetch(`${asUrl}${p}`);
    if (res.ok) return res.json();
  }
  throw new Error("No authorization server metadata found");
}

// 7. Dynamic Client Registration (RFC 7591) — fallback when no pre-registration
async function registerClient(registrationEndpoint: string) {
  return fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "My MCP Client",
      redirect_uris: ["http://127.0.0.1:3000/callback"],
      grant_types: ["authorization_code"],
      token_endpoint_auth_method: "none",
    }),
  }).then((r) => r.json());
}

// 8. Incremental scope consent — handle 403 insufficient_scope
function handleInsufficientScope(wwwAuth: string) {
  const match = wwwAuth.match(/scope="([^"]+)"/);
  if (match) return match[1].split(" "); // Re-authorize with these scopes
}
```

**Correct -- OAuth URL paste fallback (headless/SSH environments):**
```typescript
// 9. When browser can't open (SSH, containers, headless), print URL for manual paste
async function authorizeWithFallback(authUrl: string) {
  const canOpenBrowser = process.env.DISPLAY || process.platform === "darwin";
  if (canOpenBrowser) {
    await open(authUrl); // Opens default browser
  } else {
    // Fallback: print URL for user to paste in their local browser
    console.log("\nOpen this URL in your browser to authorize:");
    console.log(`\n  ${authUrl}\n`);
    console.log("After authorizing, paste the callback URL here:");
    const callbackUrl = await readline.question("> ");
    const code = new URL(callbackUrl).searchParams.get("code");
    if (!code) throw new Error("No authorization code found in callback URL");
    return code;
  }
}
```

**Key rules:**
- PKCE with S256 is mandatory; refuse to proceed if AS lacks `code_challenge_methods_supported`
- Include `resource` parameter (RFC 8707) in both authorization and token requests, set to the MCP server's canonical URI
- MCP servers MUST validate the `aud` claim matches their own URI — reject all other tokens
- NEVER pass the client's access token to upstream APIs (confused deputy); obtain a separate token via client credentials or token exchange (RFC 8693)
- Use Protected Resource Metadata (RFC 9728) for AS discovery; support both OAuth 2.0 AS Metadata and OIDC Discovery
- Prefer Client ID Metadata Documents over Dynamic Client Registration (RFC 7591) for new implementations
- Handle `403 insufficient_scope` by re-authorizing with scopes from the `WWW-Authenticate` header
- For high-security deployments, bind tokens to client certificates via mTLS (RFC 8705) to prevent token theft and replay

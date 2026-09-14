// Optional agent identity for the OrchestKit docs API.
//
// The API stays public and anonymous: every read an agent can make with a
// bearer it can also make without one. What a bearer adds is a stable
// registration id the agent can read back at GET /agent/identity, minted by
// POST /agent/identity (the auth.md agentic-registration "identity endpoint").
//
// Because identity is optional, the 401 challenge is narrow on purpose:
//   - a request that presents a bearer this service did not issue, or one
//     that has expired, gets 401 + `WWW-Authenticate: Bearer ... resource_metadata`
//     (RFC 6750 invalid_token, RFC 9728 discovery hint);
//   - GET /agent/identity with no bearer gets the same challenge, because
//     that endpoint has nothing to say without an identity;
//   - an anonymous request anywhere else is answered exactly as before.
// An always-on 401 hint on a site with nothing protected is a lie that
// scored once already (portfolio GH-670). See docs/adr/optional-agent-identity.md.
//
// Token shape: a compact HS256 JWT, `typ: oauth-id-jag+jwt` (the type the
// auth.md registration flow returns), issuer and audience both this origin,
// `sub` the registration id. Everything here is Web Crypto so the same code
// runs in middleware (edge) and in route handlers (node). Verification is
// async for that reason; middleware only awaits it when a bearer is present.

import { SITE } from "@/lib/constants";

export const ISSUER = SITE.domain;
export const AUDIENCE = SITE.domain;
export const PRM_URL = `${SITE.domain}/.well-known/oauth-protected-resource`;
export const AS_METADATA_URL = `${SITE.domain}/.well-known/oauth-authorization-server`;
export const IDENTITY_ENDPOINT = `${SITE.domain}/agent/identity`;
export const IDENTITY_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id-jag";
export const JWT_TYP = "oauth-id-jag+jwt";
// The one scope this API has. Anonymous callers hold it too; the bearer does
// not widen it. Listed so PRM scopes_supported and the token agree.
export const SCOPES = ["docs.read"] as const;
export const ASSERTION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type IdentityClaims = {
	iss: string;
	aud: string;
	sub: string;
	iat: number;
	exp: number;
	scope: string;
	registration_type: "anonymous";
};

export type VerifyFailure = "malformed" | "invalid_signature" | "expired" | "wrong_issuer";

export type VerifyResult =
	| { ok: true; claims: IdentityClaims }
	| { ok: false; reason: VerifyFailure };

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
	const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
	try {
		const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
		const out = new Uint8Array(new ArrayBuffer(bin.length));
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	} catch {
		return null;
	}
}

function b64urlJson(value: unknown): string {
	return b64url(enc.encode(JSON.stringify(value)));
}

// The signing key. Set AGENT_IDENTITY_SECRET in the deployment to make the
// assertion unforgeable. Without it the key is derived from a fixed phrase,
// and that is stated rather than hidden: the assertion grants nothing an
// anonymous caller lacks, so forging one is equivalent to registering
// anonymously, which is open to everyone. The override exists so that if a
// privilege ever attaches to identity, the key can be made private without
// changing the token format.
const FALLBACK_KEY_PHRASE = `${SITE.domain}/agent/identity anonymous registration key v1`;

let keyPromise: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
	if (!keyPromise) {
		const material = process.env.AGENT_IDENTITY_SECRET ?? FALLBACK_KEY_PHRASE;
		keyPromise = crypto.subtle.importKey(
			"raw",
			enc.encode(material),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		);
	}
	return keyPromise;
}

/** Test hook: forget the cached key so an env change is picked up. */
export function resetSigningKeyForTests(): void {
	keyPromise = null;
}

function newRegistrationId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return `reg_${b64url(bytes)}`;
}

/** Mint a fresh anonymous identity assertion, or re-issue one for `sub`. */
export async function mintIdentityAssertion(opts: {
	sub?: string;
	now?: number;
	ttlSeconds?: number;
} = {}): Promise<{ token: string; claims: IdentityClaims }> {
	const iat = Math.floor((opts.now ?? Date.now()) / 1000);
	const claims: IdentityClaims = {
		iss: ISSUER,
		aud: AUDIENCE,
		sub: opts.sub ?? newRegistrationId(),
		iat,
		exp: iat + (opts.ttlSeconds ?? ASSERTION_TTL_SECONDS),
		scope: SCOPES.join(" "),
		registration_type: "anonymous",
	};
	const signingInput = `${b64urlJson({ alg: "HS256", typ: JWT_TYP })}.${b64urlJson(claims)}`;
	const sig = await crypto.subtle.sign("HMAC", await signingKey(), enc.encode(signingInput));
	return { token: `${signingInput}.${b64url(new Uint8Array(sig))}`, claims };
}

/** Verify a presented assertion: shape, signature, issuer/audience, expiry. */
export async function verifyIdentityAssertion(
	token: string,
	now: number = Date.now(),
): Promise<VerifyResult> {
	const parts = token.split(".");
	if (parts.length !== 3) return { ok: false, reason: "malformed" };
	const [h, p, s] = parts;
	const headerBytes = b64urlDecode(h);
	const payloadBytes = b64urlDecode(p);
	const sigBytes = b64urlDecode(s);
	if (!headerBytes || !payloadBytes || !sigBytes) return { ok: false, reason: "malformed" };
	let header: { alg?: unknown; typ?: unknown };
	let claims: Partial<IdentityClaims>;
	try {
		header = JSON.parse(dec.decode(headerBytes)) as { alg?: unknown; typ?: unknown };
		claims = JSON.parse(dec.decode(payloadBytes)) as Partial<IdentityClaims>;
	} catch {
		return { ok: false, reason: "malformed" };
	}
	if (header.alg !== "HS256" || header.typ !== JWT_TYP) return { ok: false, reason: "malformed" };
	if (typeof claims.sub !== "string" || typeof claims.exp !== "number" || typeof claims.iat !== "number") {
		return { ok: false, reason: "malformed" };
	}
	if (claims.iss !== ISSUER || claims.aud !== AUDIENCE) return { ok: false, reason: "wrong_issuer" };
	const valid = await crypto.subtle.verify(
		"HMAC",
		await signingKey(),
		sigBytes,
		enc.encode(`${h}.${p}`),
	);
	if (!valid) return { ok: false, reason: "invalid_signature" };
	if (claims.exp <= Math.floor(now / 1000)) return { ok: false, reason: "expired" };
	return { ok: true, claims: claims as IdentityClaims };
}

/**
 * Pull a bearer token out of an Authorization header. `null` when there is no
 * Authorization header or it uses another scheme (Basic, Signature): those are
 * not this API's business and never trigger the challenge. An empty
 * `Bearer` (scheme with nothing after it) counts as a presented, malformed token.
 */
export function bearerFromHeader(authorization: string | null): string | null {
	if (!authorization) return null;
	const m = /^\s*Bearer(?:\s+(.*))?$/i.exec(authorization);
	if (!m) return null;
	return (m[1] ?? "").trim();
}

/**
 * The RFC 6750 challenge with the RFC 9728 discovery hint. `error` is omitted
 * for the no-credential case (a protected endpoint reached anonymously), and is
 * `invalid_token` when a bearer was presented and rejected. RFC 6750 section 3.1
 * reserves error codes for the case where a token was actually sent.
 */
export function wwwAuthenticate(reason?: VerifyFailure): string {
	const parts = [`Bearer realm="${SITE.name} Docs API"`];
	if (reason) {
		parts.push('error="invalid_token"');
		parts.push(`error_description="${challengeDescription(reason)}"`);
	}
	parts.push(`resource_metadata="${PRM_URL}"`);
	return parts.join(", ");
}

export function challengeDescription(reason: VerifyFailure): string {
	switch (reason) {
		case "expired":
			return "The identity assertion has expired; register again at the identity endpoint.";
		case "wrong_issuer":
			return "The bearer was not issued by this origin.";
		case "invalid_signature":
			return "The bearer signature does not verify.";
		default:
			return "The bearer is not a well-formed identity assertion.";
	}
}

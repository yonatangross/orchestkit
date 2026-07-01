// Web Bot Auth key directory (RFC 9421 HTTP Message Signatures).
//
// Served at /.well-known/http-message-signatures-directory via a rewrite in
// next.config.mjs. Publishes OrchestKit's Ed25519 verification key in the
// spec-shaped Web Bot Auth format so an agent that signs its requests can be
// distinguished from a spoofer.
//
// Honest scope: this docs origin is anonymous read-only and does not currently
// operate a request-signing bot, so the key is a valid, unused verification key
// — an agent-awareness signal, not a load-bearing credential. The matching
// private key is held out-of-band (never committed); rotate by regenerating the
// pair and swapping `x` + `kid` below.
export const revalidate = false;

// Fixed validity window (epoch seconds) — deterministic, not build-time-derived.
const NBF = Math.floor(Date.parse("2026-07-01T00:00:00Z") / 1000);
const EXP = Math.floor(Date.parse("2027-07-01T00:00:00Z") / 1000);

export function GET() {
	const directory = {
		keys: [
			{
				kty: "OKP",
				crv: "Ed25519",
				x: "z5ufUBtSG2s-PEH_Sx2DYttadlsrQts4vAfLj2I2vUA",
				kid: "6a120f4f14168a35",
				use: "sig",
				alg: "EdDSA",
				nbf: NBF,
				exp: EXP,
			},
		],
	};

	return new Response(JSON.stringify(directory, null, 2), {
		headers: {
			"Content-Type":
				"application/http-message-signatures-directory+json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

# RFC: HMAC Signing for `@orchestkit/hook-contract`

**Status:** Draft
**Milestone:** M141-4
**Issue:** [#1805](https://github.com/yonatangross/orchestkit/issues/1805)
**Applies to:** `@orchestkit/hook-contract` (npm) and `orchestkit_hook_contract` (PyPI)
**Audience:** Implementers of signer/verifier in any language. This document is language-neutral.

---

## 1. Motivation

Webhook-style hook deliveries between OrchestKit components are HTTP POSTs carrying JSON payloads. The recipient MUST be able to verify (a) that the request originated from a holder of the shared secret, and (b) that the request is fresh (not a replayed capture). This RFC specifies a symmetric HMAC scheme — modeled on Stripe's webhook signature format — that is simple enough for cross-language parity and strong enough to defend against tampering and replay within a bounded time window.

Two implementations MUST agree byte-for-byte on the signature computation and on the failure-reason taxonomy: the TypeScript package and the Python sibling. Golden test vectors (Section 9) are the cross-language conformance contract.

---

## 2. Scope and Non-Goals

**In scope:** symmetric HMAC-SHA256 signing of HTTP request bodies, replay protection via timestamp windowing, multi-key rotation, a stable reason enum, and shared test vectors.

**Non-goals:** This RFC does NOT specify asymmetric signing (Ed25519, RSA, etc.), body encryption, per-event nonce stores, anti-replay caches, or transport-layer security. Replay protection is timestamp-window-based only — operators relying on stricter guarantees must add a nonce store at the application layer. TLS is assumed for confidentiality and is out of scope here.

---

## 3. Algorithm

**MAC:** `HMAC-SHA256` (RFC 2104, FIPS 198-1) with the shared secret as the key. Digest length is 32 bytes (256 bits); the hex encoding is 64 lowercase hex characters.

**Secret:** an opaque byte string. Implementers SHOULD warn (not reject) when the secret is shorter than 32 bytes — see `weak_secret` in Section 5.

---

## 4. Signing Input

The exact byte string fed to HMAC is:

```
signed_payload = timestamp_str || "." || body_bytes
```

where:

- `timestamp_str` is the unix epoch in **seconds**, formatted as a base-10 ASCII integer with **no leading zeros**, **no sign**, **no fractional component**, and **no padding** (e.g. `"1731000000"`, not `"01731000000"` or `"1731000000.0"`).
- `"."` is a single literal ASCII full-stop byte (`0x2E`).
- `body_bytes` is the **raw HTTP request body** as delivered on the wire — the exact byte sequence the recipient reads from the socket, before any deserialization, re-encoding, or whitespace normalization.

### 4.1 Why raw bytes, not canonical JSON

The signer signs the bytes it actually transmits. The verifier verifies the bytes it actually received. There is no intermediate "canonical form": no key reordering, no whitespace stripping, no re-serialization. This avoids the entire class of canonicalization bugs in which sender and receiver disagree on what the "real" payload is, and it allows the body to be any media type — not just JSON — without protocol changes.

Implementers MUST capture the raw body before any JSON parsing middleware mutates it. In environments where the framework only exposes a parsed object (and not the original bytes), the signer-side serialization MUST be the same byte sequence the HTTP client transmits — the simplest discipline is: **serialize once, sign the bytes, send the bytes**.

### 4.2 Content-Type

Senders SHOULD send `Content-Type: application/json` for JSON payloads. The Content-Type is **not** part of `signed_payload` and is not covered by the signature.

---

## 5. Reason Enum

The verifier's result is `{ valid: boolean, reason: Reason }`. `Reason` is a stable string enum; values MUST NOT be renamed or repurposed across versions.

| Reason | `valid` | Meaning |
|---|---|---|
| `ok` | `true` | Signature verified against a known scheme; timestamp within tolerance. |
| `missing_header` | `false` | The `X-CC-Hooks-Signature` header is absent or empty. |
| `malformed_header` | `false` | Header is present but cannot be parsed: `t` missing/non-integer, no scheme pair, duplicate/empty fields, or non-hex digest. |
| `stale` | `false` | `\|now - t\| > toleranceSec`. Covers both clock skew and replay. |
| `signature_mismatch` | `false` | Header parsed and timestamp fresh, but no provided scheme value matched the locally computed digest. |
| `weak_secret` | warn-only | Secret is shorter than 32 bytes. Verifiers SHOULD log/emit but MUST NOT fail verification on this alone by default. |

Implementations MUST return exactly one reason per call. When multiple conditions could apply, the precedence in Section 7 determines which wins.

---

## 6. Header Format

### 6.1 ABNF

```
signature-header = scheme-pair *( "," scheme-pair )
scheme-pair      = ( "t=" timestamp ) / ( scheme "=" hex-digest )
scheme           = "v" 1*DIGIT
timestamp        = 1*DIGIT                    ; unix seconds, base-10
hex-digest       = 64HEXDIG                   ; lowercase canonical; uppercase accepted
HEXDIG           = DIGIT / "a"-"f" / "A"-"F"
```

Exactly one `t=` pair is REQUIRED. At least one scheme pair (`v1=`, `v2=`, …) is REQUIRED. Whitespace around `,` and `=` is NOT permitted. Pair order is not significant.

### 6.2 Header name

`X-CC-Hooks-Signature`. Header name comparison is case-insensitive per RFC 7230.

### 6.3 Examples

Single scheme:

```
X-CC-Hooks-Signature: t=1731000000,v1=4c2f...e9
```

During key rotation, multiple schemes:

```
X-CC-Hooks-Signature: t=1731000000,v1=4c2f...e9,v2=8a01...b3
```

The verifier accepts the request if **any** scheme value matches a digest it can compute with **any** secret it currently holds. Unknown schemes (e.g. `v9=`) MUST be ignored without error — they are forward-compatibility room, not a malformed header.

### 6.4 Hex casing

`hex-digest` is canonically lowercase (`a`–`f`). Verifiers MUST accept uppercase as well; they SHOULD do so by lowercasing the parsed value before comparison, so the constant-time compare operates on a normalized form.

---

## 7. Verifier Algorithm

Inputs: `header` (string or null), `body_bytes` (bytes), `secret` (bytes), `now` (unix seconds, integer), `toleranceSec` (integer, default `300`).

```
function verify(header, body_bytes, secret, now, toleranceSec = 300):
    if header is null or header is empty:
        return { valid: false, reason: "missing_header" }

    parsed = parse_header(header)
    if parsed is error:
        return { valid: false, reason: "malformed_header" }
    if parsed.t is missing or parsed.t is not a base-10 integer:
        return { valid: false, reason: "malformed_header" }
    if parsed.schemes is empty:
        return { valid: false, reason: "malformed_header" }

    t = integer(parsed.t)
    if abs(now - t) > toleranceSec:
        return { valid: false, reason: "stale" }

    signed_payload = ascii(parsed.t_raw) || "." || body_bytes
    expected = lowercase_hex(hmac_sha256(secret, signed_payload))

    for scheme_value in parsed.schemes:
        candidate = lowercase(scheme_value)
        if candidate.length != 64:
            continue
        if constant_time_equal(candidate, expected):
            return { valid: true, reason: "ok" }

    return { valid: false, reason: "signature_mismatch" }
```

Notes on the pseudocode:

- **`parsed.t_raw`**: the literal characters of the timestamp as they appeared in the header, NOT a re-formatted integer. If the sender wrote `t=1731000000`, the signed input contains the ASCII bytes `1731000000`, not whatever `int(t).toString()` produces in your language. This matters if a buggy sender ever emits a non-canonical form — the verifier reproduces what the sender signed, then returns `malformed_header` only when parsing the integer fails outright.
- **Constant-time compare** MUST operate on equal-length byte strings of the same length (64 bytes after hex normalization). Compare candidates with length ≠ 64 are short-circuited above — those comparisons MUST NOT call the constant-time primitive with mismatched lengths (most stdlib implementations either throw or leak length info).
- **Multiple secrets** (rotation): the loop above is single-secret. For an N-secret verifier, compute `expected` once per secret and OR-match across the cartesian product of `(secrets × schemes)`. This MUST NOT short-circuit on the first mismatch in a way that leaks which secret matched — iterate the full set, then return.
- **Precedence**: `missing_header` > `malformed_header` > `stale` > `signature_mismatch`. The first condition that applies determines the reason.

---

## 8. Key Rotation

To rotate a secret without downtime:

1. **Overlap period.** Configure the signer with both `old_secret` (label `v1`) and `new_secret` (label `v2`). The signer emits both digests in every request: `t=...,v1=<old>,v2=<new>`.
2. **Roll verifiers.** Deploy verifiers configured to accept either secret. Order of acceptance does not matter — see "Multiple secrets" above.
3. **Drop the old.** Once all verifiers accept `v2`, remove `old_secret` from both signer and verifiers. Signer now emits only `t=...,v2=<new>`.

New schemes are introduced by bumping the integer suffix (`v1` → `v2` → `v3`). Implementations MUST NOT reuse a scheme label with a different secret across the rotation boundary; once `v2` has shipped publicly with secret X, it stays bound to secret X for the lifetime of that label.

---

## 9. Test Vectors

Golden vectors live at `test-vectors/signing/*.json` in the npm repo and are mirrored verbatim into the PyPI sibling. Both libraries' test suites consume the same files. Vector schema:

```json
{
  "name": "happy-path-v1",
  "secret_hex": "...",
  "body_b64": "...",
  "timestamp": 1731000000,
  "now": 1731000010,
  "tolerance_sec": 300,
  "header": "t=1731000000,v1=...",
  "expected": { "valid": true, "reason": "ok" }
}
```

Body is base64-encoded so vectors can carry arbitrary bytes (binary, trailing newlines, non-UTF-8) without JSON-string-escape ambiguity. The secret is hex-encoded for the same reason.

### 9.1 Required positive vectors

1. `happy-path-v1` — single scheme, fresh timestamp, valid digest.
2. `multi-scheme-rotation` — header with `v1` + `v2`, verifier holds `v2` secret only, accepts.
3. `uppercase-digest` — digest hex in uppercase, verifies successfully.
4. `non-json-body` — `body` is `text/plain` bytes, verifies successfully.
5. `body-with-trailing-newline` — body ends in `\n`; demonstrates raw-bytes discipline.

### 9.2 Required negative vectors

| Vector | Expected `reason` |
|---|---|
| `truncated-body` (last byte removed before verify) | `signature_mismatch` |
| `wrong-secret` | `signature_mismatch` |
| `stale-timestamp` (`now - t = tolerance + 1`) | `stale` |
| `future-timestamp` (`t - now = tolerance + 1`) | `stale` |
| `missing-v-scheme` (only `t=` in header) | `malformed_header` |
| `malformed-header-no-t` (only `v1=` in header) | `malformed_header` |
| `missing-header` (header field absent) | `missing_header` |
| `non-hex-digest` (`v1=zzzz…`) | `malformed_header` |

Each vector MUST be runnable in both TypeScript and Python with identical outputs. The cross-language parity gate (M141-6) consumes this directory.

---

## 10. Operational Guidance

- **Tolerance.** Default `300` seconds. Operators with synchronized clocks (NTP, cloud-provided time) MAY tighten to `60`. Going below `30` is hostile to mobile clients and clock drift across regions.
- **Secret length.** Use ≥ 32 bytes of cryptographic randomness. Anything shorter triggers `weak_secret` advisory.
- **Header capture.** Verifiers MUST read the header before any HTTP middleware that might strip custom `X-*` headers (some proxies do).
- **Body capture.** Verifiers MUST capture the raw body before JSON parsing. Frameworks that only expose parsed bodies require a raw-body buffering hook.
- **Logging.** Implementations MUST NOT log the secret. Logging the header (incl. digest) is acceptable — the digest is not reversible to the secret.

### 10.1 Implementation caps (cross-language parity)

These caps are operational, not grammatical — they apply uniformly to every conforming implementation so the parity gate stays meaningful.

- **Header length:** verifiers MUST reject headers longer than **8192 bytes** with `reason: "malformed_header"`. Legitimate multi-scheme rotation headers fit easily in ~200 bytes; this cap is a DoS guardrail.
- **Timestamp digit count:** verifiers MUST treat any `t=` value with more than **10 digits** as `reason: "stale"`. 10 digits covers unix seconds through year 2286 and fits within a JavaScript safe-integer Number. This guarantees TS and Python compute the same `abs(now - t)` for every accepted timestamp.
- **Weak-secret advisory ordering:** verifiers SHOULD emit the `weak_secret` callback only after the header parses successfully. Emitting it on malformed-header paths lets attackers probe verifier configuration via observed warning emissions.

---

## 11. Versioning

This RFC is versioned with the package's semver. Breaking changes to the signing input (Section 4) or header grammar (Section 6) require a new scheme label (`v2`+) and a deprecation cycle covering at least one minor release where both labels are accepted.

The `Reason` enum (Section 5) is append-only. New reasons MAY be added in a minor release; existing reason strings MUST NOT change meaning or be removed without a major version bump.

---

## Appendix A: Platform gap analysis

Snapshot of the existing `yonatan-hq/platform` consumer at the time this RFC was drafted. Filed for M141-8 (platform migration to this spec) to consume.

**Files:**

- `apps/api/app/core/security.py` (lines 19–38) — core verifier
- `apps/api/app/services/cc_hooks/security.py` (lines 7–12) — wrapper
- `apps/api/app/routes/cc_hooks/ingest.py` (lines 33–204) — route handler

**Current behavior:**

| Aspect | Platform today | This RFC | Gap |
|---|---|---|---|
| Header name | `X-CC-Hooks-Signature` | `X-CC-Hooks-Signature` | ✓ |
| Header value | `sha256=<hex>` (or `sha512=<hex>`) | `t=<unix>,v1=<hex>` | **breaking** — header format change |
| Signed input | raw `body_bytes` only | `<t>.<body_bytes>` | **breaking** — timestamp prefix |
| Algorithm | HMAC-SHA256 + HMAC-SHA512 | HMAC-SHA256 only | drop SHA512 path (it was for WAHA, not OrchestKit) |
| Constant-time compare | `hmac.compare_digest` ✓ | `constant_time_equal` | ✓ |
| Replay protection | none | timestamp ± 300s | **new** — RFC adds this |
| Multi-secret rotation | no | yes (multi-scheme) | **new** |
| Secret source | env `CC_HOOKS_SECRET_TOKEN` | implementation choice | ✓ |
| Min secret length | ≥16 chars (prod-validated) | ≥32 bytes (warn) | tighten to 32 |
| Failure HTTP status | 401 with reason string | implementation choice | ✓ |

**Existing test coverage (informational):**

- `apps/api/tests/unit/webhooks/test_signature.py` — unit suite on `sha256=`/`sha512=` parsing, empty body, wrong secret, malformed header.
- `apps/api/tests/unit/cc_hooks/test_cc_hooks_service.py` — CC-hook-specific path; dev-mode bypass when no secret configured.
- No timestamp-tolerance / replay tests (none implemented).

**Migration plan for M141-8:**

1. Add new verifier path that parses `t=...,v1=...` alongside the existing `sha256=` path.
2. Update OrchestKit-side signer to emit the new header.
3. Run both paths in parallel for one release; log when the legacy `sha256=` path is hit.
4. After zero legacy hits for 7 days, remove the legacy path.

---

## Appendix B: References

- Stripe Webhook Signing — header layout precedent: <https://stripe.com/docs/webhooks/signatures>
- RFC 2104 — HMAC: Keyed-Hashing for Message Authentication
- FIPS 198-1 — The Keyed-Hash Message Authentication Code (HMAC)
- RFC 7230 — HTTP/1.1 Message Syntax and Routing (header case-insensitivity)

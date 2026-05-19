# Changelog

All notable changes to `@orchestkit/hook-contract` are documented here.

## Unreleased — M141-4 (#1805)

### Added

- `docs/signing-rfc.md` — HMAC-SHA256 signing protocol RFC. Stripe-style `X-CC-Hooks-Signature: t=<unix>,v1=<hex>` header, 300s replay window, multi-scheme key rotation, stable `Reason` enum (`ok | missing_header | malformed_header | stale | signature_mismatch | weak_secret`). Language-neutral spec — npm and PyPI implementations MUST match byte-for-byte.
- `src/signing.ts` — pure verifier (`verify`) + signer (`sign`) using `node:crypto` (`createHmac`, `timingSafeEqual`). Multi-secret rotation support; never throws on bad header input — every failure maps to a `Reason`. Constant-time compare on equal-length buffers only.
- `HOOK_SIGNATURE_HEADER` constant for middleware authors.
- `test-vectors/signing/*.json` — 13 golden vectors (5 positive, 8 negative) shared with the PyPI sibling. Bodies are base64-encoded so vectors carry arbitrary bytes.
- `scripts/generate-signing-vectors.mjs` — deterministic regenerator for the vector files.
- `tests/signing.test.ts` — 24 tests including the full vector matrix, sign/verify round-trip, rotation array support, and weak-secret callback.

### Security hardening (from security-auditor review)

- Header length capped at 8192 bytes (returns `malformed_header`) — DoS guardrail.
- Timestamps with more than 10 digits returned as `stale` — prevents safe-integer overflow on the TS side and matches Python's `bigint` behavior so cross-language parity is preserved.
- `weak_secret` warning fires only after `parseHeader` succeeds — prevents info-disclosure via malformed-request probing.
- `matched = timingSafeEqual(...) || matched` uses explicit OR-assign so the non-short-circuit intent survives future refactors.
- `MIN_SECRET_BYTES` exported so callers can pre-validate at config time.

### Notes

- Platform consumer (`yonatan-hq/platform`) currently uses a non-conforming header (`X-CC-Hooks-Signature: sha256=<hex>` with no replay protection); migration is M141-8 (#1809). The RFC appendix captures the gap analysis.
- `@types/node` added as a devDependency for `node:crypto` types — still zero runtime deps.

## Unreleased — M141-2 step 1 (#1864)

### Added

- `spec/hook-events.spec.yml` — single source of truth for the 19 hook events. Per-event payload fields will be filled in by M141-2 steps 3-4.
- `packages/hook-contract/scripts/codegen.mjs` — node-only emitter (zero deps). Reads the spec, writes `events.generated.ts` + `schemas.generated.ts`. `--check` mode is the drift gate.
- `npm run codegen` — regenerate from spec.
- `npm run codegen:check` — validates committed `.generated.ts` files match the spec; runs automatically as `prebuild`.

### Changed

- `src/events.ts` and `src/schemas.ts` collapsed to one-line re-exports of the `.generated.ts` files. Public API (`@orchestkit/hook-contract/events`, etc.) stays stable.

### Not Yet (M141-2 steps 2-4)

- PyPI sibling package (`orchestkit-hook-contract`) emitted from the same spec.
- Per-event payload field schemas (currently still `payload: unknown`).
- Cross-language parity gate CI.

## 0.1.0 — 2026-05-18

### Added

- Initial scaffold (M141-1, #1802).
- `HOOK_EVENT_NAMES` — manually authored registry of the 19 Claude Code 2.1.71+ hook events.
- `HookEvent` discriminated union over the event tag (envelope-level).
- `HOOK_EVENT_SCHEMAS` — per-event JSON Schema (draft-07), envelope-level.
- `HOOK_EVENT_SCHEMA` — aggregate `oneOf` schema.
- `validateHookEvent(value)` / `isHookEvent(value)` — thin structural validator. Zero runtime deps.
- Dual ESM + CJS exports map.
- Vitest smoke suite (19 event coverage + validator paths).
- GHA workflow (`.github/workflows/hook-contract.yml`) — typecheck, test, `npm publish --dry-run` on `packages/hook-contract/**` changes.
- Workspace wiring in root `package.json` so `npm run build` from the repo root rebuilds OrchestKit *and* the contract package.

### Not Yet

- Per-event payload field schemas (M141-2 codegen).
- PyPI parity package (M141-2).
- Parity gate test (M141-2 cross-package CI check).

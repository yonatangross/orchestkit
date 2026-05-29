# Changelog

All notable changes to `orchestkit-hook-contract` are documented here.

## 0.1.1 — 2026-05-30

First lockstep release with the npm sibling (`@orchestkit/hook-contract@0.1.1`).
Ships the HMAC signing module — previously unreleased on PyPI — and the OIDC
release pipeline. `0.1.0` (2026-05-18) predated signing; `0.1.1` brings PyPI to
content + version parity with npm, both cut from `spec/hook-events.spec.yml`.

### Added

- HMAC signing module (M141-4, #1805): `sign()`, `verify()`, `Reason` literal, `VerifyResult` dataclass, `HOOK_SIGNATURE_HEADER`, `MIN_SECRET_BYTES`. Stdlib-only (`hmac` + `hashlib`). Mirrors the npm sibling byte-for-byte against the 13 shared golden vectors at `../hook-contract/test-vectors/signing/`. Spec at `../hook-contract/docs/signing-rfc.md`.
- 42 pytest cases for signing: vector-driven cross-language conformance + API-surface coverage (round-trip, missing/malformed/stale, weak-secret callback, key rotation, multi-scheme, 8192-byte DoS cap, 10-digit timestamp cap).
- `.github/workflows/publish-hook-contract-py.yml` — tag-driven PyPI release pipeline. Triggers on `hook-contract-py/v*` tags. Pipeline: preflight → build → test → publish-testpypi → smoke-testpypi → publish-pypi → github-release. Pattern adapted from Yonatan-HQ/core; uses public PyPI + OIDC trusted publishing.
- `packages/hook-contract-py/RELEASING.md` — release-flow documentation including the one-time Trusted Publisher setup on pypi.org and test.pypi.org.

### Released

- v0.1.0 is live on PyPI (manual bootstrap lineage). v0.1.1 is the first release cut via the OIDC pipeline, tagged alongside the npm sibling: `git tag hook-contract-py/v0.1.1 hook-contract-npm/v0.1.1 && git push origin --tags`.

## 0.1.0 — 2026-05-18

### Added

- Initial scaffold (M141-3, #1804).
- `HOOK_EVENT_NAMES` — 19-element registry of CC 2.1.71+ hook events.
- `HookEvent` Pydantic v2 envelope (`event`, `timestamp`, `session_id`, `cwd`, `payload`).
- Per-event Pydantic payload classes for 13 events: `PreToolUsePayload`, `PostToolUsePayload`, `PostToolUseFailurePayload`, `UserPromptSubmitPayload`, `NotificationPayload`, `PermissionRequestPayload`, `SubagentStartPayload`, `SubagentStopPayload`, `StopPayload`, `SessionStartPayload`, `PreCompactPayload`, `TeammateIdlePayload`, `TaskCompletedPayload`.
- `HOOK_EVENT_SCHEMAS` — per-event JSON Schema (draft-07), envelope + payload properties.
- `HOOK_EVENT_SCHEMA` — aggregate `oneOf` schema.
- `validate_hook_event(value)` / `is_hook_event(value)` — thin structural validator.
- Hand-rolled codegen at `scripts/codegen-py.py` reading `spec/hook-events.spec.yml` (same source as the npm sibling).
- Drift gate via `python scripts/codegen-py.py --check`.

### Not Yet (tracked in #1864)

- PyPI publish workflow (test-pypi → prod on tag).
- Cross-language parity gate vs `@orchestkit/hook-contract` (M141-6, #1807).
- Per-event payload schemas for the 6 envelope-only events (CC docs catching up).
- Platform consumer migration: yonatan-hq/platform swap from hand-written models (M141-8, #1809).

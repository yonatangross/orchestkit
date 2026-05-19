# Changelog

All notable changes to `orchestkit-hook-contract` are documented here.

## Unreleased — release-flow scaffolding

### Added

- `.github/workflows/publish-hook-contract-py.yml` — tag-driven PyPI release pipeline. Triggers on `hook-contract-py/v*` tags. Pipeline: preflight → build → test → publish-testpypi → smoke-testpypi → publish-pypi → github-release. Pattern adapted from Yonatan-HQ/core; uses public PyPI + OIDC trusted publishing.
- `packages/hook-contract-py/RELEASING.md` — release-flow documentation including the one-time Trusted Publisher setup on pypi.org and test.pypi.org.

### Not Yet

- v0.1.0 is not yet on PyPI. After this PR merges and the Trusted Publisher entries are registered, `git tag hook-contract-py/v0.1.0 && git push origin hook-contract-py/v0.1.0` cuts the first release.

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

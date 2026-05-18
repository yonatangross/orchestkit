# Changelog

All notable changes to `@orchestkit/hook-contract` are documented here.

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

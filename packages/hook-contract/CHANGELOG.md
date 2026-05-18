# Changelog

All notable changes to `@orchestkit/hook-contract` are documented here.

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

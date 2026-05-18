# @orchestkit/hook-contract

Hook event contract for OrchestKit — types, JSON schemas, and a thin validation helper.

**Zero runtime dependencies.** This package is the single source of truth (npm side) for what counts as a Claude Code hook event in the OrchestKit ecosystem.

## Status

- **M141-1**: scaffold (this version, `0.1.0`) — manually authored event registry, envelope-level schemas, structural validator.
- **M141-2** (next): replace hand-written `events.ts` with codegen output from a shared spec; add PyPI parity package; CI parity gate.
- **M142**: migrate OrchestKit hooks to typed events.

## Install

```bash
npm install @orchestkit/hook-contract
```

Workspace consumers inside the monorepo get it linked automatically via `npm install` at the repo root.

## Usage

```ts
import {
  HookEvent,
  HOOK_EVENT_NAMES,
  validateHookEvent,
} from '@orchestkit/hook-contract';

const payload: unknown = JSON.parse(rawBody);
const result = validateHookEvent(payload);
if (!result.valid) {
  // reject with structural errors
  console.error(result.errors);
  return;
}
// result.event is now a typed HookEventName
```

### Sub-path imports

For tree-shaking-conscious consumers:

```ts
import { HOOK_EVENT_NAMES } from '@orchestkit/hook-contract/events';
import { HOOK_EVENT_SCHEMAS } from '@orchestkit/hook-contract/schemas';
import { validateHookEvent } from '@orchestkit/hook-contract/validate';
```

### JSON Schemas

`HOOK_EVENT_SCHEMAS` is keyed by event name. `HOOK_EVENT_SCHEMA` is a `oneOf` over all 19 variants. Validate with any draft-07 JSON Schema validator (ajv etc.) — we deliberately don't bundle one to avoid version coupling.

## Out of scope (M141-1)

- Per-event payload field schemas — envelope only for now.
- Codegen pipeline — M141-2.
- PyPI mirror — M141-2.
- HMAC signing protocol — separate RFC.

## Develop

```bash
cd packages/hook-contract
npm test          # vitest
npm run build     # tsc → dist/esm + dist/cjs
npm run typecheck
```

From repo root:

```bash
npm run build     # rebuilds OrchestKit plugins AND this package
```

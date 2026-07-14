# @orchestkit/hook-contract

Hook event contract for OrchestKit — types, JSON schemas, and a thin validation helper.

**Zero runtime dependencies.** This package is the single source of truth (npm side) for what counts as a Claude Code hook event in the OrchestKit ecosystem.

## Status

- **M141-1**: scaffold (`0.1.0`) — manually authored event registry, envelope-level schemas, structural validator.
- **M141-2**: spec-driven codegen + drift gate; per-event payload schemas.
- **M141-3**: PyPI sibling (`orchestkit_hook_contract`).
- **M141-4** (this change): HMAC signing protocol + reference verifier. Spec at [`docs/signing-rfc.md`](docs/signing-rfc.md).
- **M141-6**: cross-language parity gate (CI).
- **M141-8** (planned): migrate `yonatan-hq/platform` consumer to this signing spec.
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

### HMAC signing (M141-4)

Sign hook deliveries on the sender and verify on the receiver. Full spec: [`docs/signing-rfc.md`](docs/signing-rfc.md).

```ts
import {
  sign,
  verify,
  HOOK_SIGNATURE_HEADER,
} from '@orchestkit/hook-contract';

// Sender
const body = Buffer.from(JSON.stringify(event), 'utf8');
const header = sign(body, process.env.HOOK_SECRET!);
await fetch(url, {
  method: 'POST',
  headers: { [HOOK_SIGNATURE_HEADER]: header, 'Content-Type': 'application/json' },
  body,
});

// Receiver (Express / Fastify / etc. — capture raw body)
const result = verify(
  req.header(HOOK_SIGNATURE_HEADER),
  req.rawBody, // Uint8Array — NOT JSON.stringify(req.body)
  process.env.HOOK_SECRET!,
  { toleranceSec: 300 },
);
if (!result.valid) {
  return res.status(401).json({ error: result.reason });
}
```

Key rotation: pass an array of secrets to `verify(...)`; any match wins. Signer emits multiple schemes during the overlap (`t=...,v1=<old>,v2=<new>`).

## Examples

[`examples/generic-client/`](examples/generic-client/) is a minimal, framework-portable HTTP sink that consumes signed hook events — proof the contract is usable beyond the yonatan-hq platform. It exports a side-effect-free `createApp(secret)` factory (Express) that:

- captures the **raw request bytes** before parsing (HMAC is over the exact bytes);
- verifies `X-CC-Hooks-Signature` with `verify()` (never throws — branches on `reason`);
- returns `202` on accept, `400` on missing/malformed header or invalid JSON, `401` on stale/mismatch.

```bash
cd examples/generic-client
npm install && npm test    # vitest + supertest against createApp()
```

## OpenAPI

[`openapi/sink.yaml`](openapi/sink.yaml) is an OpenAPI **3.1** description of the `POST /hooks/ingest` sink: the `X-CC-Hooks-Signature` security scheme, a `oneOf` request body discriminated on `event` (mirroring the canonical `HOOK_EVENT_SCHEMAS`), and the `202`/`400`/`401`/`429` response shapes. It lints clean under both `@redocly/cli` and `@stoplight/spectral-cli` (ruleset in [`openapi/.spectral.yaml`](openapi/.spectral.yaml)):

```bash
npx @redocly/cli lint openapi/sink.yaml
npx @stoplight/spectral-cli lint openapi/sink.yaml -r openapi/.spectral.yaml
```

## Out of scope

- Asymmetric signing (Ed25519, RSA) — see RFC §2 non-goals.
- Per-event nonce store / anti-replay cache — timestamp-window-only.
- Transport-layer security — assume TLS.

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

# Generic hook-sink client

A minimal, framework-portable example of consuming OrchestKit hook events over
HTTP — proof that `@orchestkit/hook-contract` is usable beyond the yonatan-hq
platform (#1808).

`server.ts` exports a side-effect-free factory `createApp(secret)` returning a
configured Express app that:

1. captures the **raw request bytes** (`express.raw`) — HMAC is computed over the
   exact bytes, so any JSON parse must happen *after* verification;
2. verifies the `X-CC-Hooks-Signature` header with `verify()` from
   `@orchestkit/hook-contract/signing` (never throws — branch on `reason`);
3. dispatches on `hook_event` (validated against `HOOK_EVENT_NAMES`);
4. acks `202` fast and does real work off the request path.

The port is bound only when the module is executed directly, so `createApp()`
can be exercised in-process with supertest — see `__tests__/server.test.ts`.

## Install & test

```bash
npm install     # express + @orchestkit/hook-contract (linked) + test deps
npm test        # vitest + supertest against createApp()
```

## Run

```bash
export HOOK_SECRET=$(openssl rand -hex 32)     # 64 hex chars = 32 bytes
npm start                                      # tsx server.ts → listens on :8787
```

Send a signed request (sign with the same secret using `sign()` from the
package's `/signing` export, or your platform's signer):

```bash
# body must be the EXACT bytes you signed
curl -sS localhost:8787/hooks/ingest \
  -H "X-CC-Hooks-Signature: t=$(date +%s),v1=<hex-hmac>" \
  -H 'Content-Type: application/json' \
  --data-binary '{"hook_event":"PreToolUse","tool_name":"Bash","session_id":"demo"}'
```

## Responses

| Code | When |
|------|------|
| `202` | accepted (queued) |
| `400` | `missing_header` / `malformed_header` / invalid JSON |
| `401` | `stale` / `signature_mismatch` / `weak_secret` |

## Notes

- This is a **reference** — copy it into your project. It is intentionally not
  part of the package build (no bundled `express`), so the package stays
  zero-runtime-deps-beyond-pydantic on the Python side and dependency-light on npm.
- The wire contract (header format, replay window, `Reason` enum) is specified in
  [`docs/signing-rfc.md`](../../docs/signing-rfc.md); the request/response shape is
  in [`openapi/sink.yaml`](../../openapi/sink.yaml).

# HTTP Hooks and Streaming Telemetry (CC 2.1.63+)

> **Channel 1 is gone.** The per-event native HTTP hook generator (`generate-http-hooks`,
> `npm run generate:http-hooks`) was deprecated in #1861 and deleted in #3867. Nothing in
> OrchestKit writes `type: "http"` entries into `settings.local.json` any more, and
> `hooks.json` ships zero of them.

## Why channel 1 died

OrchestKit used to emit hook events over two channels that POSTed to the **same**
downstream endpoint, so every event was delivered **twice**:

- **Channel 1**: 19 per-event `type: "http"` entries generated into `settings.local.json`
  (Bearer auth, no batching, no retry, no dedupe).
- **Channel 4**: the HMAC-signed `http-sink` (batched, retried with exponential backoff
  and jitter, circuit-broken).

The duplication drove a **61% rate-limit reject rate** on the yonatan-hq platform
(2026-05-13) and forced a per-session bucketing workaround server-side that existed only
to absorb the double-send. Channel 4 is canonical: the hook contract is published
(`@orchestkit/hook-contract` / `orchestkit-hook-contract` on PyPI, M141) and the sink's
HMAC format is verified end-to-end by the platform consumer.

## The one channel that ships: `http-sink`

| | `http-sink` |
|---|---|
| Source | `src/hooks/src/lib/http-sink.ts`, registered by `lib/sink-registry.ts` |
| Activation | `webhookUrl` in `.claude/orchestration/config.json` (or `ORCHESTKIT_HOOK_URL`) AND `ORCHESTKIT_HOOK_TOKEN` exported |
| Auth | HMAC-SHA256 signed payloads (`X-CC-Hooks-Signature`) plus the bearer token |
| Delivery | Batched, retry with exponential backoff and jitter, circuit breaker |
| Extra sinks | `telemetry.sinks[]` in `.claude/settings.local.json`: `{ "type": "http", "url", "token", "hmacSecret"? }` |

The SessionEnd `lifecycle/usage-summary-reporter` hook POSTs the enriched session summary
to the same `webhookUrl` with the same token.

## Quick Start

```bash
# 1. Save the endpoint (never committed)
#    .claude/orchestration/config.json  ->  { "webhookUrl": "https://your-api.com/hooks" }

# 2. Export the token in the shell that launches Claude Code
export ORCHESTKIT_HOOK_TOKEN=your-secret-token
```

## CC constraint: no env var placeholders in `url`

CC 2.1.71+ validates `url` fields as proper URLs *before* expanding `${ENV_VAR}`, so
`"url": "${ORCHESTKIT_HOOK_URL}"` fails validation and breaks ALL hooks in that file,
command hooks included. This is why OrchestKit ships zero `type: "http"` hooks in plugin
`hooks.json` and why the sink reads its URL from config at runtime instead. Env var
expansion in `headers` (e.g. `$ORCHESTKIT_HOOK_TOKEN`) works; only the `url` field is
affected. If you ever hand-write a `type: "http"` hook, give it a literal URL.

## Leftover channel-1 entries

If a previous install ran the generator, `settings.local.json` may still carry up to 19
`type: "http"` entries pointing at `<url>/cc-event`. Remove them: they double-send every
event and carry a Bearer token with no batching or retry. The `lifecycle/hook-token-check`
SessionStart hook still warns when such an entry references `$ORCHESTKIT_HOOK_TOKEN` and
the variable is unset in the launching shell.

## Security

- Token lives in the env var only, never in config files
- Payloads are HMAC-SHA256 signed
- HTTP errors are non-blocking (graceful degradation); the local JSONL sink is always on
- Security hooks (blockers, scanners, guards) stay `type: "command"`, never HTTP

## Disabling

Remove `webhookUrl` from `.claude/orchestration/config.json` (or unset
`ORCHESTKIT_HOOK_TOKEN`). Plugin command hooks continue working independently.

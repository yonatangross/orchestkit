# HTTP Hooks (CC 2.1.63+)

OrchestKit supports `type: "http"` hooks that POST JSON to a configurable endpoint. These run **alongside** existing command hooks (dual mode) — not instead of them.

## Quick Start

Set two environment variables in your shell profile:

```bash
export ORCHESTKIT_HOOK_URL=http://localhost:8000/api/v1/cc-hooks
export ORCHESTKIT_HOOK_TOKEN=your-secret-token
```

If `ORCHESTKIT_HOOK_URL` is not set, HTTP hooks are silently skipped. Zero change for users who don't configure them.

## User Tiers

| Tier | Setup | What You Get |
|------|-------|-------------|
| **1. Default** | Nothing | All hooks local (command only), JSONL analytics |
| **2. Direct** | 2 env vars | HTTP hooks POST to your endpoint (Langfuse, Datadog, custom) |
| **3. Full HQ** | Backend + env vars | Langfuse traces + pgvector RAG + Prometheus + MCP read-back |

## Active HTTP Hooks (4)

| Hook | Event | Endpoint | Purpose |
|------|-------|----------|---------|
| session-metrics | SessionEnd | `/session-end` | Session duration, tool counts, agent spawns |
| pattern-sync | SessionEnd | `/pattern-sync` | Learned patterns for cross-project search |
| worktree-create | WorktreeCreate | `/worktree` | Worktree lifecycle tracking |
| worktree-remove | WorktreeRemove | `/worktree` | Worktree lifecycle tracking |

## hooks.json Format

```json
{
  "type": "http",
  "url": "${ORCHESTKIT_HOOK_URL}/session-end",
  "timeout": 5000,
  "run_on_fail": true,
  "headers": {
    "Authorization": "Bearer $ORCHESTKIT_HOOK_TOKEN"
  },
  "allowedEnvVars": ["ORCHESTKIT_HOOK_TOKEN", "ORCHESTKIT_HOOK_URL"]
}
```

## Payload Format

All hooks POST JSON with `Content-Type: application/json`:

```json
{
  "session_id": "abc-123",
  "hook_event": "SessionEnd",
  "project_hash": "a3f5b8e9c2d1",
  "timestamp": "2026-02-28T06:15:00Z",
  ...event-specific fields
}
```

Responses: empty `{}` for fire-and-forget, or `{ "additionalContext": "..." }` for context injection.

## Security

- Bearer token auth via `ORCHESTKIT_HOOK_TOKEN`
- `allowedEnvVars` whitelist prevents env var leakage
- `project_hash` is a one-way hash — project paths never sent
- HTTP errors are non-blocking (graceful degradation)
- Security hooks (blocker, scanner, guard) stay `type: "command"` — never HTTP

## Direct-to-Langfuse Setup

POST session events directly to Langfuse Cloud without middleware:

```bash
export ORCHESTKIT_HOOK_URL=https://cloud.langfuse.com/api/public
export ORCHESTKIT_HOOK_TOKEN=pk-lf-your-public-key
```

## Disabling HTTP Hooks

Unset the env var:

```bash
unset ORCHESTKIT_HOOK_URL
```

Or remove individual HTTP hook entries from your hooks.json override.

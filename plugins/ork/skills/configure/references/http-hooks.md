# HTTP Hooks — Dual-Channel Telemetry (CC 2.1.63+)

OrchestKit supports two parallel channels for streaming session data:

- **Channel 1: Native HTTP hooks** — CC POSTs raw JSON to HQ for ALL 18 event types (zero overhead)
- **Channel 2: Command hooks** — Node spawn for enriched reporting (token usage, metrics, HMAC auth)

## Quick Start

```bash
# 1. Generate native HTTP hook config for all 18 events
npm run generate:http-hooks -- https://your-api.com/hooks --write

# 2. Set auth token
export ORCHESTKIT_HOOK_TOKEN=your-secret-token
```

This writes to `.claude/settings.local.json` (not committed). CC merges plugin `hooks.json` + user `settings.local.json` — both channels fire in parallel.

> **Known Limitation (CC 2.1.71+):** HTTP hooks must use real URLs, not env var placeholders. CC validates `url` fields as proper URLs *before* expanding `${ENV_VAR}` — so `"url": "${ORCHESTKIT_HOOK_URL}"` fails validation and breaks ALL hooks. This is why HTTP hooks are generated per-user with real URLs (not shipped in the plugin). Env var expansion in `headers` (e.g., `$ORCHESTKIT_HOOK_TOKEN`) works fine — only the `url` field is affected.

## User Tiers

| Tier | Setup | What You Get |
|------|-------|-------------|
| **1. Default** | Nothing | All hooks local (command only), JSONL analytics |
| **2. Streaming** | Generator + env var | All 18 events stream via native HTTP (zero overhead) |
| **3. Full HQ** | Both channels | Real-time stream + enriched summaries (token usage, metrics) |

## Channel Comparison

| | Channel 1: Native HTTP | Channel 2: Command |
|---|---|---|
| Coverage | All 18 events, real-time | SessionEnd + worktree only |
| Overhead | Zero (CC native) | Node spawn per event |
| Data | Raw CC payload | Enriched (tokens, metrics, branch) |
| Auth | Bearer token | HMAC-SHA256 |
| Config | `.claude/settings.local.json` | `hooks.json` (plugin-level) |

## Generator CLI

```bash
# Print to stdout
npm run generate:http-hooks -- https://your-api.com/hooks

# Write to default location (.claude/settings.local.json)
npm run generate:http-hooks -- https://your-api.com/hooks --write

# Dry run (preview without writing)
npm run generate:http-hooks -- https://your-api.com/hooks --dry-run

# Custom path
npm run generate:http-hooks -- https://your-api.com/hooks --write --path ~/.claude/settings.local.json
```

The generator is idempotent — running twice replaces existing cc-event entries without duplicating.

## Generated Config Format

Each event type gets a native HTTP hook entry:

```json
{
  "hooks": {
    "SessionStart": [{
      "type": "http",
      "url": "https://your-api.com/hooks/cc-event",
      "headers": { "Authorization": "Bearer $ORCHESTKIT_HOOK_TOKEN" },
      "allowedEnvVars": ["ORCHESTKIT_HOOK_TOKEN"],
      "timeout": 5
    }],
    "UserPromptSubmit": [{ "...same..." }],
    "PreToolUse": [{ "...same..." }],
    "...": "...all 18 events..."
  }
}
```

## What HQ Gets Per Event (natively from CC)

| Event | Key Data |
|-------|----------|
| SessionStart | model, source, cwd, permission_mode |
| UserPromptSubmit | prompt text |
| PreToolUse | tool_name, tool_input |
| PostToolUse | tool_name, tool_input, tool_result |
| PostToolUseFailure | tool_name, error |
| SubagentStart/Stop | agent lifecycle |
| Stop | transcript_path |
| WorktreeCreate/Remove | worktree lifecycle |
| SessionEnd | session cleanup |

## Security

- Bearer token auth via `ORCHESTKIT_HOOK_TOKEN`
- `allowedEnvVars` whitelist prevents env var leakage
- HTTP errors are non-blocking (graceful degradation)
- Security hooks (blocker, scanner, guard) stay `type: "command"` — never HTTP
- Token never stored in config files — env var only

## Disabling

Remove the generated entries from `.claude/settings.local.json`, or delete the file entirely. Plugin command hooks continue working independently.

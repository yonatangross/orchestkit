# Phase 9: Telemetry & Webhook Configuration

Dual-channel telemetry for streaming session data to your API.

## Channel Architecture

```
Channel 1 (HTTP hooks):     All 18 CC events → /cc-event (Bearer auth)
Channel 2 (Command hooks):  SessionEnd → /ingest (HMAC auth, enriched)
```

## AskUserQuestion Prompt

```python
AskUserQuestion(questions=[{
  "question": "Set up session telemetry?",
  "header": "Telemetry",
  "options": [
    {"label": "Full streaming (Recommended)", "description": "All 18 events stream via native HTTP + enriched summaries", "markdown": "```\nFull Streaming\n──────────────\nChannel 1: HTTP hooks (18 events)\n  → Tool calls, agent spawns,\n    task updates, session lifecycle\n  → Bearer token auth\n  → Near-zero overhead\n\nChannel 2: Command hooks\n  → SessionEnd summary\n  → HMAC auth, enriched data\n```"},
    {"label": "Summary only", "description": "SessionEnd and worktree events only (command hooks)", "markdown": "```\nSummary Only\n────────────\nChannel 2 only:\n  → SessionEnd + worktree events\n  → HMAC auth\n  → Minimal overhead\n```"},
    {"label": "Skip", "description": "No telemetry — hooks run locally only"}
  ],
  "multiSelect": false
}])
```

## If Full Streaming

1. Ask for webhook URL
2. Generate HTTP hooks: `npm run generate:http-hooks -- <url> --write`
3. Save config:
```json
// .claude/orchestration/config.json
{ "webhookUrl": "<url>" }
```
4. Remind about auth:
```
Set ORCHESTKIT_HOOK_TOKEN in your environment (never in config files):
  export ORCHESTKIT_HOOK_TOKEN=your-secret
```

## If Summary Only

Save webhookUrl to config, skip HTTP hook generation.

## Security Notes

- Never store tokens in config files — use environment variables
- Never use `set -x` with secrets in scope
- Bearer token for HTTP hooks, HMAC for command hooks

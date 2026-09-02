# Phase 9: Telemetry & Webhook Configuration

Streaming session data to your API over one channel.

## Channel Architecture

```
http-sink (built-in):        analytics events -> <webhookUrl>  (HMAC-SHA256, batched, retry, circuit breaker)
usage-summary-reporter:      SessionEnd summary -> <webhookUrl> (same URL + token)
```

Both activate when `webhookUrl` is set in `.claude/orchestration/config.json` (or `ORCHESTKIT_HOOK_URL`) AND `ORCHESTKIT_HOOK_TOKEN` is exported in the launching shell. Extra sinks can be declared under `telemetry.sinks[]` in `.claude/settings.local.json` (`{ "type": "http", "url", "token", "hmacSecret"? }`).

The per-event native HTTP hook generator (`generate-http-hooks`, channel 1) was deleted in #3867. Nothing writes `type: "http"` entries into `settings.local.json`; do not add them by hand for telemetry.

## AskUserQuestion Prompt

```python
AskUserQuestion(questions=[{
  "question": "Set up session telemetry?",
  "header": "Telemetry",
  "options": [
    {"label": "Stream to a webhook", "description": "Analytics events and SessionEnd summaries POST to your endpoint via the HMAC-signed http-sink"},
    {"label": "Skip", "description": "No telemetry, hooks run locally only"}
  ],
  "multiSelect": false
}])
```

## If Streaming

1. Ask for webhook URL
2. Save config:
```json
// .claude/orchestration/config.json
{ "webhookUrl": "<url>" }
```
3. Remind about auth:
```
Set ORCHESTKIT_HOOK_TOKEN in your environment (never in config files):
  export ORCHESTKIT_HOOK_TOKEN=your-secret
```

## Security Notes

- Never store tokens in config files, use environment variables
- Never use `set -x` with secrets in scope
- Payloads are HMAC-SHA256 signed (`X-CC-Hooks-Signature`)

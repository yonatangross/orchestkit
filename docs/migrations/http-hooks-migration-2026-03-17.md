# HTTP Hooks Migration — curl to Native type:http

**Date:** 2026-03-17
**Branch:** feat/cc-2177-adoption
**CC Version:** 2.1.77

## Summary

Migrated global CC hooks from `type: "command"` (curl + python3 spawn) to `type: "http"` (CC native POST). This eliminates ~200ms process spawn overhead per event and expands coverage from 4 events to 19.

## What Changed

### ~/.claude/settings.json (custom bash hooks — kept)

| Event | Hook | Status |
|-------|------|--------|
| SessionStart | `session-start-context.sh` | Kept |
| UserPromptSubmit | `user-prompt-context.sh` | Kept |
| PostToolUse[Bash] | `track-commit-progress.sh` | Kept |
| Stop | `hq-session-summary.sh` | Kept |
| SessionStart | curl → cc-event | **Removed** |
| UserPromptSubmit | curl → cc-event | **Removed** |
| Stop | curl → cc-event | **Removed** |
| SubagentStop | curl → cc-event | **Removed** |

### ~/.claude/settings.local.json (native HTTP hooks — new)

19 events, all `type: "http"` pointing to `http://hq-api.localhost:1355/api/hooks/cc-event`:

| Event | Previously Covered | New |
|-------|-------------------|-----|
| SessionStart | Yes (curl) | type:http |
| UserPromptSubmit | Yes (curl) | type:http |
| Stop | Yes (curl) | type:http |
| SubagentStop | Yes (curl) | type:http |
| PreToolUse | **No** | type:http |
| PostToolUse | **No** | type:http |
| PostToolUseFailure | **No** | type:http |
| PermissionRequest | **No** | type:http |
| SubagentStart | **No** | type:http |
| SessionEnd | **No** | type:http |
| Setup | **No** | type:http |
| Notification | **No** | type:http |
| PreCompact | **No** | type:http |
| TeammateIdle | **No** | type:http |
| TaskCompleted | **No** | type:http |
| InstructionsLoaded | **No** | type:http |
| WorktreeCreate | **No** | type:http |
| WorktreeRemove | **No** | type:http |
| ConfigChange | **No** | type:http |

### Dropped Fields

- `cc_profile` — was injected by python3 into the JSON payload. Not present in native HTTP hooks. API uses `cwd` for project identification (already the primary path). `cc_profile` was optional enrichment — API handles its absence via `.get("cc_profile")` returning None.

### Auth Change

- **Before:** Token read from file `~/.claude/hooks/.cc-hooks-token` via `$(cat ...)`
- **After:** Token from env var `$ORCHESTKIT_HOOK_TOKEN` via `allowedEnvVars`
- Both resolve to the same token value.

## Validation Checklist

All 7 active projects must be validated. For each project, start a new CC session and verify the HQ API receives events.

### Quick Validation Command

```bash
# Check HQ API received events in the last 5 minutes
curl -s http://hq-api.localhost:1355/api/hooks/recent | python3 -m json.tool | head -30
```

### Per-Project Validation

| # | Project | Path | Validate | Status |
|---|---------|------|----------|--------|
| 1 | orchestkit | ~/coding/orchestkit | Start session, run any tool | [ ] |
| 2 | yad2 | ~/coding/clients/yad2 | Start session, run any tool | [ ] |
| 3 | vet-assist | ~/coding/startups/vet-assist-ai | Start session, run any tool | [ ] |
| 4 | yonatan-hq | ~/coding/yonatan-hq | Start session, run any tool | [ ] |
| 5 | ShiftBuild | ~/coding/shiftbuild | Start session, run any tool | [ ] |
| 6 | trading-ai | ~/coding/personal/trading-ai-analyst | Start session, run any tool | [ ] |
| 7 | portfolio | ~/coding/portfolio | Start session, run any tool | [ ] |

### What to Check

For each project session:
1. **SessionStart fires** — HQ API log shows the event with correct `cwd`
2. **UserPromptSubmit fires** — Send any prompt, API receives it
3. **PreToolUse fires** — Any tool call triggers the hook (new coverage)
4. **No errors** — CC session starts normally, no hook load failures

### Rollback

If anything breaks:
```bash
# Remove native HTTP hooks
rm ~/.claude/settings.local.json

# Restore curl hooks (copy from git)
git show HEAD:docs/migrations/http-hooks-migration-2026-03-17.md
# Then manually re-add curl hooks to ~/.claude/settings.json
```

## Performance Gains

| Metric | Before (curl) | After (native HTTP) |
|--------|--------------|-------------------|
| Events covered | 4 | 19 |
| Overhead per event | ~200ms (python3 + curl spawn) | 0ms (CC native POST) |
| Auth | File read per event | Env var (resolved once) |
| Payload | CC JSON + cc_profile injection | CC raw JSON (native) |
| Failure mode | `|| true` (silent) | HTTP error non-blocking (native) |

## Related

- OrchestKit docs: `src/hooks/README.md` (HTTP Hooks section)
- OrchestKit docs: `src/skills/configure/references/http-hooks.md`
- OrchestKit docs: `src/skills/doctor/references/version-compatibility.md:44`
- HQ knowledge: `019ccc9d` — HTTP Hooks Fix (CC 2.1.71 breaking change)
- HQ knowledge: `019ca8cb` — CC Intelligence Hooks Global Setup
- Generator CLI: `src/hooks/src/cli/generate-http-hooks.ts`

# Hook Validation

## Overview

OrchestKit uses 22 hook entry points across 11 categories, compiled into 11 bundles. This reference explains how to validate and troubleshoot hooks.

## Hook Architecture

```
hooks.json (22 entries)
    ↓
11 TypeScript bundles (dist/*.mjs)
    ↓
6 async hooks use fire-and-forget pattern
```

## Hook Categories

| Category | Count | Purpose |
|----------|-------|---------|
| PreToolUse | 8 | Before tool execution |
| PostToolUse | 3 | After tool execution |
| PermissionRequest | 3 | Auto-approval logic |
| UserPromptSubmit | 1 | Prompt enhancement |
| SessionStart | 1 | Session initialization |
| SessionEnd | 1 | Session cleanup |
| Stop | 1 | Conversation end |
| SubagentStart | 1 | Before agent spawn |
| SubagentStop | 1 | After agent completes |
| Notification | 1 | Desktop/sound alerts |
| Setup | 1 | Plugin initialization |
| **Total** | **22** | |

## Bundle Structure

| Bundle | Handlers | Async |
|--------|----------|-------|
| agent.mjs | Agent hooks | No |
| hooks.mjs | Core dispatching | No |
| lifecycle.mjs | Session lifecycle | Yes |
| notification.mjs | Alerts | Yes |
| permission.mjs | Auto-approve | No |
| posttool.mjs | Post-execution | Yes |
| pretool.mjs | Pre-execution | No |
| prompt.mjs | Prompt enhancement | Yes |
| setup.mjs | Initialization | Yes |
| stop.mjs | Conversation end | Yes |
| subagent.mjs | Agent lifecycle | No |

## Validation Checks

### 1. hooks.json Schema

```bash
# Validate hooks.json structure
cat src/hooks/hooks.json | jq '.hooks | keys'
```

### 2. Bundle Existence

```bash
# Check all bundles exist
ls -la src/hooks/dist/*.mjs
```

### 3. Async Hook Pattern

Async hooks use fire-and-forget scripts:

```bash
# 6 fire-and-forget scripts required
ls src/hooks/bin/*-fire-and-forget.mjs
```

### 4. Matcher Syntax

Valid matcher patterns:

```json
{
  "matcher": "Bash",           // Exact tool name
  "matcher": "Write|Edit",     // Multiple tools
  "matcher": "*",              // All tools
  "matcher": "mcp__*"          // Wildcard prefix
}
```

## Debug Mode (Issue #243)

Silent hooks run in detached background processes. Enable debug mode to monitor them.

### Enable Debug Logging

Create `.claude/hooks/debug.json`:

```json
{
  "enabled": true,
  "verbose": false,
  "includeInput": false,
  "hookFilters": []
}
```

### View Debug Logs

```bash
# Recent background hook activity
tail -f .claude/logs/background-hooks.log

# Filter by hook name
grep "unified-dispatcher" .claude/logs/background-hooks.log
```

### Hook Metrics

Execution metrics tracked in `.claude/hooks/metrics.json`:

```json
{
  "hooks": {
    "posttool/unified-dispatcher": {
      "totalRuns": 42,
      "successCount": 41,
      "errorCount": 1,
      "avgDurationMs": 150
    }
  }
}
```

### PID Tracking

```bash
# Check for orphaned processes
for f in .claude/hooks/pids/*.pid; do
  pid=$(jq -r '.pid' "$f" 2>/dev/null)
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
    echo "Orphaned: $f"
    rm "$f"
  fi
done
```

## Troubleshooting

### Hook not firing

1. Check matcher pattern matches tool name
2. Verify bundle exists in dist/
3. Check hooks.json registration

### Hook timing out

Default timeout: 120s (bash), 600s (CC 2.1.3+)

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success / Allow |
| 1 | Error (logged, continues) |
| 2 | Block (stops execution) |

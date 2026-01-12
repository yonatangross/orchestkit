# Hook Validation

## Overview

SkillForge includes 93 hooks across 11 categories. This reference explains how to validate and troubleshoot hooks.

## Validation Checks

### 1. Executable Permission

Every hook must be executable:

```bash
# Find non-executable hooks
find .claude/hooks -name "*.sh" ! -perm -u+x

# Fix all at once
chmod +x .claude/hooks/**/*.sh
```

### 2. Shebang Line

Every hook must start with a shebang:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

**Validate:**

```bash
# Check for missing shebangs
for f in .claude/hooks/**/*.sh; do
  head -1 "$f" | grep -q "^#!" || echo "Missing shebang: $f"
done
```

### 3. Dispatcher References

Settings.json must reference valid hook files:

```bash
# Extract all hook paths from settings.json
jq -r '.. | .command? // empty' .claude/settings.json | \
  grep -oE '\$CLAUDE_PROJECT_DIR[^"]+' | \
  sed 's/\$CLAUDE_PROJECT_DIR/./g' | \
  while read path; do
    [ -f "$path" ] || echo "Missing: $path"
  done
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

## Hook Categories

| Category | Count | Purpose |
|----------|-------|---------|
| PreToolUse | 15 | Before tool execution |
| PostToolUse | 12 | After tool execution |
| PermissionRequest | 3 | Auto-approval logic |
| UserPromptSubmit | 3 | Prompt enhancement |
| SessionStart | 8 | Session initialization |
| SessionEnd | 3 | Session cleanup |
| Stop | 7 | Conversation end |
| SubagentStart | 4 | Before agent spawn |
| SubagentStop | 7 | After agent completes |
| Notification | 2 | Desktop/sound alerts |
| Skill | 22 | Skill-specific hooks |

## Troubleshooting

### Hook not firing

1. Check matcher pattern matches tool name
2. Verify hook file exists and is executable
3. Check for syntax errors in hook script
4. Review hook logs: `tail -f .claude/hooks/logs/*.log`

### Hook timing out

1. Default timeout: 120s (bash), 600s (10min in CC 2.1.3)
2. Add explicit timeout in settings.json:
   ```json
   {"timeout": 600000}
   ```

### Hook returning wrong exit code

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success / Allow |
| 1 | Error (logged, continues) |
| 2 | Block (stops execution) |
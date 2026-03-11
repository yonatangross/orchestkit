---
title: Backup existing configuration before making changes to enable safe rollback
impact: HIGH
impactDescription: "Overwriting config without backup loses user customizations and may break working environments with no recovery path"
tags: [configuration, backup, rollback, safety]
---

# Backup Config Before Modification

## Why

Configuration files accumulate user customizations over time (MCP servers, hook permissions, keybindings). Overwriting without backup means one bad write can destroy hours of setup with no recovery path.

## Rule

Before modifying any configuration file:
1. Check if the file exists
2. If it exists, create a timestamped backup
3. Apply changes to the original
4. Report the backup location to the user

## Incorrect — overwrite config without backup

```bash
# Directly overwrite existing config
cat > ~/.claude/plugins/orchestkit/config.json << 'EOF'
{
  "version": "1.0.0",
  "preset": "complete",
  "skills": { "ai_ml": true }
}
EOF
```

```typescript
// Blind write — existing customizations lost
import { writeFileSync } from "fs";

writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
```

**Problems:**
- User's existing MCP server config is destroyed
- Custom hook permissions are lost
- No way to revert if new config causes failures

## Correct — backup then modify

```bash
# Backup existing config with timestamp
CONFIG="$HOME/.claude/plugins/orchestkit/config.json"
if [ -f "$CONFIG" ]; then
  BACKUP="${CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$CONFIG" "$BACKUP"
  echo "Backup saved: $BACKUP"
fi

# Now safe to write new config
cat > "$CONFIG" << 'EOF'
{
  "version": "1.0.0",
  "preset": "complete",
  "skills": { "ai_ml": true }
}
EOF
```

```typescript
import { existsSync, copyFileSync, writeFileSync } from "fs";

function safeWriteConfig(configPath: string, newConfig: object): string | null {
  let backupPath: string | null = null;

  if (existsSync(configPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${configPath}.backup.${timestamp}`;
    copyFileSync(configPath, backupPath);
  }

  writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  return backupPath;
}
```

## Rollback Pattern

```bash
# If something goes wrong, restore from backup
CONFIG="$HOME/.claude/plugins/orchestkit/config.json"
LATEST_BACKUP=$(ls -t "${CONFIG}.backup."* 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  cp "$LATEST_BACKUP" "$CONFIG"
  echo "Restored from: $LATEST_BACKUP"
fi
```

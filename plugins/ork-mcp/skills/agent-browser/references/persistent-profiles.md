# Persistent Browser Profiles (v0.7.0)

Maintain browser state across sessions with persistent profiles.

## Overview

The `--profile` flag stores browser data (cookies, localStorage, cache, extensions) in a persistent directory. Unlike `state save/load` which requires explicit commands, profiles automatically persist all browser state.

## Basic Usage

```bash
# First session - login and interactions are automatically saved
agent-browser --profile ~/.agent-browser/my-project open https://app.example.com
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser close

# Later session - authentication persists automatically
agent-browser --profile ~/.agent-browser/my-project open https://app.example.com/dashboard
# Already logged in!
```

## Environment Variable

Set a default profile via environment variable:

```bash
# In shell profile (~/.bashrc, ~/.zshrc)
export AGENT_BROWSER_PROFILE="$HOME/.agent-browser/default"

# Now all commands use this profile automatically
agent-browser open https://app.example.com
```

## Use Cases

### 1. Multi-Project Isolation

```bash
# Project A profile
agent-browser --profile ~/.agent-browser/project-a open https://app-a.example.com

# Project B profile (separate cookies, storage)
agent-browser --profile ~/.agent-browser/project-b open https://app-b.example.com
```

### 2. Authenticated Session Persistence

```bash
#!/bin/bash
# login-once.sh - Run once to authenticate

PROFILE=~/.agent-browser/my-app

agent-browser --profile "$PROFILE" open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser close

echo "Profile saved. Future sessions will be authenticated."
```

```bash
#!/bin/bash
# daily-task.sh - Uses saved authentication

PROFILE=~/.agent-browser/my-app

agent-browser --profile "$PROFILE" open https://app.example.com/dashboard
# Already logged in - no login needed
agent-browser snapshot -i
agent-browser get text @e1
agent-browser close
```

### 3. Extension Loading

Profiles can include browser extensions:

```bash
# Extensions installed in profile persist
agent-browser --profile ~/.agent-browser/with-extensions open https://example.com
```

## Profile vs State Save/Load

| Feature | `--profile` | `state save/load` |
|---------|-------------|-------------------|
| Persistence | Automatic | Explicit command |
| Scope | All browser data | Cookies + localStorage |
| Storage | Directory | JSON file |
| Extensions | Supported | Not supported |
| Cache | Included | Not included |
| Use case | Long-term sessions | Portable state |

## Best Practices

### 1. Use Project-Specific Profiles

```bash
# Good - isolated per project
--profile ~/.agent-browser/project-name

# Avoid - conflicts between projects
--profile ~/.agent-browser/default
```

### 2. Combine with Sessions for Parallel Work

```bash
# Profile for persistent state + session for isolation
agent-browser --profile ~/.agent-browser/app --session test1 open https://app.example.com
agent-browser --profile ~/.agent-browser/app --session test2 open https://app.example.com
```

### 3. Clean Profiles Periodically

```bash
# Remove stale profiles
rm -rf ~/.agent-browser/old-project

# Keep profile size manageable
du -sh ~/.agent-browser/*
```

## Profile Directory Structure

```
~/.agent-browser/my-project/
├── Default/
│   ├── Cookies
│   ├── Local Storage/
│   ├── Session Storage/
│   └── ...
├── Extensions/
└── ...
```

## Troubleshooting

### Profile Not Persisting

```bash
# Ensure proper close
agent-browser close  # Flushes profile to disk

# Check profile exists
ls -la ~/.agent-browser/my-project/
```

### Profile Too Large

```bash
# Check size
du -sh ~/.agent-browser/my-project/

# Clear cache only (keeps cookies/storage)
rm -rf ~/.agent-browser/my-project/Default/Cache/
```

### Corrupted Profile

```bash
# Delete and recreate
rm -rf ~/.agent-browser/my-project/
agent-browser --profile ~/.agent-browser/my-project open https://example.com
# Re-authenticate as needed
```

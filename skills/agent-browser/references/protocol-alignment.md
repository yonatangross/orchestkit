# Protocol Alignment (v0.6.0)

Breaking changes in v0.6.0 for protocol consistency. Update commands accordingly.

## Breaking Changes

### 1. Select Command

**Before (v0.5.x)**:
```bash
agent-browser select @e1 "Option Text"
```

**After (v0.6.0)** - Uses `values` field:
```bash
agent-browser select @e1 "Option Text"
# Internally uses: { "action": "select", "values": ["Option Text"] }

# Multi-select
agent-browser select @e1 "Option 1" "Option 2"
# Internally uses: { "action": "select", "values": ["Option 1", "Option 2"] }
```

### 2. Frame Main Command

**Before (v0.5.x)**:
```bash
agent-browser frame main
```

**After (v0.6.0)** - Uses `mainframe` action:
```bash
agent-browser frame main
# Internally uses: { "action": "mainframe" }
```

No change in CLI syntax, but internal protocol changed.

### 3. Mouse Wheel Command

**Before (v0.5.x)**:
```bash
agent-browser scroll --wheel --delta-y 100
```

**After (v0.6.0)** - Uses `wheel` action:
```bash
agent-browser mouse wheel --delta-y 100
# Internally uses: { "action": "wheel", "deltaY": 100 }
```

### 4. Set Media Command

**Before (v0.5.x)**:
```bash
agent-browser media --color-scheme dark
```

**After (v0.6.0)** - Uses `emulatemedia` action:
```bash
agent-browser set media --color-scheme dark
# Internally uses: { "action": "emulatemedia", "colorScheme": "dark" }
```

### 5. Console Messages

**Before (v0.5.x)**:
```bash
agent-browser console
# Output: { "logs": [...] }
```

**After (v0.6.0)** - Uses `messages` field:
```bash
agent-browser console
# Output: { "messages": [...] }
```

## Migration Guide

If upgrading from v0.5.x, update your scripts:

```bash
#!/bin/bash
# v0.5.x script

# Old: frame main (worked differently internally)
agent-browser frame main

# Old: scroll with wheel
agent-browser scroll --wheel --delta-y 100

# Old: media emulation
agent-browser media --color-scheme dark
```

```bash
#!/bin/bash
# v0.6.0 script

# New: frame main (same CLI, different protocol)
agent-browser frame main

# New: mouse wheel
agent-browser mouse wheel --delta-y 100

# New: set media
agent-browser set media --color-scheme dark
```

## New Features in v0.6.0

### Video Recording

```bash
agent-browser record start /path/to/video.webm
# ... perform actions ...
agent-browser record stop
```

### Persistent CDP Sessions

```bash
# Connect to existing Chrome instance
agent-browser connect ws://localhost:9222/devtools/browser/...
```

### Proxy Support

```bash
agent-browser open https://example.com --proxy http://proxy:8080
agent-browser open https://example.com --proxy http://user:pass@proxy:8080
```

### Computed Styles

```bash
agent-browser get styles @e1
agent-browser get styles @e1 --property background-color
```

### Enhanced Network Requests

```bash
agent-browser network
# Shows: method, URL, resource type
```

### Multi-Value Select

```bash
# Select multiple options in multi-select
agent-browser select @e1 "Option 1" "Option 2" "Option 3"
```

## Bug Fixes in v0.6.0

| Issue | Fix |
|-------|-----|
| Windows daemon startup | Fixed process spawning |
| Ubuntu 24.04 compatibility | Added libasound2t64 support |
| CDP timeout on empty tabs | Proper handling |
| Screenshot base64 output | Correct encoding |
| Ref resolution in `get value` | Fixed ref lookup |
| `tab new` URL parameter | Now works correctly |
| about:/data:/file: URLs | Proper handling |
| Stale unix socket | Detection and cleanup |
| SIGPIPE panic when piping | Proper signal handling |
| AGENT_BROWSER_HEADED env var | Now respected |

## Environment Variables

```bash
# Run in headed mode (visible browser)
AGENT_BROWSER_HEADED=1 agent-browser open https://example.com

# Disable color output
NO_COLOR=1 agent-browser snapshot
```

## Checking Version

```bash
agent-browser --version
# Should output: 0.6.0 or higher
```

## Compatibility Matrix

| Feature | v0.5.x | v0.6.0 |
|---------|--------|--------|
| Basic navigation | ✓ | ✓ |
| Snapshot + refs | ✓ | ✓ |
| Sessions | ✓ | ✓ |
| Video recording | ✗ | ✓ |
| Proxy support | ✗ | ✓ |
| CDP connect | ✗ | ✓ |
| `mouse wheel` | ✗ | ✓ |
| `set media` | ✗ | ✓ |
| Multi-select | Partial | ✓ |

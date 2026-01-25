# Protocol Alignment (v0.6.0 - v0.7.0)

Version compatibility notes and breaking changes. Update commands accordingly.

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

## New Features in v0.7.0

### Download Commands

```bash
# Click element and save download
agent-browser download @e1 ./file.pdf

# Wait for download to complete
agent-browser wait --download [path]
```

### Persistent Browser Profiles

```bash
# Maintain browser state across sessions
agent-browser --profile ~/.agent-browser/my-project open https://example.com

# Environment variable
AGENT_BROWSER_PROFILE="/path" agent-browser open https://example.com
```

### Cloud Browser Providers

```bash
# Use cloud browser infrastructure
agent-browser -p browserbase open https://example.com
agent-browser --provider browseruse open https://example.com

# Environment variable
AGENT_BROWSER_PROVIDER="browserbase" agent-browser open https://example.com
```

### New Semantic Locators

```bash
# Exact text match
agent-browser find text "Sign In" click --exact

# By placeholder
agent-browser find placeholder "Search" type "query"

# By alt text
agent-browser find alt "Logo" click

# By title attribute
agent-browser find title "Close" click

# By data-testid
agent-browser find testid "submit-btn" click

# Last match
agent-browser find last ".item" click
```

### Proxy Bypass

```bash
# Bypass specific domains from proxy
agent-browser --proxy http://proxy:8080 --proxy-bypass "localhost,*.local" \
    open https://example.com
```

### Advanced Browser Configuration

```bash
# Custom user agent
agent-browser --user-agent "Custom/1.0" open https://example.com

# Extra browser args
agent-browser --args "--disable-gpu" open https://example.com
```

### Tab Close by Index

```bash
# Close specific tab
agent-browser tab close 2
```

### Connect to Existing Browser

```bash
# Connect via CDP port
agent-browser connect 9222
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

| Feature | v0.5.x | v0.6.0 | v0.7.0 |
|---------|--------|--------|--------|
| Basic navigation | ✓ | ✓ | ✓ |
| Snapshot + refs | ✓ | ✓ | ✓ |
| Sessions | ✓ | ✓ | ✓ |
| Video recording | ✗ | ✓ | ✓ |
| Proxy support | ✗ | ✓ | ✓ |
| CDP connect | ✗ | ✓ | ✓ |
| `mouse wheel` | ✗ | ✓ | ✓ |
| `set media` | ✗ | ✓ | ✓ |
| Multi-select | Partial | ✓ | ✓ |
| Download command | ✗ | ✗ | ✓ |
| Persistent profiles | ✗ | ✗ | ✓ |
| Cloud providers | ✗ | ✗ | ✓ |
| Proxy bypass | ✗ | ✗ | ✓ |
| New semantic locators | ✗ | ✗ | ✓ |
| Tab close by index | ✗ | ✗ | ✓ |

## Checking Version

```bash
agent-browser --version
# Should output: 0.7.0 or higher for latest features
```

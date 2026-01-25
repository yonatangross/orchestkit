---
name: agent-browser
description: Vercel agent-browser CLI for headless browser automation. 93% less context than Playwright MCP. Snapshot + refs workflow with @e1 @e2 element references. Use when automating browser tasks, web scraping, form automation, or content capture.
context: fork
agent: test-generator
version: 2.0.0
author: OrchestKit AI Agent Hub
tags: [browser, automation, headless, scraping, vercel, agent-browser, 2026]
user-invocable: false
allowed-tools: Bash, Read, Write
---

# Browser Automation with agent-browser

Automates browser interactions for web testing, form filling, screenshots, and data extraction. **93% less context** than Playwright MCP through Snapshot + Refs workflow.

## Overview

- Web scraping and data extraction from dynamic/JS-rendered pages
- Form automation and multi-step workflows
- Screenshot capture and visual verification
- E2E test generation and debugging
- Content capture from authenticated pages
- Browser-based automation tasks via CLI

## Installation

```bash
npm install -g agent-browser      # Install CLI
agent-browser install             # Download Chromium
agent-browser install --with-deps # With system dependencies (Linux)
```

## Quick Start

```bash
agent-browser open <url>          # Navigate to page
agent-browser snapshot -i         # Get interactive elements with refs
agent-browser click @e1           # Click element by ref
agent-browser fill @e2 "text"     # Fill input by ref
agent-browser close               # Close browser
```

## Core Workflow

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (returns elements with refs like @e1, @e2)
3. **Interact** using refs from the snapshot
4. **Re-snapshot** after navigation or significant DOM changes

## Commands

### Navigation

```bash
agent-browser open <url>          # Navigate to URL (aliases: goto, navigate)
agent-browser connect <port>      # Connect to browser via CDP port
agent-browser back                # Go back
agent-browser forward             # Go forward
agent-browser reload              # Reload page
agent-browser close               # Close browser (aliases: quit, exit)
```

### Snapshot (Page Analysis)

```bash
agent-browser snapshot            # Full accessibility tree
agent-browser snapshot -i         # Interactive elements only (recommended)
agent-browser snapshot -c         # Compact output
agent-browser snapshot -d 3       # Limit depth to 3
agent-browser snapshot -s "#main" # Scope to CSS selector
```

### Interactions (Use @refs from Snapshot)

```bash
agent-browser click @e1           # Click
agent-browser dblclick @e1        # Double-click
agent-browser focus @e1           # Focus element
agent-browser fill @e2 "text"     # Clear and type
agent-browser type @e2 "text"     # Type without clearing
agent-browser press Enter         # Press key (alias: key)
agent-browser press Control+a     # Key combination
agent-browser keydown Shift       # Hold key down
agent-browser keyup Shift         # Release key
agent-browser hover @e1           # Hover
agent-browser check @e1           # Check checkbox
agent-browser uncheck @e1         # Uncheck checkbox
agent-browser select @e1 "value"  # Select dropdown
agent-browser select @e1 "a" "b"  # Multi-select (v0.7.0)
agent-browser scroll down 500     # Scroll page
agent-browser scrollintoview @e1  # Scroll element into view (alias: scrollinto)
agent-browser drag @e1 @e2        # Drag and drop
agent-browser upload @e1 file.pdf # Upload files
```

### Get Information

```bash
agent-browser get text @e1        # Get element text
agent-browser get html @e1        # Get innerHTML
agent-browser get value @e1       # Get input value
agent-browser get attr @e1 href   # Get attribute
agent-browser get styles @e1      # Get computed styles
agent-browser get title           # Get page title
agent-browser get url             # Get current URL
agent-browser get count ".item"   # Count matching elements
agent-browser get box @e1         # Get bounding box
```

### Check State

```bash
agent-browser is visible @e1      # Check if visible
agent-browser is enabled @e1      # Check if enabled
agent-browser is checked @e1      # Check if checked
```

### Screenshots & PDF

```bash
agent-browser screenshot          # Screenshot to stdout
agent-browser screenshot path.png # Save to file
agent-browser screenshot --full   # Full page
agent-browser pdf output.pdf      # Save as PDF
```

### Downloads

```bash
agent-browser download @e1 ./file.pdf  # Click element and save download
agent-browser wait --download [path]   # Wait for download to complete
```

### Video Recording

```bash
agent-browser record start ./demo.webm  # Start recording
agent-browser click @e1                  # Perform actions
agent-browser record stop                # Stop and save video
agent-browser record restart ./take2.webm # Stop + start new
```

### Wait

```bash
agent-browser wait @e1            # Wait for element
agent-browser wait 2000           # Wait milliseconds
agent-browser wait --text "Success" # Wait for text
agent-browser wait --url "**/dashboard" # Wait for URL pattern
agent-browser wait --load networkidle   # Wait for network idle
agent-browser wait --fn "window.ready"  # Wait for JS condition
```

### Mouse Control

```bash
agent-browser mouse move 100 200  # Move mouse
agent-browser mouse down left     # Press button
agent-browser mouse up left       # Release button
agent-browser mouse wheel 100     # Scroll wheel
```

### Selector Types

```bash
# Refs from snapshot (preferred)
agent-browser click @e1           # Element ref
agent-browser click @e2

# CSS selectors
agent-browser click "#submit-btn"
agent-browser click ".nav > button"

# Text selectors
agent-browser click "text=Sign In"

# XPath selectors
agent-browser click "xpath=//button[@type='submit']"
```

### Semantic Locators (Alternative to Refs)

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find text "Sign In" click --exact    # Exact match (v0.7.0)
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"  # By placeholder (v0.7.0)
agent-browser find alt "Logo" click                   # By alt text (v0.7.0)
agent-browser find title "Close" click                # By title attr (v0.7.0)
agent-browser find testid "submit-btn" click          # By data-testid (v0.7.0)
agent-browser find first ".item" click
agent-browser find last ".item" click                 # Last match (v0.7.0)
agent-browser find nth 2 "a" text
```

### Browser Settings

```bash
agent-browser set viewport 1920 1080  # Set viewport size
agent-browser set device "iPhone 14"  # Emulate device
agent-browser set geo 37.7749 -122.4194 # Set geolocation
agent-browser set offline on          # Toggle offline mode
agent-browser set headers '{"X-Key":"v"}' # Extra HTTP headers
agent-browser set credentials user pass # HTTP basic auth
agent-browser set media dark          # Emulate color scheme
```

### Cookies & Storage

```bash
agent-browser cookies             # Get all cookies
agent-browser cookies set name value # Set cookie
agent-browser cookies clear       # Clear cookies
agent-browser storage local       # Get all localStorage
agent-browser storage local key   # Get specific key
agent-browser storage local set k v # Set value
agent-browser storage local clear # Clear all
agent-browser storage session     # Get all sessionStorage
agent-browser storage session key # Get specific key
agent-browser storage session set k v # Set value
agent-browser storage session clear # Clear all
```

### Network

```bash
agent-browser network route <url>           # Intercept requests
agent-browser network route <url> --abort   # Block requests
agent-browser network route <url> --body '{}' # Mock response
agent-browser network unroute [url]         # Remove routes
agent-browser network requests              # View tracked requests
agent-browser network requests --filter api # Filter requests
```

### Tabs & Windows

```bash
agent-browser tab                 # List tabs
agent-browser tab new [url]       # New tab
agent-browser tab 2               # Switch to tab
agent-browser tab close           # Close current tab
agent-browser tab close 2         # Close tab by index (v0.7.0)
agent-browser window new          # New window
```

### Frames & Dialogs

```bash
agent-browser frame "#iframe"     # Switch to iframe
agent-browser frame main          # Back to main frame
agent-browser dialog accept [text] # Accept dialog
agent-browser dialog dismiss      # Dismiss dialog
```

### JavaScript

```bash
agent-browser eval "document.title" # Run JavaScript
```

### State Management

```bash
agent-browser state save auth.json  # Save session state
agent-browser state load auth.json  # Load session state
```

### Sessions (Parallel Browsers)

```bash
agent-browser --session test1 open site-a.com
agent-browser --session test2 open site-b.com
agent-browser session list
```

### JSON Output

```bash
agent-browser snapshot -i --json  # Machine-readable output
agent-browser get text @e1 --json
```

### Debugging

```bash
agent-browser open example.com --headed # Show browser window
agent-browser console             # View console messages
agent-browser console --clear     # Clear console
agent-browser errors              # View page errors
agent-browser errors --clear      # Clear errors
agent-browser highlight @e1       # Highlight element
agent-browser trace start         # Start recording trace
agent-browser trace stop trace.zip # Stop and save trace
agent-browser --cdp 9222 snapshot # Connect via CDP
```

## Global Options (v0.7.0)

```bash
agent-browser --session <name> ...       # Named session for isolation
agent-browser --json ...                 # JSON output mode
agent-browser --headed ...               # Visible browser window
agent-browser --debug ...                # Debug logging
agent-browser --profile <path> ...       # Persistent browser profile
agent-browser -p, --provider <name> ...  # Cloud browser provider
agent-browser --proxy <url> ...          # Proxy server
agent-browser --args <args> ...          # Extra browser args
agent-browser --user-agent <ua> ...      # Custom user agent
agent-browser --proxy-bypass <list> ...  # Proxy bypass list
agent-browser --executable-path <path> ...  # Custom browser binary
agent-browser --extension <path> ...     # Load browser extension
agent-browser --timeout <ms> ...         # Default timeout
agent-browser --cdp <port> ...           # Connect via CDP
```

## Environment Variables (v0.7.0)

```bash
AGENT_BROWSER_SESSION="my-session"   # Default session name
AGENT_BROWSER_PROFILE="/path"        # Default profile path
AGENT_BROWSER_PROVIDER="browserbase" # Cloud provider
AGENT_BROWSER_EXECUTABLE_PATH="/path/to/chrome"  # Custom browser
AGENT_BROWSER_ARGS="--disable-gpu"   # Extra browser args
AGENT_BROWSER_USER_AGENT="..."       # Default user agent
AGENT_BROWSER_PROXY="http://proxy:8080"  # Proxy URL
AGENT_BROWSER_PROXY_BYPASS="localhost,*.local"  # Bypass list
AGENT_BROWSER_STREAM_PORT="9223"     # WebSocket streaming port
AGENT_BROWSER_HEADED=1               # Run in headed mode
NO_COLOR=1                           # Disable color output

# Cloud provider credentials
BROWSERBASE_API_KEY="..."            # Browserbase API key
BROWSERBASE_PROJECT_ID="..."         # Browserbase project
BROWSER_USE_API_KEY="..."            # Browser Use API key
```

## Example: Form Submission

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Example: Auth with Saved State

```bash
# Login once
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth.json

# Later sessions: load saved state
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```

## Related Skills

- `browser-content-capture` - Content extraction patterns using agent-browser
- `webapp-testing` - E2E testing with Playwright test framework
- `e2e-testing` - End-to-end testing patterns

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI over MCP | Bash commands | Simpler integration, no MCP config |
| Snapshot + Refs | @e1, @e2 pattern | 93% context reduction |
| Rust + Node.js | Hybrid architecture | Fast CLI (~1-2ms) + stable browser control |
| Session isolation | --session flag | Safe concurrent automation |

## Deep-dive Documentation

| Reference | Description |
|-----------|-------------|
| [references/snapshot-refs.md](references/snapshot-refs.md) | Ref lifecycle, invalidation, best practices |
| [references/commands.md](references/commands.md) | Complete 60+ command reference |
| [references/authentication.md](references/authentication.md) | Session persistence, login flows |
| [references/session-management.md](references/session-management.md) | Parallel sessions, state management |
| [references/video-recording.md](references/video-recording.md) | Recording workflows, format options |
| [references/proxy-support.md](references/proxy-support.md) | Proxy configuration, authentication |
| [references/persistent-profiles.md](references/persistent-profiles.md) | Browser profile persistence (v0.7.0) |
| [references/cloud-providers.md](references/cloud-providers.md) | Browserbase, Browser Use setup (v0.7.0) |
| [references/protocol-alignment.md](references/protocol-alignment.md) | Version compatibility, breaking changes |

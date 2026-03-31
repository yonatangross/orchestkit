---
name: vercel-agent-browser
description: "Browser automation CLI for AI agents. Navigate, snapshot, interact, extract data, test web apps. Covers headless Chrome, Lightpanda, iOS Simulator, cloud providers, batch commands, HAR capture, and session management."
tags:
  - browser
  - automation
  - testing
  - e2e
  - agent-browser

version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: medium
upstream:
  repo: vercel-labs/agent-browser
  path: skills/agent-browser/SKILL.md
  synced: "2026-03-31T11:04:20Z"
  status: synced
---


# Browser Automation with agent-browser

The CLI uses Chrome/Chromium via CDP directly. Install via `npm i -g agent-browser`, `brew install agent-browser`, or `cargo install agent-browser`. Run `agent-browser install` to download Chrome. Existing Chrome, Brave, Playwright, and Puppeteer installations are detected automatically. Run `agent-browser upgrade` to update to the latest version.

## Core Workflow

Every browser automation follows this pattern:

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get element refs like `@e1`, `@e2`)
3. **Interact**: Use refs to click, fill, select
4. **Re-snapshot**: After navigation or DOM changes, get fresh refs

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Command Chaining

Commands can be chained with `&&` in a single shell invocation. The browser persists between commands via a background daemon, so chaining is safe and more efficient than separate calls.

```bash
# Chain open + wait + snapshot in one call
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser snapshot -i

# Chain multiple interactions
agent-browser fill @e1 "user@example.com" && agent-browser fill @e2 "password123" && agent-browser click @e3

# Navigate and capture
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser screenshot page.png
```

**When to chain:** Use `&&` when you don't need to read the output of an intermediate command before proceeding (e.g., open + wait + screenshot). Run commands separately when you need to parse the output first (e.g., snapshot to discover refs, then interact using those refs).

## Handling Authentication

When automating a site that requires login, choose the approach that fits:

**Option 1: Import auth from the user's browser (fastest for one-off tasks)**

```bash
# Connect to the user's running Chrome (they're already logged in)
agent-browser --auto-connect state save ./auth.json
# Use that auth state
agent-browser --state ./auth.json open https://app.example.com/dashboard
```

State files contain session tokens in plaintext -- add to `.gitignore` and delete when no longer needed. Set `AGENT_BROWSER_ENCRYPTION_KEY` for encryption at rest.

**Option 2: Persistent profile (simplest for recurring tasks)**

```bash
# First run: login manually or via automation
agent-browser --profile ~/.myapp open https://app.example.com/login
# ... fill credentials, submit ...

# All future runs: already authenticated
agent-browser --profile ~/.myapp open https://app.example.com/dashboard
```

**Option 3: Session name (auto-save/restore cookies + localStorage)**

```bash
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close  # State auto-saved

# Next time: state auto-restored
agent-browser --session-name myapp open https://app.example.com/dashboard
```

**Option 4: Auth vault (credentials stored encrypted, login by name)**

```bash
echo "$PASSWORD" | agent-browser auth save myapp --url https://app.example.com/login --username user --password-stdin
agent-browser auth login myapp
```

`auth login` navigates with `load` and then waits for login form selectors to appear before filling/clicking, which is more reliable on delayed SPA login screens.

**Option 5: State file (manual save/load)**

```bash
# After logging in:
agent-browser state save ./auth.json
# In a future session:
agent-browser state load ./auth.json
agent-browser open https://app.example.com/dashboard
```

See [references/authentication.md](references/authentication.md) for OAuth, 2FA, cookie-based auth, and token refresh patterns.

## Essential Commands

```bash
# Navigation
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser close                   # Close browser
agent-browser close --all             # Close all active sessions

# Snapshot
agent-browser snapshot -i             # Interactive elements with refs (recommended)
agent-browser snapshot -s "#selector" # Scope to CSS selector

# Interaction (use @refs from snapshot)
agent-browser click @e1               # Click element
agent-browser click @e1 --new-tab     # Click and open in new tab
agent-browser fill @e2 "text"         # Clear and type text
agent-browser type @e2 "text"         # Type without clearing
agent-browser select @e1 "option"     # Select dropdown option
agent-browser check @e1               # Check checkbox
agent-browser press Enter             # Press key
agent-browser keyboard type "text"    # Type at current focus (no selector)
agent-browser keyboard inserttext "text"  # Insert without key events
agent-browser scroll down 500         # Scroll page
agent-browser scroll down 500 --selector "div.content"  # Scroll within a specific container

# Get information
agent-browser get text @e1            # Get element text
agent-browser get url                 # Get current URL
agent-browser get title               # Get page title
agent-browser get cdp-url             # Get CDP WebSocket URL

# Wait
agent-browser wait @e1                # Wait for element
agent-browser wait --load networkidle # Wait for network idle
agent-browser wait --url "**/page"    # Wait for URL pattern
agent-browser wait 2000               # Wait milliseconds
agent-browser wait --text "Welcome"    # Wait for text to appear (substring match)
agent-browser wait --fn "!document.body.innerText.includes('Loading...')"  # Wait for text to disappear
agent-browser wait "#spinner" --state hidden  # Wait for element to disappear

# Downloads
agent-browser download @e1 ./file.pdf          # Click element to trigger download
agent-browser wait --download ./output.zip     # Wait for any download to complete
agent-browser --download-path ./downloads open <url>  # Set default download directory

# Network
agent-browser network requests                 # Inspect tracked requests
agent-browser network requests --type xhr,fetch  # Filter by resource type
agent-browser network requests --method POST   # Filter by HTTP method
agent-browser network requests --status 2xx    # Filter by status (200, 2xx, 400-499)
agent-browser network request <requestId>      # View full request/response detail
agent-browser network route "**/api/*" --abort  # Block matching requests
agent-browser network har start                # Start HAR recording
agent-browser network har stop ./capture.har   # Stop and save HAR file

# Viewport & Device Emulation
agent-browser set viewport 1920 1080          # Set viewport size (default: 1280x720)
agent-browser set viewport 1920 1080 2        # 2x retina (same CSS size, higher res screenshots)
agent-browser set device "iPhone 14"          # Emulate device (viewport + user agent)

# Capture
agent-browser screenshot              # Screenshot to temp dir
agent-browser screenshot --full       # Full page screenshot
agent-browser screenshot --annotate   # Annotated screenshot with numbered element labels
agent-browser screenshot --screenshot-dir ./shots  # Save to custom directory
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80
agent-browser pdf output.pdf          # Save as PDF

# Live preview / streaming
agent-browser stream enable           # Start runtime WebSocket streaming on an auto-selected port
agent-browser stream enable --port 9223  # Bind a specific localhost port
agent-browser stream status           # Inspect enabled state, port, connection, and screencasting
agent-browser stream disable          # Stop runtime streaming and remove the .stream metadata file

# Clipboard
agent-browser clipboard read                      # Read text from clipboard
agent-browser clipboard write "Hello, World!"     # Write text to clipboard
agent-browser clipboard copy                      # Copy current selection
agent-browser clipboard paste                     # Paste from clipboard

# Dialogs (alert, confirm, prompt, beforeunload)
# By default, alert and beforeunload dialogs are auto-accepted so they never block the agent.
# confirm and prompt dialogs still require explicit handling.
# Use --no-auto-dialog (or AGENT_BROWSER_NO_AUTO_DIALOG=1) to disable automatic handling.
agent-browser dialog accept              # Accept dialog
agent-browser dialog accept "my input"   # Accept prompt dialog with text
agent-browser dialog dismiss             # Dismiss/cancel dialog
agent-browser dialog status              # Check if a dialog is currently open

# Diff (compare page states)
agent-browser diff snapshot                          # Compare current vs last snapshot
agent-browser diff snapshot --baseline before.txt    # Compare current vs saved file
agent-browser diff screenshot --baseline before.png  # Visual pixel diff
agent-browser diff url <url1> <url2>                 # Compare two pages
agent-browser diff url <url1> <url2> --wait-until networkidle  # Custom wait strategy
agent-browser diff url <url1> <url2> --selector "#main"  # Scope to element
```

## Streaming

Every session automatically starts a WebSocket stream server on an OS-assigned port. Use `agent-browser stream status` to see the bound port and connection state. Use `stream disable` to tear it down, and `stream enable --port <port>` to re-enable on a specific port.

## Batch Execution

Execute multiple commands in a single invocation by piping a JSON array of string arrays to `batch`. This avoids per-command process startup overhead when running multi-step workflows.

```bash
echo '[
  ["open", "https://example.com"],
  ["snapshot", "-i"],
  ["click", "@e1"],
  ["screenshot", "result.png"]
]' | agent-browser batch --json

# Stop on first error
agent-browser batch --bail < commands.json
```

Use `batch` when you have a known sequence of commands that don't depend on intermediate output. Use separate commands or `&&` chaining when you need to parse output between steps (e.g., snapshot to discover refs, then interact).

## Common Patterns

### Form Submission

```bash
agent-browser open https://example.com/signup
agent-browser snapshot -i
agent-browser fill @e1 "Jane Doe"
agent-browser fill @e2 "jane@example.com"
agent-browser select @e3 "California"
agent-browser check @e4
agent-browser click @e5
agent-browser wait --load networkidle
```

### Authentication with Auth Vault (Recommended)

```bash
# Save credentials once (encrypted with AGENT_BROWSER_ENCRYPTION_KEY)
# Recommended: pipe password via stdin to avoid shell history exposure
echo "pass" | agent-browser auth save github --url https://github.com/login --username user --password-stdin

# Login using saved profile (LLM never sees password)
agent-browser auth login github

# List/show/delete profiles
agent-browser auth list
agent-browser auth show github
agent-browser auth delete github
```

`auth login` waits for username/password/submit selectors before interacting, with a timeout tied to the default action timeout.

### Authentication with State Persistence

```bash
# Login once and save state
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth.json

# Reuse in future sessions
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```

### Session Persistence

```bash
# Auto-save/restore cookies and localStorage across browser restarts
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close  # State auto-saved to ~/.agent-browser/sessions/

# Next time, state is auto-loaded
agent-browser --session-name myapp open https://app.example.com/dashboard

# Encrypt state at rest
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
agent-browser --session-name secure open https://app.example.com

# Manage saved states
agent-browser state list
agent-browser state show myapp-default.json
agent-browser state clear myapp
agent-browser state clean --older-than 7
```

### Working with Iframes

Iframe content is automatically inlined in snapshots. Refs inside iframes carry frame context, so you can interact with them directly.

```bash
agent-browser open https://example.com/checkout
agent-browser snapshot -i
# @e1 [heading] "Checkout"
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
#   @e4 [input] "Expiry"
#   @e5 [button] "Pay"

# Interact directly — no frame switch needed
agent-browser fill @e3 "4111111111111111"
agent-browser fill @e4 "12/28"
agent-browser click @e5

# To scope a snapshot to one iframe:
agent-browser frame @e2
agent-browser snapshot -i         # Only iframe content
agent-browser frame main          # Return to main frame
```

### Data Extraction

```bash
agent-browser open https://example.com/products
agent-browser snapshot -i
agent-browser get text @e5           # Get specific element text
agent-browser get text body > page.txt  # Get all page text

# JSON output for parsing
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

### Parallel Sessions

```bash
agent-browser --session site1 open https://site-a.com
agent-browser --session site2 open https://site-b.com

agent-browser --session site1 snapshot -i
agent-browser --session site2 snapshot -i

agent-browser session list
```

### Connect to Existing Chrome

```bash
# Auto-discover running Chrome with remote debugging enabled
agent-browser --auto-connect open https://example.com
agent-browser --auto-connect snapshot

# Or with explicit CDP port
agent-browser --cdp 9222 snapshot
```

Auto-connect discovers Chrome via `DevToolsActivePort`, common debugging ports (9222, 9229), and falls back to a direct WebSocket connection if HTTP-based CDP discovery fails.

### Color Scheme (Dark Mode)

```bash
# Persistent dark mode via flag (applies to all pages and new tabs)
agent-browser --color-scheme dark open https://example.com

# Or via environment variable
AGENT_BROWSER_COLOR_SCHEME=dark agent-browser open https://example.com

# Or set during session (persists for subsequent commands)
agent-browser set media dark
```

### Viewport & Responsive Testing

```bash
# Set a custom viewport size (default is 1280x720)
agent-browser set viewport 1920 1080
agent-browser screenshot desktop.png

# Test mobile-width layout
agent-browser set viewport 375 812
agent-browser screenshot mobile.png


## Advanced Topics

> **Full reference**: Load `Read("${CLAUDE_SKILL_DIR}/references/advanced-topics.md")` for iframes, parallel sessions, mobile testing, security patterns, and video recording.

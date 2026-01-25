# agent-browser Commands Reference

Complete reference for browser automation using agent-browser CLI.

## Navigation Commands

```bash
# Navigate to URL
agent-browser open https://example.com

# Navigation history
agent-browser back
agent-browser forward
agent-browser reload

# Get current URL
agent-browser get url

# Close browser
agent-browser close
```

---

## Snapshot Commands

### Get Interactive Snapshot (Most Common)

```bash
# Interactive snapshot - shows elements with refs
agent-browser snapshot -i

# Output shows:
# @e1 [button] "Submit"
# @e2 [input type="email"] placeholder="Email"
# @e3 [a href="/about"] "About Us"
```

### Snapshot Options

```bash
agent-browser snapshot           # Full accessibility tree
agent-browser snapshot -i        # Interactive elements only (recommended)
agent-browser snapshot -c        # Compact output
agent-browser snapshot -d 3      # Limit depth to 3
agent-browser snapshot -s "#main" # Scope to CSS selector
```

---

## Content Extraction

### Get Text Content

```bash
# Full page text
agent-browser get text body

# Element text (use ref from snapshot)
agent-browser get text @e1
```

### Get HTML

```bash
agent-browser get html @e1        # Element outer HTML
agent-browser get html @e1 --inner # Inner HTML only
```

### Get Element Value

```bash
agent-browser get value @e1       # Input value
agent-browser get attr @e1 href   # Attribute value
```

### Custom JavaScript

```bash
# Extract via JavaScript
agent-browser eval "document.querySelector('.main-content').innerText"

# Multiple elements
agent-browser eval "Array.from(document.querySelectorAll('h2')).map(h => h.innerText)"

# Structured data
agent-browser eval "JSON.stringify({title: document.querySelector('h1').innerText, links: Array.from(document.querySelectorAll('a')).map(a => a.href)})"
```

---

## Interaction Commands

### Click Elements

```bash
agent-browser click @e1           # Click element
agent-browser dblclick @e1        # Double-click
agent-browser click @e1 --button right # Right-click
```

### Fill Forms

```bash
agent-browser fill @e1 "text"     # Clear and type (for inputs)
agent-browser type @e1 "text"     # Append text (no clear)
```

### Keyboard

```bash
agent-browser press Enter         # Press key
agent-browser press Tab           # Tab key
agent-browser press Control+a     # Key combination
```

### Other Interactions

```bash
agent-browser hover @e1           # Hover over element
agent-browser check @e1           # Check checkbox
agent-browser uncheck @e1         # Uncheck checkbox
agent-browser select @e1 "value"  # Select dropdown option
agent-browser upload @e1 file.pdf # Upload file
```

---

## Wait Commands

### Wait for Element

```bash
agent-browser wait @e1            # Wait for element visibility
agent-browser wait @e1 --timeout 10000 # Custom timeout
```

### Wait for Conditions

```bash
agent-browser wait 2000           # Wait milliseconds
agent-browser wait --text "Success" # Wait for text to appear
agent-browser wait --url "**/dashboard" # Wait for URL pattern
agent-browser wait --load networkidle # Wait for network idle
agent-browser wait --fn "window.ready" # Wait for JS condition
```

---

## Scroll Commands

```bash
agent-browser scroll down 500     # Scroll down by pixels
agent-browser scroll up 200       # Scroll up
agent-browser scrollintoview @e1  # Scroll element into view
agent-browser scroll --bottom     # Scroll to bottom
agent-browser scroll --top        # Scroll to top
```

---

## Screenshot & Recording

```bash
# Screenshot
agent-browser screenshot /path/to/file.png
agent-browser screenshot --full   # Full page

# Video recording
agent-browser record start /path/to/video.webm
# ... perform actions ...
agent-browser record stop
```

---

## Session Management

### Named Sessions

```bash
# Create isolated sessions
agent-browser --session auth open https://app.example.com
agent-browser --session scrape open https://data.example.com

# Commands are session-scoped
agent-browser --session auth fill @e1 "user@example.com"
agent-browser --session scrape get text body
```

### State Persistence

```bash
# Save session state (cookies, storage)
agent-browser state save /path/to/state.json

# Load session state
agent-browser state load /path/to/state.json
```

---

## Network & Console

```bash
# Network monitoring
agent-browser network requests              # View all requests
agent-browser network requests --filter api # Filter requests

# Console messages
agent-browser console                       # View console messages
agent-browser console --level error         # Filter by level
agent-browser errors                        # View page errors
```

---

## Common Workflows

### Basic Content Extraction

```bash
# 1. Navigate
agent-browser open https://docs.example.com/guide

# 2. Wait for content
agent-browser wait --load networkidle

# 3. Get snapshot
agent-browser snapshot -i

# 4. Extract (using ref from snapshot)
agent-browser get text @e5
```

### Authenticated Access

```bash
# 1. Navigate to login
agent-browser open https://app.example.com/login

# 2. Get form structure
agent-browser snapshot -i

# 3. Fill credentials
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"

# 4. Submit
agent-browser click @e3

# 5. Wait for dashboard
agent-browser wait --url "**/dashboard"

# 6. Save state for reuse
agent-browser state save /tmp/auth.json

# 7. Navigate to target
agent-browser open https://app.example.com/docs
```

### Multi-Page Crawl

```bash
# 1. Get all links
agent-browser open https://docs.example.com
LINKS=$(agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('nav a')).map(a => a.href))")

# 2. Visit each page
for url in $(echo "$LINKS" | jq -r '.[]'); do
    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename $url).txt"
done
```

---

## Tool Selection Guide

| Task | Command |
|------|---------|
| Go to URL | `open <url>` |
| Get page structure | `snapshot -i` |
| Extract text | `get text @e#` or `eval` |
| Click button/link | `click @e#` |
| Fill login form | `fill @e# "value"` per field |
| Wait for SPA | `wait --load networkidle` |
| Debug issues | `console` or `errors` |
| Save screenshot | `screenshot <path>` |

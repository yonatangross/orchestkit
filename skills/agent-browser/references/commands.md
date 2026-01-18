# agent-browser Command Reference

Complete reference for all 60+ agent-browser CLI commands.

## Navigation Commands

```bash
# Open URL (starts browser if needed)
agent-browser open <url>
agent-browser open https://example.com

# Navigation history
agent-browser back
agent-browser forward
agent-browser reload

# Get current URL
agent-browser get url
```

## Snapshot Commands

```bash
# Get page snapshot (compact element list)
agent-browser snapshot

# Interactive snapshot with refs (-i flag)
agent-browser snapshot -i
# Output:
# @e1 [button] "Submit"
# @e2 [input type="email"] placeholder="Email"
# @e3 [a href="/about"] "About Us"

# Snapshot specific element
agent-browser snapshot @e1
```

## Interaction Commands

```bash
# Click element
agent-browser click @e1
agent-browser click @e1 --button right  # Right-click
agent-browser click @e1 --count 2       # Double-click

# Fill input (replaces content)
agent-browser fill @e2 "new value"

# Type text (appends to existing)
agent-browser type @e2 "additional text"

# Select dropdown option
agent-browser select @e3 "Option Text"
agent-browser select @e3 --value "option_value"

# Press keyboard keys
agent-browser press Enter
agent-browser press Tab
agent-browser press "Control+a"

# Hover over element
agent-browser hover @e1

# Focus element
agent-browser focus @e2
```

## Extraction Commands

```bash
# Get text content
agent-browser get text body           # Full page text
agent-browser get text @e1            # Element text

# Get HTML
agent-browser get html @e1            # Element outer HTML
agent-browser get html @e1 --inner    # Inner HTML only

# Get element value (for inputs)
agent-browser get value @e2

# Get page title
agent-browser get title

# Get current URL
agent-browser get url

# Get element attribute
agent-browser get attr @e1 href

# Get computed styles (v0.6.0)
agent-browser get styles @e1
agent-browser get styles @e1 --property color
```

## Screenshot & Recording

```bash
# Take screenshot
agent-browser screenshot /path/to/file.png
agent-browser screenshot /path/to/file.png --fullpage

# Screenshot specific element
agent-browser screenshot /path/to/element.png --element @e1

# Video recording (v0.6.0)
agent-browser record start /path/to/recording.webm
agent-browser record stop
agent-browser record restart /path/to/new-recording.webm
```

## Wait Commands

```bash
# Wait for element to be visible
agent-browser wait @e1
agent-browser wait @e1 --timeout 10000

# Wait for navigation
agent-browser wait navigation
agent-browser wait navigation --timeout 30000

# Wait for network idle
agent-browser wait networkidle

# Wait fixed duration (ms)
agent-browser wait 2000
```

## Scroll Commands

```bash
# Scroll to element
agent-browser scroll @e1

# Scroll by pixels
agent-browser scroll --y 500
agent-browser scroll --x 200 --y 300

# Scroll to top/bottom
agent-browser scroll --top
agent-browser scroll --bottom

# Mouse wheel (v0.6.0 - uses 'wheel' action)
agent-browser mouse wheel --delta-y 100
```

## Tab Management

```bash
# List open tabs
agent-browser tab list

# Create new tab
agent-browser tab new
agent-browser tab new https://example.com

# Switch to tab by index
agent-browser tab switch 0
agent-browser tab switch 2

# Close current tab
agent-browser tab close

# Close specific tab
agent-browser tab close 1
```

## Session Management

```bash
# Use named session (isolation)
agent-browser --session mySession open https://example.com
agent-browser --session mySession snapshot -i

# Save session state (cookies, storage)
agent-browser save /path/to/state.json

# Load session state
agent-browser load /path/to/state.json

# Close session
agent-browser close
agent-browser --session mySession close
```

## Frame Management

```bash
# Switch to frame
agent-browser frame @e1           # Frame element ref
agent-browser frame 0             # Frame by index

# Switch to main frame (v0.6.0 - uses 'mainframe' action)
agent-browser frame main

# List frames
agent-browser frame list
```

## Console & Network

```bash
# Get console messages (v0.6.0 - uses 'messages' field)
agent-browser console
agent-browser console --level error

# Get network requests (v0.6.0 enhanced)
agent-browser network
# Output shows: method, URL, resource type

# Clear console
agent-browser console clear
```

## JavaScript Execution

```bash
# Execute JavaScript
agent-browser eval "document.title"
agent-browser eval "window.scrollY"
agent-browser eval "localStorage.getItem('token')"

# Execute on element
agent-browser eval @e1 "el.getBoundingClientRect()"
```

## Emulation Commands

```bash
# Set viewport size
agent-browser viewport 1920 1080
agent-browser viewport 375 667 --mobile

# Set geolocation
agent-browser geolocation 37.7749 -122.4194

# Set media features (v0.6.0 - uses 'emulatemedia' action)
agent-browser set media --color-scheme dark
agent-browser set media --reduced-motion reduce

# Set user agent
agent-browser useragent "Mozilla/5.0..."
```

## Proxy Configuration (v0.6.0)

```bash
# Use proxy
agent-browser open https://example.com --proxy http://proxy:8080

# Proxy with authentication
agent-browser open https://example.com --proxy http://user:pass@proxy:8080

# SOCKS proxy
agent-browser open https://example.com --proxy socks5://proxy:1080
```

## CDP Connection (v0.6.0)

```bash
# Connect to existing Chrome DevTools Protocol endpoint
agent-browser connect ws://localhost:9222/devtools/browser/...

# Disconnect
agent-browser disconnect
```

## Browser Control

```bash
# Check if browser is running
agent-browser status

# Close browser
agent-browser close

# Force close (kill daemon)
agent-browser close --force
```

## Global Flags

```bash
# Named session
--session <name>

# Proxy
--proxy <url>

# Timeout (ms)
--timeout <ms>

# Headful mode (visible browser)
AGENT_BROWSER_HEADED=1 agent-browser open https://example.com

# No color output
NO_COLOR=1 agent-browser snapshot
```

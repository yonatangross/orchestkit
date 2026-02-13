# Page Interaction

Patterns for interacting with web page elements using agent-browser snapshot + refs workflow.

## Core Concept: Snapshot + Refs

Run `agent-browser snapshot -i` to get interactive elements tagged `@e1`, `@e2`, etc. Use these refs for all subsequent interactions. Re-snapshot after navigation or significant DOM changes. This yields **93% less context** than full-DOM approaches.

```bash
# 1. Take snapshot to discover elements
agent-browser snapshot -i
# Output: @e1 [input] "Search", @e2 [button] "Submit", @e3 [a] "About"

# 2. Interact using refs
agent-browser fill @e1 "search query"
agent-browser click @e2

# 3. Re-snapshot after page change
agent-browser snapshot -i
```

---

## Navigation

### Basic Navigation

```bash
# Navigate to URL
agent-browser open https://example.com

# Wait for page load
agent-browser wait --load networkidle

# Wait for specific URL pattern
agent-browser wait --url "**/dashboard"
```

### Client-Side Routing

For SPAs with client-side routing, content changes without full page reload:

```bash
# Click navigation link
agent-browser click @e5
# Wait for new content (not page load)
agent-browser wait --text "New Page Title"
# Re-snapshot for new elements
agent-browser snapshot -i
```

---

## Form Filling

### Basic Form

```bash
agent-browser open https://app.example.com/form
agent-browser snapshot -i

# Fill fields by ref
agent-browser fill @e1 "John Doe"           # Name
agent-browser fill @e2 "john@example.com"    # Email
agent-browser fill @e3 "Hello, world!"       # Message

# Submit
agent-browser click @e4                      # Submit button
agent-browser wait --load networkidle
```

### Multi-Step Forms

```bash
# Step 1: Personal info
agent-browser snapshot -i
agent-browser fill @e1 "John Doe"
agent-browser fill @e2 "john@example.com"
agent-browser click @e3  # Next

# Step 2: Address (new form, re-snapshot)
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser fill @e1 "123 Main St"
agent-browser fill @e2 "New York"
agent-browser click @e3  # Next

# Step 3: Review and submit
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser click @e1  # Confirm
```

### Dropdowns and Selects

```bash
# Click dropdown to open
agent-browser click @e5
agent-browser wait 500
agent-browser snapshot -i
# Click option
agent-browser click @e8

# Or use eval for native select
agent-browser eval "document.querySelector('select#country').value = 'US'"
```

---

## Clicking

### Standard Clicks

```bash
agent-browser click @e1           # Left click
```

### Wait After Click

```bash
# Click and wait for result
agent-browser click @e3
agent-browser wait --load networkidle    # Wait for navigation
agent-browser wait --text "Success"      # Wait for confirmation
agent-browser wait @e5                   # Wait for element to appear
```

---

## Waiting Strategies

| Strategy | When to Use |
|----------|-------------|
| `wait --load networkidle` | After navigation, SPA rendering |
| `wait --text "Expected"` | When specific content must appear |
| `wait @e#` | When specific element must appear |
| `wait --url "**/path"` | After redirects |
| `wait --fn "expression"` | Custom JavaScript condition |
| `wait 2000` | Fixed delay (last resort) |

```bash
# Wait for JavaScript condition
agent-browser wait --fn "document.querySelector('.loaded') !== null"

# Wait with timeout
agent-browser wait --text "Results" --timeout 30000
```

---

## Screenshots and Recording

```bash
# Full page screenshot
agent-browser screenshot /tmp/page.png

# Start/stop video recording
agent-browser record start /tmp/recording.webm
# ... perform actions ...
agent-browser record stop
```

---

## JavaScript Evaluation

```bash
# Run arbitrary JavaScript
agent-browser eval "document.title"
agent-browser eval "window.location.href"
agent-browser eval "document.querySelectorAll('a').length"

# Modify page state
agent-browser eval "document.querySelector('#modal').style.display = 'none'"
```

---

## Best Practices

1. **Always snapshot before interacting** -- Refs may change after navigation
2. **Re-snapshot after significant DOM changes** -- New elements get new refs
3. **Use waits, not fixed delays** -- `wait --load networkidle` over `wait 2000`
4. **Use refs, not CSS selectors** -- Refs are stable within a snapshot
5. **Check for errors after form submission** -- Snapshot and look for error elements

# Playwright MCP Tools Reference

Complete reference for browser automation MCP tools available in Claude Code.

## Table of Contents

1. [Navigation Tools](#navigation-tools)
2. [Content Extraction Tools](#content-extraction-tools)
3. [Interaction Tools](#interaction-tools)
4. [Debugging Tools](#debugging-tools)
5. [Tool Selection Guide](#tool-selection-guide)

---

## Navigation Tools

### browser_navigate

Navigate to a URL.

```python
mcp__playwright__browser_navigate(url="https://example.com")
```

**Parameters:**
- `url` (required): Full URL to navigate to

**Returns:** Navigation result with page title

**Use when:** Starting any browser capture workflow

---

### browser_navigate_back

Go back to previous page.

```python
mcp__playwright__browser_navigate_back()
```

**Use when:** Returning from detail pages in crawl workflows

---

### browser_tabs

List and manage browser tabs.

```python
mcp__playwright__browser_tabs()
```

**Returns:** List of open tabs with URLs and titles

**Use when:** Managing multi-tab workflows

---

## Content Extraction Tools

### browser_snapshot

Get accessibility tree snapshot of current page.

```python
snapshot = mcp__playwright__browser_snapshot()
```

**Returns:** Structured representation of page content (accessibility tree format)

**Use when:**
- Understanding page structure before extraction
- Finding correct selectors for elements
- Quick overview of page content

**Note:** Returns accessibility tree, not raw HTML. Good for understanding structure.

---

### browser_evaluate

Execute JavaScript in the page context.

```python
content = mcp__playwright__browser_evaluate(script="""
    return document.querySelector('.main-content').innerText;
""")
```

**Parameters:**
- `script` (required): JavaScript code to execute

**Returns:** Result of JavaScript evaluation

**Common patterns:**

```javascript
// Extract text content
return document.querySelector('article').innerText;

// Extract multiple elements
return Array.from(document.querySelectorAll('h2'))
    .map(h => h.innerText);

// Extract structured data
return {
    title: document.querySelector('h1').innerText,
    content: document.querySelector('.content').innerHTML,
    links: Array.from(document.querySelectorAll('a')).map(a => a.href)
};

// Wait for async content
await new Promise(r => setTimeout(r, 2000));
return document.querySelector('.lazy-content').innerText;
```

**Use when:** Extracting specific content with custom logic

---

### browser_take_screenshot

Capture screenshot of current page.

```python
mcp__playwright__browser_take_screenshot()
```

**Returns:** Screenshot image (saved to temp file)

**Use when:**
- Visual verification of page state
- Debugging layout issues
- Documenting capture results

---

## Interaction Tools

### browser_click

Click an element on the page.

```python
mcp__playwright__browser_click(selector="button.submit")
```

**Parameters:**
- `selector` (required): CSS selector for element to click

**Use when:**
- Clicking navigation links
- Submitting forms
- Opening dropdowns/modals
- Pagination (next page buttons)

---

### browser_fill_form

Fill form fields with values.

```python
mcp__playwright__browser_fill_form(
    selector="#login-form",
    values={
        "username": "user@example.com",
        "password": "secret"
    }
)
```

**Parameters:**
- `selector` (required): CSS selector for form element
- `values` (required): Dictionary of field names to values

**Use when:** Authentication flows, search forms

---

### browser_type

Type text into an input field.

```python
mcp__playwright__browser_type(
    selector="#search-input",
    text="LangGraph tutorial"
)
```

**Parameters:**
- `selector` (required): CSS selector for input element
- `text` (required): Text to type

**Use when:** Single input fields, search boxes

---

### browser_press_key

Press a keyboard key.

```python
mcp__playwright__browser_press_key(key="Enter")
```

**Parameters:**
- `key` (required): Key to press (Enter, Tab, Escape, etc.)

**Use when:** Submitting after typing, keyboard navigation

---

### browser_select_option

Select option from dropdown.

```python
mcp__playwright__browser_select_option(
    selector="#version-select",
    value="v2.0"
)
```

**Parameters:**
- `selector` (required): CSS selector for select element
- `value` (required): Option value to select

**Use when:** Dropdown menus, version selectors

---

### browser_wait_for

Wait for an element to appear.

```python
mcp__playwright__browser_wait_for(
    selector=".content-loaded",
    timeout=10000
)
```

**Parameters:**
- `selector` (required): CSS selector to wait for
- `timeout` (optional): Max wait time in ms (default: 30000)

**Use when:**
- After navigation to wait for content
- After clicking to wait for response
- Before extracting dynamic content

**Critical:** Always use after `browser_navigate` for SPAs!

---

## Debugging Tools

### browser_console_messages

Get JavaScript console messages.

```python
messages = mcp__playwright__browser_console_messages()
```

**Returns:** List of console log/warn/error messages

**Use when:**
- Debugging JavaScript errors
- Understanding page behavior
- Checking for hydration issues

---

### browser_network_requests

Monitor network requests.

```python
requests = mcp__playwright__browser_network_requests()
```

**Returns:** List of XHR/fetch requests with URLs and responses

**Use when:**
- Finding API endpoints
- Understanding data sources
- Debugging failed requests

---

### browser_resize

Resize browser window.

```python
mcp__playwright__browser_resize(width=1920, height=1080)
```

**Parameters:**
- `width` (required): Window width in pixels
- `height` (required): Window height in pixels

**Use when:** Testing responsive layouts, capturing full-width content

---

## Tool Selection Guide

| Task | Primary Tool | Fallback |
|------|-------------|----------|
| Go to URL | `browser_navigate` | - |
| Get page structure | `browser_snapshot` | `browser_evaluate` |
| Extract text content | `browser_evaluate` | `browser_snapshot` |
| Click button/link | `browser_click` | `browser_evaluate` (click via JS) |
| Fill login form | `browser_fill_form` | `browser_type` per field |
| Wait for SPA render | `browser_wait_for` | `browser_evaluate` with delay |
| Debug issues | `browser_console_messages` | `browser_network_requests` |
| Visual verification | `browser_take_screenshot` | - |

---

## Common Workflows

### Basic Content Extraction

```python
# 1. Navigate
mcp__playwright__browser_navigate(url="https://docs.example.com/guide")

# 2. Wait for content
mcp__playwright__browser_wait_for(selector="article")

# 3. Extract
content = mcp__playwright__browser_evaluate(script="""
    const article = document.querySelector('article');
    return {
        title: article.querySelector('h1').innerText,
        content: article.innerText
    };
""")
```

### Authenticated Access

```python
# 1. Navigate to login
mcp__playwright__browser_navigate(url="https://app.example.com/login")

# 2. Fill credentials
mcp__playwright__browser_fill_form(
    selector="form",
    values={"email": "...", "password": "..."}
)

# 3. Submit
mcp__playwright__browser_click(selector="button[type=submit]")

# 4. Wait for dashboard
mcp__playwright__browser_wait_for(selector=".dashboard")

# 5. Navigate to target
mcp__playwright__browser_navigate(url="https://app.example.com/docs")
```

### Multi-Page Crawl

```python
# 1. Get all links
links = mcp__playwright__browser_evaluate(script="""
    return Array.from(document.querySelectorAll('nav a'))
        .map(a => a.href);
""")

# 2. Visit each page
for url in links:
    mcp__playwright__browser_navigate(url=url)
    mcp__playwright__browser_wait_for(selector=".content")
    content = mcp__playwright__browser_evaluate(
        script="document.querySelector('.content').innerText"
    )
    # Process content...
```

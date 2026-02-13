# Content Extraction

Patterns for extracting text, HTML, and structured data from web pages using agent-browser.

## Extraction Methods

| Method | Use Case | Context Cost |
|--------|----------|-------------|
| `get text @e#` | Extract specific element text | Low |
| `get html @e#` | Get element HTML structure | Medium |
| `eval "<js>"` | Custom JavaScript extraction | Variable |
| `get text body` | Full page text (last resort) | High |

---

## Targeted Extraction with Refs

### Identify Content Area

```bash
# Navigate and snapshot
agent-browser open https://docs.example.com/article
agent-browser wait --load networkidle
agent-browser snapshot -i

# Identify main content ref from snapshot output
# Example output: @e5 [article] "Main Content Area"
agent-browser get text @e5
```

### Extract Multiple Elements

```bash
# Get specific sections
agent-browser get text @e3   # Title
agent-browser get text @e5   # Main content
agent-browser get text @e8   # Sidebar

# Get HTML for structured content
agent-browser get html @e5   # Preserves formatting
```

---

## JavaScript-Based Extraction

### Custom Selectors

```bash
# Extract by CSS selector
agent-browser eval "document.querySelector('article').innerText"

# Extract by class
agent-browser eval "document.querySelector('.main-content').innerText"

# Extract by ID
agent-browser eval "document.getElementById('content').innerText"
```

### Extract Links

```bash
# All links on page
agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('a')).map(a => ({text: a.innerText, href: a.href})))"

# Navigation links only
agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('nav a')).map(a => ({text: a.innerText.trim(), href: a.href})))"
```

### Extract Tables

```bash
# Convert table to JSON
agent-browser eval "
const rows = document.querySelectorAll('table tr');
const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText.trim());
const data = Array.from(rows).slice(1).map(row =>
    Object.fromEntries(
        Array.from(row.querySelectorAll('td')).map((td, i) => [headers[i], td.innerText.trim()])
    )
);
JSON.stringify(data, null, 2);
"
```

### Extract Metadata

```bash
# Page title and description
agent-browser eval "JSON.stringify({
    title: document.title,
    description: document.querySelector('meta[name=\"description\"]')?.content || '',
    canonical: document.querySelector('link[rel=\"canonical\"]')?.href || '',
    ogImage: document.querySelector('meta[property=\"og:image\"]')?.content || ''
})"
```

---

## Clean Content Extraction

### Remove Noise Before Extraction

```bash
# Remove non-content elements
agent-browser eval "
['nav', 'header', 'footer', '.sidebar', '.ads', '.cookie-banner', '.popup']
    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
const main = document.querySelector('main, article, .content, #content');
main ? main.innerText : document.body.innerText;
"
```

### Extract with Formatting

```bash
# Get clean text with line breaks preserved
agent-browser eval "
const content = document.querySelector('article');
// Replace block elements with newlines
const clone = content.cloneNode(true);
clone.querySelectorAll('br').forEach(br => br.replaceWith('\\n'));
clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
    el.prepend(document.createTextNode('\\n'));
});
clone.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();
"
```

---

## Network-Level Extraction

### Monitor API Calls

```bash
# See XHR/fetch requests the page makes
agent-browser network requests

# Find API endpoints serving data
agent-browser eval "
performance.getEntriesByType('resource')
    .filter(r => r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'fetch')
    .map(r => r.name)
"
```

### Intercept JSON Responses

When the page loads data via API, it may be easier to call the API directly:

```bash
# Find the API endpoint from network tab
agent-browser network requests
# Output shows: GET https://api.example.com/v1/articles?page=1

# Call API directly (faster than browser extraction)
curl -s https://api.example.com/v1/articles?page=1 | jq .
```

---

## Iframe Content

```bash
# Switch to iframe context
agent-browser frame @e3

# Extract from iframe
agent-browser get text body

# Return to main frame
agent-browser frame main
```

---

## Console Output

```bash
# Read JavaScript console messages
agent-browser console

# Useful for debugging extraction issues
# Shows errors, warnings, and log output
```

---

## Best Practices

1. **Use targeted extraction** -- `get text @e#` over `get text body` to minimize noise
2. **Remove noise elements first** -- Delete nav, header, footer, ads before extraction
3. **Cache extracted content** -- Save to file to avoid re-scraping
4. **Try WebFetch first** -- 10x faster for static content, no browser overhead
5. **Check network tab** -- API endpoints may provide cleaner data than DOM extraction
6. **Handle empty content** -- Always check if extraction returned meaningful content

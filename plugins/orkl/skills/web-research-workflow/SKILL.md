---
name: web-research-workflow
description: Unified decision tree for web research. Auto-selects WebFetch vs agent-browser based on target site characteristics. Use when researching web content, scraping, or capturing documentation.
context: fork
agent: web-research-analyst
version: 1.0.0
author: OrchestKit AI Agent Hub
tags: [research, browser, webfetch, automation, scraping]
user-invocable: false
allowedTools: [Bash, Read, Write, WebFetch]
complexity: low
---

# Web Research Workflow

Unified approach for web content research that automatically selects the right tool for each situation.

## Quick Decision Tree

```
URL to research
     │
     ▼
┌─────────────────┐
│ Try WebFetch    │ ← Fast, no browser overhead
│ (first choice)  │
└─────────────────┘
     │
Content OK? ──Yes──► Parse and return
     │
     No (empty/partial/JS-required)
     │
     ▼
┌─────────────────────┐
│ Use agent-browser   │
└─────────────────────┘
     │
├─ SPA (react/vue/angular) ──► wait --load networkidle
├─ Login required ──► auth flow + state save
├─ Dynamic content ──► wait --text "Expected"
└─ Multi-page ──► crawl pattern
```

## When to Use What

| Scenario | Tool | Why |
|----------|------|-----|
| Static HTML page | WebFetch | Fast, no browser needed |
| Public API docs | WebFetch | Usually server-rendered |
| GitHub README | WebFetch | Static content |
| React/Vue/Angular app | agent-browser | Needs JS execution |
| Interactive pricing page | agent-browser | Dynamic content |
| Login-protected content | agent-browser | Needs session state |
| Swagger UI | agent-browser | Client-rendered |
| Documentation with sidebar nav | agent-browser | Client-side routing |

## Pattern 1: Auto-Fallback

Try WebFetch first, fall back to browser if needed:

```bash
# Step 1: Try WebFetch
WebFetch(url="https://example.com", prompt="Extract main content")

# If result is empty, partial, or contains "Loading..." indicators:
# Step 2: Fall back to browser
agent-browser open https://example.com
agent-browser wait --load networkidle
agent-browser get text body
```

### Detection Heuristics

Content likely needs browser if WebFetch returns:
- Empty or very short content (< 500 chars)
- Contains `<noscript>` tags
- Contains "Loading...", "Please wait", "JavaScript required"
- Contains only `<div id="root"></div>` or `<div id="app"></div>`
- Returns 403/401 (may need auth)

## Pattern 2: SPA Detection

Known patterns that always need browser:

```bash
# URL patterns suggesting SPA
app.* | dashboard.* | portal.* | console.*

# Framework indicators in initial HTML
"__NEXT_DATA__"     → Next.js (may work with WebFetch)
"window.__NUXT__"   → Nuxt.js (may work with WebFetch)
"ng-app"            → Angular (needs browser)
"data-reactroot"    → React (needs browser)
"data-v-"           → Vue (needs browser)
```

## Pattern 3: Authentication Flow

For login-protected content:

```bash
# 1. Navigate to login
agent-browser open https://app.example.com/login
agent-browser snapshot -i

# 2. Fill credentials (use refs from snapshot)
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3  # Submit button

# 3. Wait for redirect
agent-browser wait --url "**/dashboard"

# 4. Save session for reuse
agent-browser state save /tmp/session-example.json

# 5. Later: restore session
agent-browser state load /tmp/session-example.json
agent-browser open https://app.example.com/protected-page
```

## Pattern 4: Multi-Page Research

For documentation sites or multi-page content:

```bash
# 1. Get navigation links
agent-browser open https://docs.example.com
agent-browser snapshot -i

# 2. Extract all doc links
LINKS=$(agent-browser eval "JSON.stringify(
  Array.from(document.querySelectorAll('nav a'))
    .map(a => a.href)
    .filter(h => h.includes('/docs/'))
)")

# 3. Iterate with rate limiting
for link in $(echo "$LINKS" | jq -r '.[]' | head -20); do
  agent-browser open "$link"
  agent-browser wait --load networkidle
  agent-browser get text article > "/tmp/doc-$(basename $link).txt"
  sleep 2  # Rate limit
done
```

## Best Practices

### 1. Always Try WebFetch First
```bash
# WebFetch is 10x faster and uses no browser resources
# Only fall back to browser when necessary
```

### 2. Use Appropriate Waits
```bash
# For SPAs with API calls
agent-browser wait --load networkidle

# For specific content
agent-browser wait --text "Expected content"

# For elements
agent-browser wait @e5
```

### 3. Respect Rate Limits
```bash
# Add delays between requests
sleep 2

# Use session isolation for parallel work
agent-browser --session site1 open https://site1.com
agent-browser --session site2 open https://site2.com
```

### 4. Cache Results
```bash
# Save extracted content to avoid re-scraping
agent-browser get text body > /tmp/cache/example-com.txt
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content from WebFetch | Use agent-browser with networkidle wait |
| Partial content | Use `wait --text "Expected"` for specific content |
| 403 Forbidden | May need authentication flow |
| CAPTCHA | Manual intervention required |
| Rate limited | Add delays, reduce request frequency |
| Content in iframe | Use `agent-browser frame @e1` then extract |

## Integration with Agents

This skill is used by:
- `web-research-analyst` - Primary user
- `market-intelligence` - Competitor research
- `product-strategist` - Deep competitive analysis
- `ux-researcher` - Design system capture
- `documentation-specialist` - API doc extraction

## Related Skills

- `browser-content-capture` - Detailed browser patterns
- `agent-browser` - CLI reference
- `competitive-monitoring` - Change tracking

---

**Version:** 1.0.0 (February )

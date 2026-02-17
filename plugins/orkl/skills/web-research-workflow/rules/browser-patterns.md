---
title: Browser Patterns
impact: MEDIUM
impactDescription: "Fallback browser automation patterns when WebFetch and Tavily are insufficient"
tags: browser, automation, fallback
---

# Browser Patterns

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

## Pattern 2: Authentication Flow

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

## Pattern 3: Multi-Page Research

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

### Use Appropriate Waits
```bash
# For SPAs with API calls
agent-browser wait --load networkidle

# For specific content
agent-browser wait --text "Expected content"

# For elements
agent-browser wait @e5
```

### Respect Rate Limits
```bash
# Add delays between requests
sleep 2

# Use session isolation for parallel work
agent-browser --session site1 open https://site1.com
agent-browser --session site2 open https://site2.com
```

### Cache Results
```bash
# Save extracted content to avoid re-scraping
agent-browser get text body > /tmp/cache/example-com.txt
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content from WebFetch | Try Tavily extract, then agent-browser |
| WebFetch returns <500 chars | Escalate to Tavily extract if API key set |
| Partial content | Use `wait --text "Expected"` for specific content |
| Need batch URL extraction | Tavily extract (up to 20 URLs at once) |
| 403 Forbidden | May need authentication flow (agent-browser) |
| CAPTCHA | Manual intervention required |
| Rate limited | Add delays, reduce request frequency |
| Content in iframe | Use `agent-browser frame @e1` then extract |
| No TAVILY_API_KEY | Skip Tavily tier, use WebFetch → agent-browser |

**Incorrect — Browser without waiting for content:**
```bash
agent-browser open https://spa-app.com
agent-browser get text body
# Returns empty - content not loaded yet
```

**Correct — Wait for network idle before extracting:**
```bash
agent-browser open https://spa-app.com
agent-browser wait --load networkidle
agent-browser get text body
# Content fully loaded
```

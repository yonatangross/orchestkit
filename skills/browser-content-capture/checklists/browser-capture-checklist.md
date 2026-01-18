# Browser Content Capture Checklist

Use this checklist when capturing content from web pages using agent-browser.

## Pre-Capture

- [ ] **Try WebFetch first** - Only use browser if WebFetch fails
- [ ] **Check robots.txt** - Ensure scraping is allowed
- [ ] **Verify ToS** - Review site's terms of service
- [ ] **Identify page type** - Static, SPA, or auth-protected?

## Page Analysis

- [ ] **Find content selector** - Identify main content container
  - Common: `article`, `main`, `.content`, `.markdown-body`
- [ ] **Find navigation selector** - For multi-page crawls
  - Common: `nav a`, `.sidebar a`, `.toc a`
- [ ] **Check for dynamic loading** - Lazy content, infinite scroll?
- [ ] **Identify loading indicators** - Spinners, skeletons, etc.
- [ ] **Note framework** - React, Vue, Angular, Next.js, Nuxt?

## Capture Configuration

- [ ] **Set appropriate wait** - `networkidle` for SPAs
- [ ] **Add hydration wait** - `wait --fn` for React/Vue
- [ ] **Configure rate limiting** - 1-2 seconds between pages
- [ ] **Plan error handling** - Retry logic for failures

## Single Page Capture

```bash
# 1. Navigate
agent-browser open "$TARGET_URL"

# 2. Wait for content
agent-browser wait --load networkidle

# 3. Get snapshot to identify elements
agent-browser snapshot -i

# 4. Extract content
agent-browser get text body
# Or use specific ref: agent-browser get text @e5
```

- [ ] Navigation successful
- [ ] Content visible in snapshot
- [ ] Extracted content is complete (not partial)
- [ ] No JavaScript errors (`agent-browser errors`)

## Multi-Page Crawl

- [ ] **Discover all pages** - Extract navigation links first
- [ ] **Deduplicate URLs** - Remove duplicate/anchor links
- [ ] **Order pages logically** - Follow site structure
- [ ] **Track visited pages** - Prevent infinite loops
- [ ] **Handle pagination** - Next/Previous links

```bash
# Get all nav links
LINKS=$(agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('nav a')).map(a => a.href))")

# Crawl each
for link in $(echo "$LINKS" | jq -r '.[]'); do
    agent-browser open "$link"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename $link).txt"
    sleep 1
done
```

## Authentication Handling

- [ ] **Check if login required** - Detect login redirects
- [ ] **Choose auth method**:
  - [ ] Form-based login (`fill @e1`, `click @e2`)
  - [ ] Headed mode for OAuth/SSO (`AGENT_BROWSER_HEADED=1`)
  - [ ] Restore saved state (`state load`)
- [ ] **Store no credentials in code** - Use environment variables
- [ ] **Verify login success** - Check URL after redirect
- [ ] **Save state for reuse** - `agent-browser state save`

```bash
# Login flow
agent-browser open "$LOGIN_URL"
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save /tmp/auth.json
```

## Content Extraction

- [ ] **Remove noise elements** - Nav, header, footer, ads
- [ ] **Extract clean text** - `get text` or `eval innerText`
- [ ] **Preserve structure** - Headings, lists, code blocks
- [ ] **Extract code separately** - Language detection, formatting
- [ ] **Capture metadata** - Title, URL, date

```bash
# Clean extraction
agent-browser eval "
['nav', 'header', 'footer', '.sidebar'].forEach(sel =>
    document.querySelectorAll(sel).forEach(el => el.remove()));
document.querySelector('main, article, .content').innerText;
"
```

## Post-Capture

- [ ] **Validate content** - Not empty, not error page
- [ ] **Clean whitespace** - Remove excessive newlines
- [ ] **Word count check** - Reasonable length for page type
- [ ] **Take screenshot** - Visual verification

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content | Add `wait --load networkidle` |
| Partial render | Use `wait --fn "..."` with specific check |
| Login redirect | Use authentication flow with `state save/load` |
| Rate limited | Increase `sleep` between pages |
| JavaScript error | Check `agent-browser errors` |
| Wrong content | Verify ref in `snapshot -i` |
| Session expired | Check URL, re-authenticate if `/login` |

## Quality Verification

- [ ] **Random sample check** - Review 3-5 captured pages manually
- [ ] **Search test** - Query for expected content
- [ ] **Compare to source** - Ensure no content lost
- [ ] **Check code blocks** - Properly formatted and complete

## Documentation

- [ ] **Record capture date** - For freshness tracking
- [ ] **Note refs used** - For future re-crawls
- [ ] **Document failures** - Pages that couldn't be captured
- [ ] **Save capture scripts** - For reproducibility

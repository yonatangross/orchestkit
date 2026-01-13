# Browser Content Capture Checklist

Use this checklist when capturing content from web pages using browser automation.

## Pre-Capture

- [ ] **Try WebFetch first** - Only use browser if WebFetch fails
- [ ] **Check robots.txt** - Ensure scraping is allowed
- [ ] **Verify ToS** - Review site's terms of service
- [ ] **Identify page type** - Static, SPA, or auth-protected?
- [ ] **Choose tool** - Playwright MCP vs Chrome extension

## Page Analysis

- [ ] **Find content selector** - Identify main content container
  - Common: `article`, `main`, `.content`, `.markdown-body`
- [ ] **Find navigation selector** - For multi-page crawls
  - Common: `nav a`, `.sidebar a`, `.toc a`
- [ ] **Check for dynamic loading** - Lazy content, infinite scroll?
- [ ] **Identify loading indicators** - Spinners, skeletons, etc.
- [ ] **Note framework** - React, Vue, Angular, Next.js, Nuxt?

## Capture Configuration

- [ ] **Set appropriate timeout** - 5000ms for static, 15000ms for SPAs
- [ ] **Add hydration wait** - Extra delay for React/Vue
- [ ] **Configure rate limiting** - 1-2 seconds between pages
- [ ] **Plan error handling** - Retry logic for failures

## Single Page Capture

```python
# 1. Navigate
mcp__playwright__browser_navigate(url=target_url)

# 2. Wait for content
mcp__playwright__browser_wait_for(selector=content_selector, timeout=timeout)

# 3. Optional: Extra delay for SPAs
mcp__playwright__browser_evaluate(script="await new Promise(r => setTimeout(r, 1000))")

# 4. Extract content
content = mcp__playwright__browser_evaluate(script=extraction_script)
```

- [ ] Navigation successful
- [ ] Content selector found
- [ ] Extracted content is complete (not partial)
- [ ] No JavaScript errors in console

## Multi-Page Crawl

- [ ] **Discover all pages** - Extract navigation links first
- [ ] **Deduplicate URLs** - Remove duplicate/anchor links
- [ ] **Order pages logically** - Follow site structure
- [ ] **Track visited pages** - Prevent infinite loops
- [ ] **Handle pagination** - Next/Previous links

## Authentication Handling

- [ ] **Check if login required** - Detect login redirects
- [ ] **Choose auth method**:
  - [ ] Form-based login (browser_fill_form)
  - [ ] Chrome extension (user session)
  - [ ] OAuth/SSO (requires user intervention)
- [ ] **Store no credentials in code** - Use environment variables
- [ ] **Verify login success** - Check for dashboard/profile elements
- [ ] **Handle session expiry** - Re-authenticate if redirected

## Content Extraction

- [ ] **Remove noise elements** - Nav, header, footer, ads
- [ ] **Extract clean text** - innerText, not innerHTML
- [ ] **Preserve structure** - Headings, lists, code blocks
- [ ] **Extract code separately** - Language detection, formatting
- [ ] **Capture metadata** - Title, author, date, URL

## Post-Capture

- [ ] **Validate content** - Not empty, not error page
- [ ] **Clean whitespace** - Remove excessive newlines
- [ ] **Word count check** - Reasonable length for page type
- [ ] **Queue to SkillForge** - Send for analysis

## SkillForge Integration

```python
from templates.queue_to_skillforge import SkillForgeClient

client = SkillForgeClient()
result = await client.queue_for_analysis(
    url=captured_url,
    content=captured_content,
    title=captured_title
)
```

- [ ] Content sent successfully
- [ ] Analysis ID received
- [ ] Monitor progress via SSE
- [ ] Verify searchable in SkillForge

## Troubleshooting

| Issue | Check |
|-------|-------|
| Empty content | Add wait_for, increase timeout |
| Partial render | Add explicit delay after navigation |
| Login redirect | Check authentication, use Chrome ext |
| Rate limited | Increase delay between pages |
| JavaScript error | Check browser_console_messages |
| Wrong content | Verify content selector |

## Quality Verification

- [ ] **Random sample check** - Review 3-5 captured pages manually
- [ ] **Search test** - Query SkillForge for expected content
- [ ] **Compare to source** - Ensure no content lost
- [ ] **Check code blocks** - Properly formatted and complete

## Documentation

- [ ] **Record capture date** - For freshness tracking
- [ ] **Note selectors used** - For future re-crawls
- [ ] **Document failures** - Pages that couldn't be captured
- [ ] **Save capture config** - For reproducibility

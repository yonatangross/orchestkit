---
name: browser-content-capture
description: Capture content from JavaScript-rendered pages, login-protected sites, and multi-page documentation using Playwright MCP tools or Claude Chrome extension. Use when WebFetch fails on SPAs, dynamic content, or auth-required pages. Integrates with SkillForge's analysis pipeline for automatic content processing.
context: fork
agent: data-pipeline-engineer
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [browser, playwright, mcp, scraping, spa, authentication, chrome-extension, 2025]
---

# Browser Content Capture

**Capture web content that traditional scrapers cannot access.**

## Overview

This skill enables content extraction from sources that require browser-level access:
- **JavaScript-rendered SPAs** (React, Vue, Angular apps)
- **Login-protected documentation** (private wikis, gated content)
- **Dynamic content** (infinite scroll, lazy loading, client-side routing)
- **Multi-page site crawls** (documentation trees, tutorial series)

## When to Use This Skill

**Use when:**
- `WebFetch` returns empty or partial content
- Page requires JavaScript execution to render
- Content is behind authentication
- Need to navigate multi-page structures
- Extracting from client-side routed apps

**Do NOT use when:**
- Static HTML pages (use `WebFetch` - faster)
- Public API endpoints (use direct HTTP calls)
- Simple RSS/Atom feeds

---

## Quick Start

### Check Available MCP Tools

```
MCPSearch: "select:mcp__playwright__browser_navigate"
```

### Basic Capture Pattern

```python
# 1. Navigate to URL
mcp__playwright__browser_navigate(url="https://docs.example.com")

# 2. Wait for content to render
mcp__playwright__browser_wait_for(selector=".main-content", timeout=5000)

# 3. Capture page snapshot
snapshot = mcp__playwright__browser_snapshot()

# 4. Extract text content
content = mcp__playwright__browser_evaluate(
    script="document.querySelector('.main-content').innerText"
)
```

---

## MCP Tools Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `browser_navigate` | Go to URL | First step of any capture |
| `browser_snapshot` | Get DOM/accessibility tree | Understanding page structure |
| `browser_evaluate` | Run custom JS | Extract specific content |
| `browser_click` | Click elements | Navigate menus, pagination |
| `browser_fill_form` | Fill inputs | Authentication flows |
| `browser_wait_for` | Wait for selector | Dynamic content loading |
| `browser_take_screenshot` | Capture image | Visual verification |
| `browser_console_messages` | Read JS console | Debug extraction issues |
| `browser_network_requests` | Monitor XHR/fetch | Find API endpoints |

**Full tool documentation:** See [references/mcp-tools.md](references/mcp-tools.md)

---

## Capture Patterns

### Pattern 1: SPA Content Extraction

For React/Vue/Angular apps where content renders client-side:

```python
# Navigate and wait for hydration
mcp__playwright__browser_navigate(url="https://react-docs.example.com")
mcp__playwright__browser_wait_for(selector="[data-hydrated='true']", timeout=10000)

# Extract after React mounts
content = mcp__playwright__browser_evaluate(script="""
    // Wait for React to finish rendering
    await new Promise(r => setTimeout(r, 1000));
    return document.querySelector('article').innerText;
""")
```

**Details:** See [references/spa-extraction.md](references/spa-extraction.md)

### Pattern 2: Authentication Flow

For login-protected content:

```python
# Navigate to login
mcp__playwright__browser_navigate(url="https://docs.example.com/login")

# Fill credentials (prompt user for values)
mcp__playwright__browser_fill_form(
    selector="#login-form",
    values={"username": "...", "password": "..."}
)

# Click submit and wait for redirect
mcp__playwright__browser_click(selector="button[type='submit']")
mcp__playwright__browser_wait_for(selector=".dashboard", timeout=10000)

# Now navigate to protected content
mcp__playwright__browser_navigate(url="https://docs.example.com/private-docs")
```

**Details:** See [references/auth-handling.md](references/auth-handling.md)

### Pattern 3: Multi-Page Crawl

For documentation with navigation trees:

```python
# Get all page links from sidebar
links = mcp__playwright__browser_evaluate(script="""
    return Array.from(document.querySelectorAll('nav a'))
        .map(a => ({href: a.href, text: a.innerText}));
""")

# Iterate and capture each page
for link in links:
    mcp__playwright__browser_navigate(url=link['href'])
    mcp__playwright__browser_wait_for(selector=".content")
    content = mcp__playwright__browser_evaluate(
        script="document.querySelector('.content').innerText"
    )
    # Queue to SkillForge...
```

**Details:** See [references/multi-page-crawl.md](references/multi-page-crawl.md)

---

## SkillForge Integration

After capturing content, queue it to SkillForge's analysis pipeline:

```python
import httpx

async def queue_to_skillforge(content: str, source_url: str):
    """Send captured content to SkillForge for analysis."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8500/api/v1/analyze",
            json={
                "url": source_url,
                "content_override": content,  # Skip scraping, use captured
                "source": "browser_capture"
            }
        )
        return response.json()["analysis_id"]
```

**Full integration:** See [templates/queue-to-skillforge.py](templates/queue-to-skillforge.py)

---

## Fallback Strategy

Use this decision tree for content capture:

```
User requests content from URL
         │
         ▼
    ┌─────────────┐
    │ Try WebFetch│ ← Fast, no browser needed
    └─────────────┘
         │
    Content OK? ──Yes──► Done
         │
         No (empty/partial)
         │
         ▼
    ┌──────────────────┐
    │ Check URL pattern│
    └──────────────────┘
         │
    ├─ Known SPA (react, vue, angular) ──► Playwright MCP
    ├─ Requires login ──► Chrome Extension (user session)
    └─ Dynamic content ──► Playwright MCP with wait_for
```

---

## Best Practices

### 1. Minimize Browser Usage
- Always try `WebFetch` first (10x faster, no browser overhead)
- Cache extracted content to avoid re-scraping
- Use `browser_evaluate` to extract only needed content

### 2. Handle Dynamic Content
- Always use `wait_for` after navigation
- Add delays for heavy SPAs: `await new Promise(r => setTimeout(r, 2000))`
- Check for loading spinners before extracting

### 3. Respect Rate Limits
- Add delays between page navigations
- Don't crawl faster than a human would browse
- Honor robots.txt and terms of service

### 4. Clean Extracted Content
- Remove navigation, headers, footers
- Strip ads and promotional content
- Convert to clean markdown before sending to SkillForge

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content | Add `wait_for` with appropriate selector |
| Partial render | Increase timeout or add explicit delay |
| Login required | Use Chrome extension with user session |
| CAPTCHA blocking | Manual intervention required |
| Content in iframe | Use `browser_evaluate` to access iframe content |

---

## Related Skills

- `webapp-testing` - Playwright test automation patterns
- `streaming-api-patterns` - Handle SSE progress updates from SkillForge
- `ai-native-development` - RAG pipeline integration

---

**Version:** 1.0.0 (December 2025)
**MCP Requirement:** Playwright MCP server or Claude Chrome extension

## Capability Details

### spa-extraction
**Keywords:** react, vue, angular, spa, javascript, client-side, hydration, ssr
**Solves:**
- WebFetch returns empty content
- Page requires JavaScript to render
- React/Vue app content extraction

### auth-handling
**Keywords:** login, authentication, session, cookie, protected, private, gated
**Solves:**
- Content behind login wall
- Need to authenticate first
- Private documentation access

### multi-page-crawl
**Keywords:** crawl, sitemap, navigation, multiple pages, documentation, tutorial series
**Solves:**
- Capture entire documentation site
- Extract multiple pages
- Follow navigation links

### mcp-tools
**Keywords:** playwright, mcp, browser_navigate, browser_evaluate, browser_click
**Solves:**
- Which MCP tool to use
- Browser automation commands
- Playwright MCP reference

### skillforge-integration
**Keywords:** queue, analyze, pipeline, api, skillforge, content_override
**Solves:**
- Send captured content to SkillForge
- Queue URL for analysis
- Integrate with analysis pipeline

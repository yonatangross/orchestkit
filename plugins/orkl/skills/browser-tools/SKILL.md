---
name: browser-tools
description: Browser automation and content capture patterns for Playwright, Puppeteer, web scraping, and structured data extraction. Use when automating browser workflows, capturing web content, or extracting structured data from web pages.
tags: [browser, automation, playwright, puppeteer, scraping, content-capture]
context: fork
agent: web-research-analyst
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
---

# Browser Tools

Browser automation and content capture patterns using agent-browser CLI, Playwright, and Puppeteer. Each category has individual rule files in `references/` loaded on-demand.

## Quick Reference

| Category | Rules | When to Use |
|----------|-------|-------------|
| [Playwright Setup](#playwright-setup) | 1 | Installing and configuring Playwright for automation |
| [Page Interaction](#page-interaction) | 1 | Clicking, filling forms, navigating with snapshot + refs |
| [Content Extraction](#content-extraction) | 1 | Extracting text, HTML, structured data from pages |
| [SPA Extraction](#spa-extraction) | 1 | React, Vue, Angular apps with client-side rendering |
| [Scraping Strategies](#scraping-strategies) | 1 | Multi-page crawls, pagination, recursive crawling |
| [Anti-Bot Handling](#anti-bot-handling) | 1 | Rate limiting, CAPTCHA, session management |
| [Authentication Flows](#authentication-flows) | 1 | Login forms, OAuth, SSO, session persistence |
| [Structured Output](#structured-output) | 1 | Converting scraped content to clean markdown/JSON |

**Total: 8 rules across 8 categories**

## Quick Start

```bash
# Install agent-browser
npm install -g agent-browser
agent-browser install                # Download Chromium

# Basic capture workflow
agent-browser open https://example.com
agent-browser wait --load networkidle
agent-browser snapshot -i            # Get interactive elements with @refs
agent-browser get text @e5           # Extract content by ref
agent-browser screenshot /tmp/page.png
agent-browser close
```

```bash
# Fallback decision tree
# 1. Try WebFetch first (fast, no browser overhead)
# 2. If empty/partial -> use agent-browser
# 3. If SPA -> wait --load networkidle
# 4. If login required -> authentication flow + state save
# 5. If dynamic -> wait @element or wait --text
```

```bash
# Authentication with state persistence
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save /tmp/auth-state.json
```

```bash
# SPA extraction (React/Vue/Angular)
agent-browser open https://react-app.example.com
agent-browser wait --load networkidle
agent-browser eval "document.querySelector('article').innerText"
```

## Playwright Setup

Browser automation setup using agent-browser CLI (93% less context than full Playwright MCP) or Playwright directly.

| Rule | Description |
|------|-------------|
| `playwright-setup.md` | Installation, configuration, environment variables, cloud providers |

**Key Decisions:** agent-browser CLI preferred | `snapshot -i` for element discovery | `--session` for parallel isolation

## Page Interaction

Interact with page elements using snapshot refs for clicking, filling, and navigating.

| Rule | Description |
|------|-------------|
| `page-interaction.md` | Click, fill, navigate, wait patterns using snapshot refs |

**Key Decisions:** Always re-snapshot after navigation | Use refs (@e1) not CSS selectors | Wait for networkidle after navigation

## Content Extraction

Extract text, HTML, and structured data from web pages.

| Rule | Description |
|------|-------------|
| `content-extraction.md` | Text extraction, HTML capture, JavaScript eval for custom extraction |

**Key Decisions:** Use targeted refs over full-body extraction | Remove noise elements before extraction | Cache extracted content

## SPA Extraction

Extract content from JavaScript-rendered Single Page Applications.

| Rule | Description |
|------|-------------|
| `spa-extraction.md` | React, Vue, Angular, Next.js, Nuxt, Docusaurus extraction patterns |

**Key Decisions:** Wait for hydration, not just DOM ready | Use framework-specific detection | Handle infinite scroll and lazy loading

## Scraping Strategies

Multi-page crawling, pagination handling, and recursive site extraction.

| Rule | Description |
|------|-------------|
| `scraping-strategies.md` | Multi-page crawl, pagination, recursive depth-limited crawling, parallel sessions |

**Key Decisions:** Extract links first, then visit | Depth-limit recursive crawls | Use parallel sessions for throughput

## Anti-Bot Handling

Rate limiting, CAPTCHA handling, session management, and respectful scraping.

| Rule | Description |
|------|-------------|
| `anti-bot-handling.md` | Rate limiting, robots.txt, CAPTCHA, error handling, resume capability |

**Key Decisions:** Always check robots.txt | Add delays between requests | Use headed mode for CAPTCHA | Implement resume capability

## Authentication Flows

Login forms, OAuth/SSO flows, session persistence, and multi-step authentication.

| Rule | Description |
|------|-------------|
| `auth-flows.md` | Form login, OAuth popup, SSO redirect, state save/restore, session management |

**Key Decisions:** Save state after login | Use headed mode for OAuth/SSO | Never hardcode credentials | Clean up state files

## Structured Output

Convert scraped content to clean, structured formats for downstream processing.

| Rule | Description |
|------|-------------|
| `structured-output.md` | Markdown conversion, JSON extraction, metadata preservation, content cleaning |

**Key Decisions:** Remove noise elements before extraction | Preserve metadata (title, URL, timestamp) | Validate extracted data structure

## Anti-Patterns (FORBIDDEN)

```bash
# Automation
agent-browser fill @e2 "hardcoded-password"    # Never hardcode credentials
agent-browser open "$UNVALIDATED_URL"          # Always validate URLs

# Scraping
# Crawling without checking robots.txt
# No delay between requests (hammering servers)
# Ignoring rate limit responses (429)

# Content capture
agent-browser get text body                    # Prefer targeted ref extraction
# Trusting page content without validation
# Not waiting for SPA hydration before extraction

# Session management
# Storing auth state in code repositories
# Not cleaning up state files after use
```

## Agent-Browser Key Commands

| Command | Purpose |
|---------|---------|
| `open <url>` | Navigate to URL |
| `snapshot -i` | Interactive elements with refs |
| `click @e1` | Click element |
| `fill @e2 "text"` | Clear + type into input |
| `get text @e1` | Extract element text |
| `get html @e1` | Get element HTML |
| `eval "<js>"` | Run custom JavaScript |
| `wait --load networkidle` | Wait for SPA render |
| `wait --text "Expected"` | Wait for specific text |
| `wait @e1` | Wait for element |
| `screenshot <path>` | Save screenshot |
| `state save <file>` | Persist cookies/storage |
| `state load <file>` | Restore session |
| `--session <name>` | Isolate parallel sessions |
| `--headed` | Show browser window |
| `console` | Read JS console |
| `network requests` | Monitor XHR/fetch |
| `record start <path>` | Start video recording |
| `record stop` | Stop recording |
| `close` | Close browser |

Run `agent-browser --help` for the full 60+ command reference.

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/playwright-setup.md](references/playwright-setup.md) | Installation, configuration, environment variables |
| [references/page-interaction.md](references/page-interaction.md) | Click, fill, navigate, wait patterns |
| [references/content-extraction.md](references/content-extraction.md) | Text, HTML, and JS-based content extraction |
| [references/spa-extraction.md](references/spa-extraction.md) | React, Vue, Angular, Next.js extraction |
| [references/scraping-strategies.md](references/scraping-strategies.md) | Multi-page crawl, pagination, parallel sessions |
| [references/anti-bot-handling.md](references/anti-bot-handling.md) | Rate limiting, robots.txt, CAPTCHA, resume |
| [references/auth-flows.md](references/auth-flows.md) | Login, OAuth, SSO, session persistence |
| [references/structured-output.md](references/structured-output.md) | Markdown/JSON conversion, metadata, validation |

## Related Skills

- `testing-patterns` - Comprehensive testing patterns including E2E and webapp testing
- `api-design` - API design patterns for endpoints discovered during scraping
- `data-visualization` - Visualizing extracted data

## Capability Details

### browser-automation
**Keywords:** browser, automation, headless, agent-browser, playwright, puppeteer, CLI
**Solves:**
- Automate browser tasks with agent-browser CLI
- Set up headless browser environments
- Run parallel browser sessions
- Cloud browser provider configuration

### content-capture
**Keywords:** capture, extract, scrape, content, text, HTML, screenshot, web page
**Solves:**
- Extract content from JavaScript-rendered pages
- Capture screenshots and visual verification
- Handle dynamic content loading
- WebFetch returns empty or partial content

### spa-extraction
**Keywords:** react, vue, angular, spa, javascript, client-side, hydration, ssr, next.js, nuxt
**Solves:**
- React/Vue/Angular app content extraction
- Wait for SPA hydration before extraction
- Handle infinite scroll and lazy loading
- Framework detection and specific wait strategies

### authentication
**Keywords:** login, authentication, session, cookie, protected, private, gated, OAuth, SSO
**Solves:**
- Content behind login wall
- Multi-step authentication flows
- OAuth and SSO with headed mode
- Session persistence across captures

### multi-page-crawl
**Keywords:** crawl, sitemap, navigation, multiple pages, documentation, pagination, recursive
**Solves:**
- Capture entire documentation sites
- Handle click-based and URL-based pagination
- Recursive depth-limited crawling
- Parallel crawling with sessions

### anti-bot
**Keywords:** rate limit, robots.txt, CAPTCHA, bot detection, delay, throttle
**Solves:**
- Respectful scraping with rate limits
- Handling CAPTCHA and bot detection
- Resume capability for interrupted crawls
- Error handling for failed pages

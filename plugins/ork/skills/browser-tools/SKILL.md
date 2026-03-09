---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.59+. Requires network access."
description: OrchestKit orchestration wrapper for browser automation. Adds security rules, rate limiting, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows, capturing web content, or extracting structured data from web pages.
tags: [browser, automation, playwright, puppeteer, scraping, content-capture]
context: fork
agent: web-research-analyst
version: 3.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: mcp-enhancement
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Browser Tools

OrchestKit orchestration wrapper for browser automation. Delegates command documentation to the upstream `agent-browser` skill and adds security rules, rate limiting, and ethical scraping guardrails.

## Decision Tree

```bash
# Fallback decision tree for web content
# 1. Try WebFetch first (fast, no browser overhead)
# 2. If empty/partial -> Try Tavily extract/crawl
# 3. If SPA or interactive -> use agent-browser
# 4. If login required -> authentication flow + state save
# 5. If dynamic -> wait @element or wait --text
```

## Interaction Commands

Full interaction reference — use `@refs` from `snapshot -i`:

| Command | Use Case |
|---------|----------|
| `click @e1` | Click element |
| `click @e1 --new-tab` | Click and open in new tab |
| `dblclick @e1` | Double-click element |
| `focus @e1` | Focus element (before typing) |
| `fill @e2 "text"` | Clear field and type |
| `type @e2 "text"` | Type WITHOUT clearing existing text |
| `keyboard type "text"` | Type at current focus (no selector) |
| `keyboard inserttext "text"` | Insert text without key events |
| `press Enter` | Press key (alias: `key`) |
| `press Control+a` | Key combination |
| `keydown Shift` | Hold key down |
| `keyup Shift` | Release held key |
| `hover @e1` | Hover over element |
| `check @e1` | Check checkbox/radio |
| `uncheck @e1` | Uncheck checkbox |
| `select @e1 "value"` | Select dropdown option |
| `select @e1 "a" "b"` | Multi-select |
| `scroll down 500` | Scroll page (default: down 300px) |
| `scroll down 500 --selector "div.content"` | Scroll within container |
| `scrollintoview @e1` | Scroll element into viewport |
| `drag @e1 @e2` | Drag and drop |
| `upload @e1 file.pdf` | Upload file to input |

## Wait Commands

| Command | Use Case |
|---------|----------|
| `wait @e1` | Wait for element to appear |
| `wait 2000` | Wait milliseconds |
| `wait --text "Success"` | Wait for text content |
| `wait --url "**/dashboard"` | Wait for URL pattern |
| `wait --load networkidle` | Wait for network idle |
| `wait --fn "window.ready"` | Wait for JS condition |

## Capture Commands

| Command | Use Case |
|---------|----------|
| `snapshot -i` | A11y tree with element refs (@e1, @e2...) |
| `screenshot [path]` | Viewport screenshot |
| `screenshot --full [path]` | Full page screenshot |
| `screenshot --annotate` | Annotated screenshot with numbered labels |
| `pdf <path>` | Save page as PDF |
| `download @e1 /tmp/file.zip` | Download file from element (v0.16) |

## Extraction Commands

| Command | Use Case |
|---------|----------|
| `eval "JS"` | Run JavaScript |
| `eval -b "base64..."` | Run base64-encoded JS |
| `eval --stdin` | Run JS piped from stdin |

## Storage Commands (v0.13)

localStorage and sessionStorage manipulation:

| Command | Use Case |
|---------|----------|
| `storage local` | Get all localStorage items |
| `storage local <key>` | Get specific localStorage value |
| `storage local set <k> <v>` | Set localStorage value |
| `storage local clear` | Clear all localStorage |
| `storage session` | Get all sessionStorage items |

## Semantic Locators & Find Commands (v0.16)

Find elements by visible text or ARIA labels instead of `@ref` numbers:

| Command | Use Case |
|---------|----------|
| `find "Submit Order"` | Find element by visible text |
| `find --role button "Submit"` | Find by ARIA role + text |
| `find --placeholder "Search..."` | Find by placeholder text |
| `highlight @e1` | Visually highlight element on page |
| `highlight --clear` | Remove all highlights |

## Mouse Commands (v0.16)

Low-level mouse control for complex interactions:

| Command | Use Case |
|---------|----------|
| `mouse move 100 200` | Move mouse to coordinates |
| `mouse click 100 200` | Click at coordinates |
| `mouse dblclick 100 200` | Double-click at coordinates |
| `mouse wheel 0 -300` | Scroll wheel (deltaX, deltaY) |

## Tab Management (v0.16)

Multi-tab workflows:

| Command | Use Case |
|---------|----------|
| `tabs` | List all open tabs |
| `tab <index>` | Switch to tab by index |
| `tab close` | Close current tab |
| `tab new <url>` | Open new tab with URL |

## Debug & Recording (v0.16)

Performance profiling, tracing, and session recording:

| Command | Use Case |
|---------|----------|
| `trace start /tmp/trace.zip` | Start Playwright trace recording |
| `trace stop` | Stop and save trace |
| `profiler start` | Start JS profiler |
| `profiler stop /tmp/profile.json` | Stop profiler and save |
| `record start /tmp/rec.webm` | Record browser session video |
| `record stop` | Stop recording |
| `console` | Show captured console messages |
| `errors` | Show captured page errors |

## Mobile Testing (v0.16)

iOS Simulator browser automation:

| Command | Use Case |
|---------|----------|
| `--device "iPhone 15"` | Emulate device viewport + user-agent |
| `--color-scheme dark` | Test dark mode rendering |
| `--ios-simulator` | Connect to running iOS Simulator |

## Configuration Flags (v0.13–v0.16)

| Flag / Env Var | Version | Use Case |
|----------------|---------|----------|
| `--confirm-interactive` | v0.15 | Human-in-the-loop terminal prompts |
| `--confirm-actions` | v0.15 | Native action confirmation for sensitive ops |
| `--allowed-domains d1,d2` | v0.16 | Restrict navigation to listed domains |
| `--action-policy <path>` | v0.16 | JSON policy file for allowed actions |
| `--max-output <bytes>` | v0.16 | Cap output size to prevent context blowup |
| `--user-agent <string>` | v0.16 | Custom user-agent (use responsibly) |
| `--allow-file-access` | v0.16 | Enable file:// URL access (security risk) |
| `--annotate` | v0.16 | Add numbered labels to screenshots |
| `--device <name>` | v0.16 | Emulate mobile device |
| `--color-scheme <mode>` | v0.16 | Force light/dark/no-preference |
| `--proxy <url>` | v0.16 | Route traffic through proxy |
| `AGENT_BROWSER_ENCRYPTION_KEY` | v0.15 | Encryption key for Auth Vault |

## Auth Vault (v0.15)

Encrypted credential storage for reusable authentication:

| Command | Use Case |
|---------|----------|
| `vault store <name>` | Save current auth state encrypted |
| `vault load <name>` | Restore encrypted auth state |
| `vault list` | List stored vault entries |
| `vault delete <name>` | Remove vault entry |

Requires `AGENT_BROWSER_ENCRYPTION_KEY` env var. Never log or echo this key.

## Security Rules (6 rules)

This skill enforces 6 security and ethics rules in `rules/`:

| Category | Rules | Priority |
|----------|-------|----------|
| Ethics & Security | `browser-scraping-ethics.md`, `browser-auth-security.md` | CRITICAL |
| Reliability | `browser-rate-limiting.md`, `browser-snapshot-workflow.md` | HIGH |
| Debug & Device | `browser-debug-recording.md`, `browser-mobile-testing.md` | HIGH |

These rules are enforced by the `agent-browser-safety` pre-tool hook.

## Action Confirmation

Flags for controlling human-in-the-loop verification:

| Flag | Use Case |
|------|----------|
| `--confirm-interactive` | Human-in-the-loop terminal prompts |
| `--confirm-actions` | Native action gating (v0.15) — CLI prompts confirm/deny |
| `confirm` | Approve pending action (after --confirm-actions) |
| `deny` | Reject pending action (auto-denies after 60s) |

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

# Diff verification
diff /tmp/before.txt /tmp/after.txt            # Use agent-browser diff snapshot instead

# Session management
# Storing auth state in code repositories
# Not cleaning up state files after use

# Network & State
agent-browser network route "http://internal-api/*" --body '{}'  # Never mock internal APIs
agent-browser cookies set token "$SECRET" --url https://prod.com # Never set prod cookies in automation
# Not cleaning up routes after mocking (leaves stale intercepts)
```

## Diff Commands (v0.13+)

Verify changes and detect regressions using native diff commands:

| Command | Use Case |
|---------|----------|
| `diff snapshot` | Verify a11y tree changes after actions |
| `diff snapshot --baseline <file>` | Compare against saved baseline |
| `diff screenshot --baseline <img>` | Visual pixel diff (red highlights) |
| `diff url <a> <b>` | Side-by-side URL comparison |
| `diff url <a> <b> --screenshot` | Visual comparison of two URLs |
| `diff url <a> <b> --selector "#main"` | Compare specific element within URLs |

## Network Control (v0.13)

Intercept, block, or mock network requests:

| Command | Use Case |
|---------|----------|
| `network route <url> --abort` | Block analytics/trackers for clean extraction |
| `network route <url> --body <json>` | Mock API responses for testing |
| `network unroute [url]` | Remove intercept routes (always clean up!) |
| `network requests --filter <str>` | Inspect captured network traffic |
| `network requests --clear` | Clear all captured requests |

## Cookie Management (v0.13)

Direct cookie manipulation for session setup:

| Command | Use Case |
|---------|----------|
| `cookies` | Get all cookies |
| `cookies set <n> <v> --url <u>` | Set cookie for specific URL |
| `cookies set <n> <v> --httpOnly --secure` | Secure cookie flags |
| `cookies set <n> <v> --domain <d> --path <p>` | Scoped cookie |
| `cookies set <n> <v> --expires <ts>` | Time-limited cookie |
| `cookies clear` | Clear all cookies |

## State Management (v0.15)

Enhanced session lifecycle commands:

| Command | Use Case |
|---------|----------|
| `--session-name <name>` | Named sessions (replaces `--session`) |
| `state list` | List all saved session states |
| `state show <name>` | Inspect saved state details |
| `state clean --older-than <days>` | Garbage collect old states |
| `state clear <name>` | Delete specific saved state |

## Related Skills

- `agent-browser` (upstream) - Full command reference and usage patterns
- `ork:web-research-workflow` - Unified decision tree for web research
- `ork:testing-e2e` - E2E testing patterns including Playwright and webapp testing
- `ork:api-design` - API design patterns for endpoints discovered during scraping

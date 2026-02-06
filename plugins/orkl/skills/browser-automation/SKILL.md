---
name: browser-automation
description: Headless browser automation using Vercel's agent-browser CLI. 93% less context than Playwright MCP. Snapshot + refs workflow with element references. Use when automating browser tasks, web scraping, form filling, or content capture.
context: fork
agent: test-generator
version: 3.0.0
author: OrchestKit AI Agent Hub
tags: [browser, automation, headless, scraping, vercel, agent-browser]
user-invocable: false
allowedTools: [Bash, Read, Write]
complexity: medium
---

# Browser Automation with agent-browser

Headless browser CLI by Vercel. Full upstream docs: [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)

## Installation

```bash
npm install -g agent-browser
agent-browser install                # Download Chromium
agent-browser install --with-deps    # With system dependencies (Linux)
# Optional: npx skills add vercel-labs/agent-browser
```

## Quick Start

```bash
agent-browser open <url>          # Navigate to page
agent-browser snapshot -i         # Get interactive elements with refs
agent-browser click @e1           # Click element by ref
agent-browser fill @e2 "text"     # Fill input by ref
agent-browser close               # Close browser
```

## Core Concept: Snapshot + Refs

Run `agent-browser snapshot -i` to get interactive elements tagged `@e1`, `@e2`, etc. Use these refs for all subsequent interactions. Re-snapshot after navigation or significant DOM changes. This yields **93% less context** than full-DOM approaches.

## When to Use

- Web scraping from JS-rendered / SPA pages
- Form automation and multi-step workflows
- Screenshot capture and visual verification
- E2E test generation and debugging
- Content capture from authenticated pages

## Key Commands

| Command | Purpose |
|---------|---------|
| `open <url>` | Navigate to URL |
| `snapshot -i` | Interactive elements with refs |
| `click @e1` | Click element |
| `fill @e2 "text"` | Clear + type into input |
| `get text @e1` | Extract element text |
| `wait --load networkidle` | Wait for SPA render |
| `screenshot <path>` | Save screenshot |
| `state save <file>` | Persist cookies/storage |
| `state load <file>` | Restore session |
| `eval "js"` | Run JavaScript |
| `record start <path>` | Start video recording |
| `record stop` | Stop recording |
| `--session <name>` | Isolate parallel sessions |
| `--headed` | Show browser window |

Run `agent-browser --help` for the full 60+ command reference.

## OrchestKit Integration

**Safety hook** — `agent-browser-safety.ts` blocks destructive patterns (credential exfil, recursive spawning) automatically via pretool hook.

**Sessions** — Use `--session <name>` to run isolated parallel browsers within a single Claude Code session.

**Environment variables:**

```bash
AGENT_BROWSER_SESSION="my-session"   # Default session name
AGENT_BROWSER_PROFILE="/path"        # Persistent browser profile
AGENT_BROWSER_PROVIDER="browserbase" # Cloud provider (browserbase | kernel | browseruse)
AGENT_BROWSER_HEADED=1               # Run headed
```

## Upstream Documentation

- **GitHub:** [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- **CLI help:** `agent-browser --help`
- **Skills add:** `npx skills add vercel-labs/agent-browser`

## Related Skills

- `browser-content-capture` — Content extraction patterns using agent-browser
- `webapp-testing` — E2E testing with Playwright test framework
- `e2e-testing` — End-to-end testing patterns

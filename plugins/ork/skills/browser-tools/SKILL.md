---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.183+. Requires network access."
description: OrchestKit security wrapper for browser automation. Adds URL blocklisting, rate limiting, robots.txt enforcement, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows that need safety guardrails.
tags: [browser, automation, security, rate-limiting, scraping-ethics]
context: fork
agent: web-research-analyst
version: 5.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: discipline
metadata:
  category: mcp-enhancement
  upstream-skill: agent-browser
  upstream-version-tested: "0.29.1"
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Browser Tools — Security Wrapper

OrchestKit security wrapper for `agent-browser`. **For command reference and usage patterns, use the upstream `agent-browser` skill directly.** This skill adds safety guardrails only.

> **Command docs**: Refer to the upstream `agent-browser` skill for the full command reference (50+ commands: interaction, wait, capture, extraction, storage, semantic locators, tabs, debug, mobile, network, cookies, state, vault).

## Decision Tree

```bash
# Fallback decision tree for web content
# 1. Try WebFetch first (fast, no browser overhead)
# 2. If empty/partial -> Try Tavily extract/crawl
# 3. If SPA or interactive -> use agent-browser
# 4. If login required -> authentication flow + state save
# 5. If dynamic -> wait @element or wait --text
```

## Local Dev URLs

Use **Portless** (`npm i -g portless`) for stable local dev URLs instead of guessing ports. When Portless is running, navigate to `myapp.localhost` instead of `localhost:3000`. Our safety hook already allows `*.localhost` subdomains via `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST`.

```bash
# With Portless: stable, named URLs
agent-browser open "https://myapp.localhost"

# Without: fragile port guessing
agent-browser open "http://localhost:3000"  # which app is this?
```

## New in 2026-04 → 2026-06 (agent-browser 0.23 → 0.29.1)

**Sandbox helpers (0.29):**
- **`@agent-browser/sandbox`** — companion helper package for running agent-browser headless inside a Vercel Sandbox / eve ephemeral env (provisions Chrome + the native daemon for you, no host browser needed). Hook's URL/rate/robots checks still apply to whatever the sandboxed session navigates to.

**Built-in MCP server (0.28):**
- **`agent-browser --mcp`** — runs agent-browser as a Model Context Protocol server over stdio, exposing typed tools (open/snapshot/find/click/extract/...) with paginated capability discovery. Lets you wire browser automation MCP-native — directly into an MCP client — without going through the CLI Bash wrapper. Note: MCP-native sessions bypass the `agent-browser-safety` PreToolUse Bash hook (the hook only intercepts `agent-browser` Bash commands), so apply URL/rate/robots policy at the MCP-client layer when using this path.

**React introspection + perf observability (0.27):**
- **`react tree` / `react inspect <fiberId>` / `react renders start|stop` / `react suspense`** — first-class React DevTools integration via a vendored MIT-licensed hook embedded in the binary (zero runtime deps). Component-tree visibility, per-fiber props/hooks/state inspection, render profiling with mount/re-render counts and change details, Suspense boundary classification with root-cause grouping. Hook treats fiber state dumps as sensitive — gitignore captures.
- **`vitals [url]`** — reports Core Web Vitals (LCP, CLS, TTFB, FCP, INP) plus React hydration phases for any page. Useful for perf gates in CI.
- **`pushstate <url>`** — client-side SPA navigation without a full page load. Pairs with `react renders` to measure SPA route transitions without resetting profiling state.
- **`--init-script <path>` (repeatable, env `AGENT_BROWSER_INIT_SCRIPTS`)** + **`--enable <feature>` (repeatable, env `AGENT_BROWSER_ENABLE`)** — register scripts before first navigation; `--enable react-devtools` is built-in. Hook treats arbitrary init scripts as code-execution surface — same trust model as `skills get`.
- **`network route --resource-type <csv>`** — filter intercepted requests by CDP resource type (document, script, xhr, fetch, image, ...). Lets you mock only API calls without breaking page assets.
- **`cookies set --curl <file>`** — auto-detects JSON, cURL, and Cookie-header formats for bulk cookie import. Hook still treats cookie-set as auth-state injection.
- **Dashboard behind a reverse proxy** — observability dashboard now works from proxied origins via same-origin proxy. Enables path-based routing for shared dev environments.
- Fixed `doctor` generating duplicate check IDs when invoked multiple times in the same process.
- npm publishing moved to GitHub Actions OIDC trusted publishing — no manually managed npm tokens upstream.

**Diagnostic tooling + stable IDs (0.26):**
- `agent-browser doctor` — one-shot environment + Chrome + daemon + config + security + provider + network check. Flags: `--offline`, `--quick`, `--fix`, `--json`. Run before opening an issue to attach a structured snapshot.
- **Stable tab identifiers** — tabs now use stable string IDs (`t1`, `t2`, ...) with optional memorable labels via `--label`. Survives daemon restart; replaces brittle index-based references.
- **`core` skill expanded** — comprehensive built-in usage guide covering snapshot-ref-act loops, reading, interaction, waiting, and troubleshooting.
- **Config JSON Schema** — `$schema` reference enables IDE auto-completion and validation against `https://agent-browser.dev/schema.json`.
- Fixed `--state` flag not loading saved cookies/localStorage at launch; `--help` now leads with the skills section.

**Skill discovery & chat (0.25):**
- `agent-browser skills list/get <name>` — discover and install capability packs on-demand. Hook treats first-party skills as trusted; warns on arbitrary third-party skill fetches.
- `agent-browser chat` — single-shot or REPL natural-language driving over the same daemon. Hook pipes transcripts through the same URL/rate/robots checks as scripted commands.

**Accessibility-first locators (0.24):**
- `find` / `getByRole` — semantic locator via CDP accessibility tree (role + name) instead of brittle CSS/ref selectors. Prefer these in new scripts; they survive markup churn and are the locator path assumed by `chat`.
- `snapshot --urls` — emits resolved URLs alongside refs, removing a round-trip for link-extraction flows.
- `--annotate` — overlays ref IDs / role labels on screenshots for debugging.

**Cloud providers (0.25):**
- `--provider agentcore` — AWS Bedrock AgentCore cloud browser. Hook treats remote providers as egress surfaces — same URL/robots rules apply, but network routing is disabled (remote scope).
- Browserless + AgentCore both honor `AGENT_BROWSER_PROVIDER` env var.

**Dashboard (0.25):**
- Embedded dashboard bundled with the binary — no separate install. Open via `agent-browser dashboard` or the `inspect` CDP link. Still flagged as local-proxy attack surface by the hook.

**Auto-dialog dismissal (0.23.1):**
- alert / beforeunload dialogs auto-dismissed by default. Opt out with `--no-auto-dialog` when a test needs to assert dialog content.

## What's New (v0.17 → v0.22.2)

**Breaking changes** — update scripts now:
- `--full` / `-f` moved from global to command-level (v0.21): use `screenshot --full`, NOT `--full screenshot`
- Auth encryption format changed (v0.17): saved auth states from v0.16.x may not load
- Auto-dialog dismissal (v0.23.1): alert/beforeunload dialogs are auto-dismissed by default, opt out with `--no-auto-dialog`

**New commands:**

| Command | Version | Security Note |
|---------|---------|---------------|
| `clipboard read/write/copy/paste` | v0.19 | `read` accesses host clipboard — hook warns |
| `inspect` / `get cdp-url` | v0.18 | Opens local DevTools proxy — hook warns |
| `batch --json [--bail]` | v0.21 | Batch execute commands from stdin |
| `network har start/stop [file]` | v0.21 | HAR captures auth tokens — hook warns, treat output as sensitive |
| `network request <id>` | v0.22 | View full request/response detail |
| `network requests --type/--method/--status` | v0.22 | Filter network requests |
| `dialog dismiss` / `dialog status` | v0.17/v0.22 | Dismiss or check browser dialogs |
| `upgrade` | v0.21.1 | Self-update (auto-detects npm/Homebrew/Cargo) |
| `find` / `getByRole` | v0.24 | Semantic locators via CDP a11y tree |
| `snapshot --urls` / `--annotate` | v0.24 | URL-expanded snapshots, ref overlays |
| `skills list/get` | v0.25 | Capability pack discovery — hook warns on third-party |
| `chat` (single-shot / REPL) | v0.25 | NL driving; transcripts go through same safety checks |
| `dashboard` | v0.25 | Embedded debug UI — local proxy attack surface |
| `react tree` / `react inspect` / `react renders` / `react suspense` | v0.27 | React DevTools introspection — fiber state may contain sensitive props |
| `vitals [url]` | v0.27 | Core Web Vitals + React hydration phases |
| `pushstate <url>` | v0.27 | SPA client-side navigation without full reload |

**New flags:**

| Flag | Scope | Version |
|------|-------|---------|
| `--engine lightpanda` | global | v0.17 |
| `--screenshot-dir/quality/format` | screenshot | v0.19 |
| `--provider browserless` | global | v0.19 |
| `--idle-timeout <duration>` | global | v0.20.14 |
| `--user-data-dir <path>` | Chrome | v0.21 |
| `set viewport W H [scale]` | viewport | v0.17.1 (retina) |
| `--provider agentcore` | global | v0.25 (AWS Bedrock AgentCore) |
| `--annotate` | screenshot | v0.24 |
| `--no-auto-dialog` | global | v0.23.1 |
| `--init-script <path>` (repeatable) | global | v0.27 |
| `--enable <feature>` (repeatable) | global | v0.27 (built-in: `react-devtools`) |
| `--resource-type <csv>` | network route | v0.27 |
| `--curl <file>` | cookies set | v0.27 (auto-detects JSON/cURL/Cookie-header) |
| `--mcp` | global | v0.28 (run as a stdio MCP server with typed tools) |

**Platform support:** Brave auto-discovery (v0.20.7), Alpine Linux musl (v0.20.2), Lightpanda engine (v0.17), Browserless.io provider (v0.19), cross-origin iframe traversal (v0.22), AWS Bedrock AgentCore (v0.25).

**Native Rust rewrite (v0.20):** agent-browser is now 100% native Rust — the old Node.js/Playwright daemon (the "sidecar") is **gone**. It drives Chrome directly over CDP, so there is **no Node runtime, no Playwright, and no separate browser-driver process** to install or keep alive. Result: 99x smaller install (710→7 MB), 18x less memory (143→8 MB), 1.6x faster cold start.

## Safety Guardrails (7 rules + 11-check hook)

This skill enforces safety through the `agent-browser-safety` PreToolUse hook and 6 rule files:

### Hook: agent-browser-safety

The hook intercepts all `agent-browser` Bash commands and enforces:

| Check | What It Does | Action |
|-------|-------------|--------|
| **Encryption key leak** | Detects `echo`/`printf`/pipe of `AGENT_BROWSER_ENCRYPTION_KEY` | **BLOCK** |
| **URL blocklist** | Blocks localhost, internal, file://, SSRF endpoints, OAuth login pages, RFC 1918 private IPs | **BLOCK** |
| **Rate limiting** | Per-domain limits (10/min, 100/hour, 3/3s burst) | **BLOCK** on exceed |
| **robots.txt** | Fetches and caches robots.txt, blocks disallowed paths | **BLOCK** |
| **Sensitive actions** | Detects delete/remove clicks, password fills, payment submissions | **WARN** + native confirmation |
| **Network routes** | Validates `network route` target URLs against blocklist | **BLOCK** |
| **User-agent spoofing** | Warns when `--user-agent` flag is used | **WARN** |
| **File access** | Warns when `--allow-file-access` flag is used | **WARN** |
| **DevTools inspect** | `inspect` / `get cdp-url` opens local CDP proxy — new attack surface (v0.18+) | **WARN** |
| **Clipboard read** | `clipboard read` accesses host clipboard without prompt (v0.19+) | **WARN** |
| **HAR capture** | `network har stop` dumps full request/response bodies incl. auth tokens (v0.21+) | **WARN** |
| **Skill install** | `skills get` fetches third-party capability packs — treat as code install (v0.25+) | **WARN** |
| **Chat transcripts** | `chat` REPL logs may capture sensitive page text — pipe through same URL rules (v0.25+) | **WARN** |
| **Remote provider** | `--provider agentcore/browserless` sends traffic to cloud endpoints; routing disabled remotely | **WARN** |
| **Init scripts** | `--init-script <path>` registers arbitrary JS before first navigation — code-execution surface (v0.27+) | **WARN** |
| **React fiber dumps** | `react tree`/`react inspect` may expose sensitive props/state from prod apps; gitignore captures (v0.27+) | **WARN** |

### Security Rules (in `rules/`)

| Category | Rules | Priority |
|----------|-------|----------|
| Ethics & Security | `browser-scraping-ethics.md`, `browser-auth-security.md` | CRITICAL |
| Local Dev | `browser-portless-local-dev.md` | HIGH |
| Reliability | `browser-rate-limiting.md`, `browser-snapshot-workflow.md` | HIGH |
| Debug & Device | `browser-debug-recording.md`, `browser-mobile-testing.md` | HIGH |

### Configuration

Rate limits and behavior are configurable via environment variables:

| Env Var | Default | Purpose |
|---------|---------|---------|
| `AGENT_BROWSER_RATE_LIMIT_PER_MIN` | 10 | Requests per minute per domain |
| `AGENT_BROWSER_RATE_LIMIT_PER_HOUR` | 100 | Requests per hour per domain |
| `AGENT_BROWSER_BURST_LIMIT` | 3 | Max requests in 3-second window |
| `AGENT_BROWSER_ROBOTS_CACHE_TTL` | 3600000 | robots.txt cache TTL (ms) |
| `AGENT_BROWSER_IGNORE_ROBOTS` | false | Bypass robots.txt enforcement |
| `AGENT_BROWSER_CONFIRM` | 1 | Use `--confirm-actions` for sensitive ops |
| `AGENT_BROWSER_IDLE_TIMEOUT_MS` | — | Auto-shutdown daemon after inactivity (ms) |
| `AGENT_BROWSER_ENGINE` | chrome | Browser engine (`chrome` or `lightpanda`) |
| `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST` | 1 | Allow `*.localhost` subdomains (RFC 6761) |

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

# Network & State
agent-browser network route "http://internal-api/*" --body '{}'  # Never mock internal APIs
agent-browser cookies set token "$SECRET" --url https://prod.com # Never set prod cookies

# Deprecated / removed
agent-browser --full screenshot                # BREAKING: --full is now command-level (v0.21)
agent-browser screenshot --full                # Correct: flag after subcommand

# Sensitive data leaks
agent-browser network har stop auth-dump.har   # HAR files contain auth tokens — gitignore!
git add *.har                                  # NEVER commit HAR captures
```

## Related Skills

- `agent-browser` (upstream) — Full command reference and usage patterns
- `portless` (upstream) — Stable named `.localhost` URLs for local dev servers
- `ork:web-research-workflow` — Unified decision tree for web research
- `ork:testing-e2e` — E2E testing patterns including Playwright and webapp testing
- `ork:api-design` — API design patterns for endpoints discovered during scraping

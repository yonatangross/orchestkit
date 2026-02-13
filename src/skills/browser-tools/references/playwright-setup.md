# Playwright Setup & Configuration

Installation and configuration patterns for agent-browser CLI and Playwright-based browser automation.

## agent-browser CLI (Recommended)

Headless browser CLI by Vercel. 93% less context than full Playwright MCP thanks to snapshot + refs workflow.

### Installation

```bash
# Install globally
npm install -g agent-browser
agent-browser install                # Download Chromium

# With system dependencies (Linux CI/Docker)
agent-browser install --with-deps

# Optional: Install as Claude Code skill
npx skills add vercel-labs/agent-browser
```

### Verify Installation

```bash
# Check version
agent-browser --version

# Quick test
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser close
```

---

## Environment Variables

```bash
# Session management
AGENT_BROWSER_SESSION="my-session"     # Default session name
AGENT_BROWSER_PROFILE="/path"          # Persistent browser profile

# Display
AGENT_BROWSER_HEADED=1                 # Run headed (show browser window)

# Cloud providers (for CI/remote execution)
AGENT_BROWSER_PROVIDER="browserbase"   # Options: browserbase | kernel | browseruse
```

---

## Cloud Provider Configuration

### BrowserBase

```bash
# Set provider
export AGENT_BROWSER_PROVIDER="browserbase"
export BROWSERBASE_API_KEY="your-api-key"
export BROWSERBASE_PROJECT_ID="your-project-id"

# Use normally - agent-browser handles cloud routing
agent-browser open https://example.com
```

### Docker/CI Setup

```dockerfile
FROM node:20-slim
RUN npm install -g agent-browser
RUN agent-browser install --with-deps
```

```yaml
# GitHub Actions
- name: Install agent-browser
  run: |
    npm install -g agent-browser
    agent-browser install --with-deps
```

---

## Playwright Direct Setup (Alternative)

When you need the full Playwright API instead of agent-browser CLI:

### Installation

```bash
npm init playwright@latest
# Installs: @playwright/test, browsers, config file

# Or add to existing project
npm install -D @playwright/test
npx playwright install
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

---

## Session Isolation

Use named sessions for parallel browser instances:

```bash
# Isolated sessions for different tasks
agent-browser --session scrape1 open https://site1.com
agent-browser --session scrape2 open https://site2.com

# Each session has its own cookies, storage, and state
agent-browser --session scrape1 state save /tmp/session1.json
agent-browser --session scrape2 state save /tmp/session2.json
```

---

## OrchestKit Integration

**Safety hook** -- `agent-browser-safety.ts` blocks destructive patterns (credential exfil, recursive spawning) automatically via pretool hook.

**Upstream docs:** [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)

Run `agent-browser --help` for the full 60+ command reference.

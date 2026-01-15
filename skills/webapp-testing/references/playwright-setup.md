# Playwright Setup with Test Agents

Install and configure Playwright with autonomous test agents for Claude Code.

## Prerequisites

**Required:** VS Code v1.105+ (released Oct 9, 2025) for agent functionality

## Step 1: Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install  # Install browsers (Chromium, Firefox, WebKit)
```

## Step 2: Add Playwright MCP Server (CC 2.1.6)

Create or update `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Restart your Claude Code session to pick up the MCP configuration.

> **Note:** The `claude mcp add` command is deprecated in CC 2.1.6. Configure MCPs directly via `.mcp.json`.

## Step 3: Initialize Test Agents

```bash
# Initialize the three agents (planner, generator, healer)
npx playwright init-agents --loop=claude
# OR for VS Code: --loop=vscode
# OR for OpenCode: --loop=opencode
```

**What this does:**
- Creates agent definition files in your project
- Agents are Markdown-based instruction files
- Regenerate when Playwright updates to get latest tools

## Step 4: Create Seed Test

Create `tests/seed.spec.ts` - the planner uses this to understand your setup:

```typescript
// tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Your app initialization
  await page.goto('http://localhost:3000');

  // Login if needed
  // await page.getByLabel('Email').fill('test@example.com');
  // await page.getByLabel('Password').fill('password123');
  // await page.getByRole('button', { name: 'Login' }).click();
});

test('seed test - app is accessible', async ({ page }) => {
  await expect(page).toHaveTitle(/MyApp/);
  await expect(page.getByRole('navigation')).toBeVisible();
});
```

**Why seed.spec.ts?**
- Planner executes this to learn:
  - Environment setup (fixtures, hooks)
  - Authentication flow
  - App initialization
  - Available selectors

## Directory Structure

```
your-project/
├── specs/              <- Planner outputs test plans here (Markdown)
├── tests/              <- Generator outputs test code here (.spec.ts)
│   └── seed.spec.ts    <- Your initialization test (REQUIRED)
├── playwright.config.ts
└── .mcp.json           <- MCP server config
```

## Basic Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

## Running Tests

```bash
npx playwright test                 # Run all tests
npx playwright test --ui            # UI mode
npx playwright test --debug         # Debug mode
npx playwright test --headed        # See browser
```

## MCP Tools Available

Once configured, Playwright MCP provides these tools:

| Tool | Description |
|------|-------------|
| `mcp__playwright__browser_navigate` | Navigate to URL |
| `mcp__playwright__browser_click` | Click element |
| `mcp__playwright__browser_fill` | Fill form input |
| `mcp__playwright__browser_screenshot` | Capture screenshot |
| `mcp__playwright__browser_evaluate` | Execute JavaScript |

## Next Steps

1. **Planner**: "Generate test plan for checkout flow" -> creates `specs/checkout.md`
2. **Generator**: "Generate tests from checkout spec" -> creates `tests/checkout.spec.ts`
3. **Healer**: Automatically fixes tests when selectors break

See `references/planner-agent.md` for detailed workflow.
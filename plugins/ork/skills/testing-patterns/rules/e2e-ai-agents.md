---
title: "E2E: AI Agents"
category: e2e
impact: HIGH
impactDescription: "Enables AI-powered test planning, generation, and self-healing through Playwright's built-in agent framework"
tags: playwright, ai-agents, self-healing, test-generation, automation
---

# Playwright AI Agents (1.58+)

## Initialize AI Agents

```bash
npx playwright init-agents --loop=claude    # For Claude Code
npx playwright init-agents --loop=vscode    # For VS Code (v1.105+)
npx playwright init-agents --loop=opencode  # For OpenCode
```

## Generated Structure

| Directory/File | Purpose |
|----------------|---------|
| `.github/` | Agent definitions and configuration |
| `specs/` | Test plans in Markdown format |
| `tests/seed.spec.ts` | Seed file for AI agents to reference |

## Agent Workflow

```
1. PLANNER   --> Explores app --> Creates specs/checkout.md
                 (uses seed.spec.ts)
2. GENERATOR --> Reads spec --> Tests live app --> Outputs tests/checkout.spec.ts
                 (verifies selectors actually work)
3. HEALER    --> Runs tests --> Fixes failures --> Updates selectors/waits
                 (self-healing)
```

## Key Concepts

- **seed.spec.ts is required** — Planner executes this to learn environment, auth, UI elements
- **Generator validates live** — Actually tests app to verify selectors work
- **Healer auto-fixes** — When UI changes break tests, replays and patches

## Setup Requirements

```json
// .mcp.json in project root
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Incorrect — No seed file for AI agents to learn from:**
```typescript
// Missing tests/seed.spec.ts
// AI agents have no example to understand app structure
npx playwright init-agents --loop=claude
```

**Correct — Seed file teaches agents app patterns:**
```typescript
// tests/seed.spec.ts
import { test } from '@playwright/test';

test('example checkout flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  // Agents learn selectors and patterns from this
});
```

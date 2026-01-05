---
name: Webapp Testing
description: Use when testing web applications with AI-assisted Playwright. Features autonomous test agents for planning, generating, and self-healing tests automatically.
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [playwright, testing, e2e, automation, agents, 2025]
---

# Webapp Testing Skill

Autonomous end-to-end testing with Playwright's three specialized agents.

## The Three Agents

1. **Planner** - Explores app and creates test plans
2. **Generator** - Writes Playwright tests with best practices
3. **Healer** - Fixes failing tests automatically

## Quick Setup

```bash
# 1. Install Playwright
npm install --save-dev @playwright/test

# 2. Add MCP server
claude mcp add playwright npx '@playwright/mcp@latest'

# 3. Initialize agents
npx playwright init-agents --loop=claude

# 4. Create tests/seed.spec.ts (required for Planner)
```

**Requirements:** VS Code v1.105+ (Oct 9, 2025)

## Agent Workflow

```
1. PLANNER   ──▶ Explores app ──▶ Creates specs/checkout.md
                 (uses seed.spec.ts)
                      │
                      ▼
2. GENERATOR ──▶ Reads spec ──▶ Tests live app ──▶ Outputs tests/checkout.spec.ts
                 (verifies selectors actually work)
                      │
                      ▼
3. HEALER    ──▶ Runs tests ──▶ Fixes failures ──▶ Updates selectors/waits
                 (self-healing)
```

## Directory Structure

```
your-project/
├── specs/              ← Planner outputs (Markdown plans)
├── tests/              ← Generator outputs (Playwright tests)
│   └── seed.spec.ts    ← Required: Planner learns from this
└── playwright.config.ts
```

## Key Concepts

**seed.spec.ts is required** - Planner executes this to learn:
- Environment setup (fixtures, hooks)
- Authentication flow
- Available UI elements

**Generator validates live** - Doesn't just translate Markdown, actually tests app to verify selectors work.

**Healer auto-fixes** - When UI changes break tests, Healer replays, finds new selectors, patches tests.

See `references/` for detailed agent patterns and commands.

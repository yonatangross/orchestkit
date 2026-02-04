---
name: Webapp Testing
description: Use when testing web applications with AI-assisted Playwright. Webapp testing covers autonomous test agents for planning, generating, and self-healing tests.
context: fork
agent: test-generator
version: 1.2.0
author: OrchestKit AI Agent Hub
tags: [playwright, testing, e2e, automation, agents, 2026]
user-invocable: false
---
Autonomous end-to-end testing with Playwright's three specialized agents for planning, generating, and self-healing tests automatically.

## The Three Agents

1. **Planner** - Explores app and creates test plans
2. **Generator** - Writes Playwright tests with best practices
3. **Healer** - Fixes failing tests automatically

## Quick Setup (CC 2.1.6)

```bash
# 1. Install Playwright
npm install --save-dev @playwright/test
npx playwright install
```

```json
// 2. Create/update .mcp.json in project root
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

```bash
# 3. Initialize agents (after restarting Claude Code session)
npx playwright init-agents --loop=claude

# 4. Create tests/seed.spec.ts (required for Planner)
```

**Requirements:** VS Code v1.105+ (Oct 9, 2025)

## Agent Workflow

```
1. PLANNER   --> Explores app --> Creates specs/checkout.md
                 (uses seed.spec.ts)
                      |
                      v
2. GENERATOR --> Reads spec --> Tests live app --> Outputs tests/checkout.spec.ts
                 (verifies selectors actually work)
                      |
                      v
3. HEALER    --> Runs tests --> Fixes failures --> Updates selectors/waits
                 (self-healing)
```

## Directory Structure

```
your-project/
├── specs/              <- Planner outputs (Markdown plans)
├── tests/              <- Generator outputs (Playwright tests)
│   └── seed.spec.ts    <- Required: Planner learns from this
├── playwright.config.ts
└── .mcp.json           <- MCP server config (CC 2.1.6)
```

## Key Concepts

**seed.spec.ts is required** - Planner executes this to learn:
- Environment setup (fixtures, hooks)
- Authentication flow
- Available UI elements

**Generator validates live** - Doesn't just translate Markdown, actually tests app to verify selectors work.

**Healer auto-fixes** - When UI changes break tests, Healer replays, finds new selectors, patches tests.

See `references/` for detailed agent patterns and commands.

## Bundled Resources

- `assets/playwright-test-template.ts` - Playwright test template with BasePage, ApiMocker, and CustomAssertions
- `references/playwright-setup.md` - Playwright setup and configuration
- `references/visual-regression.md` - Visual regression testing patterns

## Related Skills

- `e2e-testing` - Core end-to-end testing patterns with Playwright
- `msw-mocking` - Mock Service Worker for API mocking in tests
- `a11y-testing` - Accessibility testing integration with Playwright
- `vcr-http-recording` - HTTP recording for deterministic test playback

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent Architecture | Planner/Generator/Healer | Separation of concerns for autonomous testing |
| Seed Requirement | seed.spec.ts mandatory | Planner needs context to learn app patterns |
| Selector Strategy | Semantic locators | More resilient to UI changes than CSS selectors |
| Self-Healing | Healer agent | Reduces test maintenance burden automatically |

## Capability Details

### playwright-setup
**Keywords:** playwright, setup, install, configure, mcp
**Solves:**
- How do I set up Playwright testing?
- Install Playwright MCP server
- Configure test environment
- Initialize Playwright agents with Claude

### test-planning
**Keywords:** test plan, scenarios, user flows, test cases, planner agent
**Solves:**
- How do I create a test plan?
- Use Planner agent to explore app
- Identify test scenarios automatically
- Plan user flow testing with seed.spec.ts

### test-generation
**Keywords:** generate tests, write tests, playwright code, selectors, generator agent
**Solves:**
- How do I generate Playwright tests?
- Use Generator agent to write test code
- Create semantic locators that validate live
- Write tests with best practices

### test-healing
**Keywords:** fix tests, failing tests, self-heal, maintenance, healer agent
**Solves:**
- How do I fix failing tests automatically?
- Use Healer agent to update broken selectors
- Maintain test suite after UI changes
- Self-healing test automation

### agent-workflow
**Keywords:** planner generator healer, test workflow, autonomous testing, playwright agents
**Solves:**
- How do the three Playwright agents work together?
- Complete testing workflow with agents
- Planner -> Generator -> Healer pipeline
- Autonomous test creation and maintenance

### visual-regression
**Keywords:** visual regression, screenshot, toHaveScreenshot, snapshot, VRT, baseline, pixel diff, visual testing
**Solves:**
- How do I set up visual regression testing with Playwright?
- Replace Percy with Playwright native screenshots
- Configure toHaveScreenshot thresholds
- Handle cross-platform screenshot differences
- Mask dynamic content in screenshots
- Set up visual regression in CI/CD
- Update screenshot baselines
- Debug failed visual comparisons

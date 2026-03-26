---
name: storybook-mcp-integration
license: MIT
compatibility: "Claude Code 2.1.76+. Optional: @storybook/addon-mcp (Storybook 10.3+, Vite-based only)."
description: "Storybook MCP server integration for component-aware AI development. Covers 6 tools across 3 toolsets (dev, docs, testing): component discovery via list-all-documentation/get-documentation, story previews via preview-stories, and automated testing via run-story-tests. Use when generating components that should reuse existing Storybook components, running component tests via MCP, or previewing stories in chat."
tags: [storybook, mcp, component-discovery, story-preview, component-testing, a11y, design-system, react]
context: fork
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
targets:
  - library: storybook
    version: ">=10.3.0"
metadata:
  category: document-asset-creation
  mcp-server: storybook-mcp
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Storybook MCP Integration

Use the Storybook MCP server (`@storybook/addon-mcp`) to give agents awareness of a project's actual component library — props, stories, tests, and live previews.

## When to Use

- **Component generation** — check existing Storybook components before creating new ones
- **Component testing** — run story tests + a11y audits via MCP instead of CLI
- **Visual verification** — embed story previews in chat for user confirmation
- **Component auditing** — inventory components with full metadata via MCP

## Quick Reference — 6 Tools, 3 Toolsets

| Toolset | Tool | Purpose | Key Inputs |
|---------|------|---------|------------|
| **dev** | `get-storybook-story-instructions` | Guidance on writing stories + interaction tests | none |
| **dev** | `preview-stories` | Returns preview URLs for stories (embeddable) | `stories[]: {storyId}` or `{absoluteStoryPath, exportName}` |
| **docs** | `list-all-documentation` | Full component + docs manifest index | none |
| **docs** | `get-documentation` | Props, first 3 stories, story index, docs | `id` (required), `storybookId` (optional) |
| **docs** | `get-documentation-for-story` | Full story source + component docs | `componentId`, `storyName` (required) |
| **testing** | `run-story-tests` | Run component + a11y tests, pass/fail + violations | `stories[]` (optional), `a11y` boolean (default true) |

## Prerequisites

```bash
# Storybook 10.3+ with Vite builder (no webpack)
npx storybook@latest upgrade

# Install the addon
npx storybook add @storybook/addon-mcp

# Enable docs toolset (required for component discovery)
# In .storybook/main.ts:
#   experimentalComponentsManifest: true

# Enable testing toolset (requires addon-vitest)
# npx storybook add @storybook/addon-vitest

# Register with Claude Code
npx mcp-add --type http --url "http://localhost:6006/mcp" --scope project
```

## Detection Pattern

Before using Storybook MCP tools, check availability:

```python
# Probe for storybook-mcp tools
ToolSearch(query="+storybook list-all-documentation")

# If tools found → Storybook MCP is available
# If not found → fallback to filesystem-based component discovery
```

## Rule Details

Load rules on demand with `Read("${CLAUDE_SKILL_DIR}/rules/<file>")`:

| Rule | Impact | Description |
|------|--------|-------------|
| `component-discovery` | HIGH | Use list-all-documentation + get-documentation before generating new components |
| `story-preview-verification` | HIGH | Embed preview-stories URLs for visual confirmation |
| `mcp-test-runner` | CRITICAL | Run run-story-tests with a11y:true after component generation |

## Toolset Selection

Filter toolsets via `X-MCP-Toolsets` header to reduce agent context:

| Agent Role | Toolsets | Rationale |
|------------|----------|-----------|
| component-curator | `docs` | Inventory + props only, no testing |
| frontend-ui-developer | `dev,docs,testing` | Full access for gen → verify loop |
| design-system-architect | `docs` | Component metadata for governance |

## Chromatic Remote Publishing

For teams using Chromatic, the docs toolset is publishable remotely:
- Published at `https://<chromatic-storybook-url>/mcp`
- Only docs toolset available remotely (dev + testing need local Storybook)
- Useful for cross-team design system discovery without running Storybook locally

## Graceful Degradation

| Storybook MCP | Fallback | Behavior |
|---------------|----------|----------|
| Available | — | Use MCP tools for component discovery, testing, previews |
| Unavailable | Filesystem | `Glob("**/components/**/*.tsx")` + `Grep` for component inventory |
| Unavailable | 21st.dev | Search public registry via 21st-dev-magic MCP |
| Unavailable | Manual | Claude multimodal analysis of screenshots |

## Related Skills

- `storybook-testing` — CSF3 patterns, Vitest integration, Chromatic TurboSnap
- `component-search` — 21st.dev registry search (external components)
- `design-to-code` — Full mockup-to-component pipeline (uses this skill in Stage 2)
- `ui-components` — shadcn/ui + Radix component patterns

---
name: ai-ui-generation
license: MIT
compatibility: "Claude Code 2.1.139+."
description: AI-assisted UI generation patterns for json-render, v0.app, Google Stitch, Bolt Cloud, and Cursor workflows. Covers prompt engineering for component and full-stack app generation, review checklists for AI-generated code, design token injection, refactoring for design system conformance, and CI gates for quality assurance. Use when generating UI components with AI tools, rendering multi-surface MCP visual output, reviewing AI-generated code, or integrating AI output into design systems.
tags: [ai-ui, json-render, v0, v0-app, stitch, bolt, bolt-cloud, cursor, prompt-engineering, code-generation, design-tokens, component-generation, ai-review, shadcn-ui]
context: fork
agent: frontend-ui-developer
version: 1.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# AI UI Generation

Patterns for generating, reviewing, and integrating UI components produced by AI tools (json-render, v0.app, Google Stitch, Bolt Cloud, Cursor). **json-render is the first choice** for multi-surface, MCP visual output, and type-safe catalog workflows. AI-generated UI is **80% boilerplate, 20% custom** — the human reviews, refactors, and owns the output. These rules ensure AI output meets design system, accessibility, and quality standards before shipping.

> **Tool landscape as of 2026-04:**
> - **v0.dev → v0.app** (Jan 2026 rebrand) — expanded from component scaffolding to full-stack app generation with shipping targets (Vercel, Cloudflare, Railway). v0.app MCP server (`@vercel/v0-mcp`) exposes generation as an MCP tool, so agents can call it programmatically.
> - **Google Stitch** — design-first generation via `stitch.withgoogle.com/docs/mcp`. Produces multi-screen apps (up to 5 interconnected screens) with React/HTML + PNG. Strong when input is a screenshot, URL, or DESIGN.md file.
> - **Bolt Cloud** (StackBlitz, 2026) — Bolt now runs the dev environment in the cloud (no local WebContainer). Integrates with GitHub and supports persistent databases. Best for full-stack prototypes with backend + deploy.
> - **v0.app** and **Stitch** both integrate with shadcn/ui styles; pair with the `shadcn apply <style>` CLI (v4) to reuse generated output.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [json-render Integration](#json-render-integration) | 1 | HIGH | Multi-surface output, MCP visual output, type-safe catalogs |
| [Prompt Engineering](#prompt-engineering) | 2 | HIGH | Writing prompts for component generation |
| [Quality Assurance](#quality-assurance) | 2 | CRITICAL/HIGH | Reviewing and gating AI-generated code |
| [Design System Integration](#design-system-integration) | 2 | HIGH | Injecting tokens, refactoring for conformance |
| [Tool Selection & Workflow](#tool-selection--workflow) | 2 | MEDIUM | Choosing the right AI tool, iterating prompts |

**Total: 8 rules across 5 categories**

## Decision Table — json-render vs v0.app vs Stitch vs Bolt Cloud vs Cursor

| Scenario | Tool | Why |
|----------|------|-----|
| Multi-surface / MCP visual output | json-render | Single catalog renders to any surface — FIRST CHOICE |
| Type-safe component catalog | json-render | Schema-driven specs with per-platform registries |
| Streaming UI from AI agents | json-render | Structured JSON specs render progressively |
| New component from scratch | v0.app | Full scaffold with shadcn/ui, Tailwind, a11y. Pair with `shadcn apply <style>` for style consistency |
| Full-stack app with deploy | v0.app | Jan 2026 expansion — routes, DB, auth, Vercel/Cloudflare deploy in one generation |
| Design-driven (screenshot/URL/DESIGN.md) | Google Stitch | `build_site` + `get_screen_code` / `get_screen_image`, up to 5 screens |
| Multi-screen flow from a visual source | Google Stitch | Strongest when grounded in an existing design |
| Full-stack prototype with persistent backend | Bolt Cloud | Cloud dev env, GitHub integration, databases |
| Incremental change in existing codebase | Cursor | Understands project context, imports, tokens |
| Refactor existing component | Cursor | Reads surrounding code, respects conventions |
| Explore visual design variations | v0.app or Stitch | v0.app for freeform, Stitch when grounded in a reference |
| Add feature to running app | Bolt Cloud | Cloud preview, full environment, persists between sessions |
| Fix bug in existing component | Cursor | Inline edits with full project awareness |

## Quick Start

### Structured Prompt Example

```
Generate a React signup form component using:
- Framework: React 19 + TypeScript
- Styling: Tailwind CSS v4 + shadcn/ui (Luma style — rounded-4xl, shadow-md elevation)
- Style: run `npx shadcn@latest apply luma` (CLI v4, Apr 2026) after generation
- Tokens: use color.primary, color.destructive, spacing.md from our design system
- A11y: ARIA labels on all inputs, error announcements via aria-live
- States: default, loading (disabled + spinner), error (inline messages), success
- Responsive: stack on mobile (<640px), 2-col on desktop
```

### Review Example — After AI Generation

```tsx
// AI generated: hardcoded hex value
<button className="bg-[#3b82f6] text-white px-4 py-2">Submit</button>

// After human review: design token applied
<Button variant="default" size="md">Submit</Button>
```

## Rule Details

### json-render Integration

json-render is the **first choice** for AI UI generation when output must render across multiple surfaces (web, mobile, CLI, MCP). Define a catalog of components once, generate JSON specs from AI, and render on any target surface. See `ork:json-render-catalog` for catalog authoring patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| json-render Patterns | `rules/json-render-patterns.md` | Catalog-first: define once, render anywhere via per-platform registries |

### Prompt Engineering

Structured prompts that specify framework, tokens, a11y, and states upfront.

| Rule | File | Key Pattern |
|------|------|-------------|
| Prompt Patterns | `rules/ai-prompt-patterns.md` | Constraint-first prompts with framework, tokens, a11y |
| Iteration Patterns | `rules/ai-iteration-patterns.md` | Multi-pass prompts for complex interactive states |

### Quality Assurance

Systematic review and CI gating for AI-generated components.

| Rule | File | Key Pattern |
|------|------|-------------|
| Review Checklist | `rules/ai-review-checklist.md` | 10-point checklist for every AI-generated component |
| CI Gate | `rules/ai-ci-gate.md` | Automated quality gates before merge |

### Design System Integration

Ensuring AI output uses design tokens and conforms to the design system.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Injection | `rules/ai-token-injection.md` | Pass token names in prompts, reject hardcoded values |
| Refactoring Conformance | `rules/ai-refactoring-conformance.md` | Steps to refactor raw AI output for design system |

### Tool Selection & Workflow

Choosing the right AI tool and iterating effectively.

| Rule | File | Key Pattern |
|------|------|-------------|
| Tool Selection | `rules/ai-tool-selection.md` | Match tool to use case: v0, Bolt, Cursor |
| Iteration Patterns | `rules/ai-iteration-patterns.md` | Iterative refinement for complex states |

## Key Principles

1. **Own the output** — AI generates a draft; the engineer reviews, refactors, and is accountable for what ships.
2. **Tokens over literals** — Never accept hardcoded colors, spacing, or typography values. Always map to design tokens.
3. **Constraint-first prompts** — Specify framework, tokens, shadcn style (Luma/Nova/etc.), a11y, and states upfront. Vague prompts produce vague output.
4. **Iterative refinement** — Complex components need 2-3 prompt passes: structure first, states second, polish third.
5. **CI is non-negotiable** — Every AI-generated component goes through the same CI pipeline as hand-written code.
6. **Accessibility by default** — Include a11y requirements in every prompt; verify with automated checks post-generation.

## Anti-Patterns (FORBIDDEN)

- **Shipping raw AI output** — Never merge AI-generated code without human review and design system refactoring.
- **Vague prompts** — "Make a nice form" produces inconsistent, non-conformant output. Always specify constraints.
- **Hardcoded hex/rgb values** — AI tools default to arbitrary colors. Replace with OKLCH design tokens.
- **Skipping CI for "simple" components** — AI-generated code has the same bug surface as hand-written code.
- **Using v0.app for incremental changes** — v0.app generates from scratch; use Cursor for changes within an existing codebase.
- **Single-pass complex components** — Multi-state components (loading, error, empty, success) need iterative prompting.
- **Trusting AI a11y claims** — AI tools add ARIA attributes inconsistently. Always verify with axe-core or Storybook a11y addon.

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/ai-ui-tool-comparison.md](references/ai-ui-tool-comparison.md) | json-render vs v0 vs Bolt vs Cursor vs Copilot comparison |
| [references/prompt-templates-library.md](references/prompt-templates-library.md) | Copy-paste prompt templates for common components |
| [references/ai-ui-failure-modes.md](references/ai-ui-failure-modes.md) | Top 10 failure modes and fixes |

## Related Skills

- `ork:json-render-catalog` — json-render catalog authoring, schema validation, and registry patterns
- `ork:mcp-visual-output` — MCP visual output rendering with json-render specs
- `ork:multi-surface-render` — Cross-platform rendering from a single component catalog
- `ork:ui-components` — shadcn/ui component patterns and CVA variants
- `ork:accessibility` — WCAG compliance, ARIA patterns, screen reader support
- `ork:animation-motion-design` — Motion library animation patterns
- `ork:responsive-patterns` — Responsive layout and container query patterns
- `ork:design-system` — Design token architecture and theming

---
name: ai-ui-generation
license: MIT
compatibility: "Claude Code 2.1.76+."
description: AI-assisted UI generation patterns for v0, Bolt, and Cursor workflows. Covers prompt engineering for component generation, review checklists for AI-generated code, design token injection, refactoring for design system conformance, and CI gates for quality assurance. Use when generating UI components with AI tools, reviewing AI-generated code, or integrating AI output into design systems.
tags: [ai-ui, v0, bolt, cursor, prompt-engineering, code-generation, design-tokens, component-generation, ai-review, shadcn-ui]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
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

Patterns for generating, reviewing, and integrating UI components produced by AI tools (v0, Bolt, Cursor). AI-generated UI is **80% boilerplate, 20% custom** — the human reviews, refactors, and owns the output. These rules ensure AI output meets design system, accessibility, and quality standards before shipping.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Prompt Engineering](#prompt-engineering) | 2 | HIGH | Writing prompts for component generation |
| [Quality Assurance](#quality-assurance) | 2 | CRITICAL/HIGH | Reviewing and gating AI-generated code |
| [Design System Integration](#design-system-integration) | 2 | HIGH | Injecting tokens, refactoring for conformance |
| [Tool Selection & Workflow](#tool-selection--workflow) | 2 | MEDIUM | Choosing the right AI tool, iterating prompts |

**Total: 7 rules across 4 categories**

## Decision Table — v0 vs Bolt vs Cursor

| Scenario | Tool | Why |
|----------|------|-----|
| New component from scratch | v0 | Full scaffold with shadcn/ui, Tailwind, a11y |
| Full-stack prototype/app | Bolt | Includes backend, routing, deployment |
| Incremental change in existing codebase | Cursor | Understands project context, imports, tokens |
| Refactor existing component | Cursor | Reads surrounding code, respects conventions |
| Explore visual design variations | v0 | Fast iteration on look-and-feel |
| Add feature to running app | Bolt | Hot-reload preview, full environment |
| Fix bug in existing component | Cursor | Inline edits with full project awareness |

## Quick Start

### Structured Prompt Example

```
Generate a React signup form component using:
- Framework: React 19 + TypeScript
- Styling: Tailwind CSS v4 + shadcn/ui
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
3. **Constraint-first prompts** — Specify framework, tokens, a11y, and states upfront. Vague prompts produce vague output.
4. **Iterative refinement** — Complex components need 2-3 prompt passes: structure first, states second, polish third.
5. **CI is non-negotiable** — Every AI-generated component goes through the same CI pipeline as hand-written code.
6. **Accessibility by default** — Include a11y requirements in every prompt; verify with automated checks post-generation.

## Anti-Patterns (FORBIDDEN)

- **Shipping raw AI output** — Never merge AI-generated code without human review and design system refactoring.
- **Vague prompts** — "Make a nice form" produces inconsistent, non-conformant output. Always specify constraints.
- **Hardcoded hex/rgb values** — AI tools default to arbitrary colors. Replace with OKLCH design tokens.
- **Skipping CI for "simple" components** — AI-generated code has the same bug surface as hand-written code.
- **Using v0 for incremental changes** — v0 generates from scratch; use Cursor for changes within an existing codebase.
- **Single-pass complex components** — Multi-state components (loading, error, empty, success) need iterative prompting.
- **Trusting AI a11y claims** — AI tools add ARIA attributes inconsistently. Always verify with axe-core or Storybook a11y addon.

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/ai-ui-tool-comparison.md](references/ai-ui-tool-comparison.md) | v0 vs Bolt vs Cursor vs Copilot comparison |
| [references/prompt-templates-library.md](references/prompt-templates-library.md) | Copy-paste prompt templates for common components |
| [references/ai-ui-failure-modes.md](references/ai-ui-failure-modes.md) | Top 10 failure modes and fixes |

## Related Skills

- `ork:ui-components` — shadcn/ui component patterns and CVA variants
- `ork:accessibility` — WCAG compliance, ARIA patterns, screen reader support
- `ork:animation-motion-design` — Motion library animation patterns
- `ork:responsive-patterns` — Responsive layout and container query patterns
- `ork:design-system` — Design token architecture and theming

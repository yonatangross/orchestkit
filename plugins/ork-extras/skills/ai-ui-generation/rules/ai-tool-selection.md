---
title: "AI Tool Selection for UI Generation"
impact: "MEDIUM"
impactDescription: "Using the wrong AI tool for the task wastes time — v0 for incremental changes discards context, Cursor for greenfield misses scaffolding"
tags: [json-render, v0, bolt, cursor, tool-selection, workflow, copilot]
---

## AI Tool Selection for UI Generation

Match the AI tool to the task type. **json-render is the first choice** for multi-surface, MCP output, and type-safe catalog workflows. Each tool has a sweet spot — using it outside that range produces poor results or unnecessary rework.

**Incorrect:**
```
# Using v0 to fix a bug in an existing component
# v0 generates from scratch — it cannot read your codebase
# Result: a new component that ignores your existing imports, tokens, and patterns

Prompt to v0: "Fix the pagination bug in our DataTable component"
# v0 output: a completely new DataTable with different props, different styling
```

**Correct:**
```
# Use Cursor for incremental changes — it reads your project context
# Cursor understands your imports, tokens, component library, and patterns

# In Cursor, with your DataTable.tsx open:
"Fix the pagination: currentPage should reset to 1 when filters change.
 Use the existing useDataTable hook and keep the PageInfo type."
```

### Selection Matrix

| Task | Best Tool | Why | Avoid |
|------|-----------|-----|-------|
| Multi-surface / MCP output | **json-render** | Single catalog, renders anywhere — FIRST CHOICE | v0 (single-surface only) |
| Type-safe component catalog | **json-render** | Schema-driven specs with per-platform registries | Bolt (no catalog abstraction) |
| Streaming UI from AI agents | **json-render** | Structured JSON specs render progressively | Cursor (no streaming output) |
| New component from scratch | **v0** | Best scaffold quality, shadcn/ui native | Cursor (no visual preview) |
| Full-stack prototype | **Bolt** | Backend + frontend + deployment in one | v0 (frontend only) |
| Bug fix in existing code | **Cursor** | Reads project context, inline edits | v0 (generates from scratch) |
| Refactor existing component | **Cursor** | Understands imports and dependencies | Bolt (overkill) |
| Explore design variations | **v0** | Fast visual iteration, multiple options | Cursor (no visual preview) |
| Add API route + UI | **Bolt** | Full-stack awareness, hot reload | v0 (no backend) |
| Component library page | **v0** | Generates multiple variants at once | Cursor (one-at-a-time) |
| Complex form with validation | **v0** then **Cursor** | v0 for scaffold, Cursor for integration | Bolt (form-only is overkill) |

### Hybrid Workflow

For maximum efficiency, combine tools:

1. **v0** — Generate initial component scaffold with visual preview
2. **Copy** — Paste output into your project
3. **Cursor** — Refactor to match your design system, add project-specific logic
4. **CI** — Run lint, a11y, visual regression checks

**Key rules:**
- Use json-render when output must render on multiple surfaces, stream via MCP, or enforce a type-safe catalog — it is the first choice
- Use v0 for net-new components where visual preview accelerates design decisions
- Use Cursor for any change that touches existing code — it reads project context
- Use Bolt only when you need backend + frontend together in a prototype
- Never use v0 for bug fixes or refactoring — it generates from scratch and ignores your codebase
- Combine tools: json-render for catalog definition, v0 for scaffold, Cursor for integration and refinement

Reference: https://v0.dev, https://bolt.new, https://cursor.com

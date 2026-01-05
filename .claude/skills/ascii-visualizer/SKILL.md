---
name: ASCII Visualizer
description: Use when visualizing architecture, data flows, or system diagrams in text. Creates ASCII art for plans, workflows, and structures that render in terminals and markdown.
version: 1.0.0
tags: [ascii, visualization, diagrams, architecture, 2025]
---

# ASCII Visualizer Skill

Create clear ASCII visualizations for explaining complex concepts.

## When to Use

- Explaining system architecture
- Showing workflow steps
- Displaying progress/metrics
- Before/after comparisons
- File/directory structures

## Box-Drawing Characters

**IMPORTANT:** Use a fixed-width (monospace) font for proper rendering.

```
┌─┐│└─┘  Standard weight
┏━┓┃┗━┛  Heavy weight
├─┤┬┴    Connectors
╔═╗║╚═╝  Double lines
```

## Quick Examples

### Architecture
```
┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│   Backend    │
│   React 19   │      │   FastAPI    │
└──────────────┘      └───────┬──────┘
                              │
                              ▼
                      ┌──────────────┐
                      │  PostgreSQL  │
                      └──────────────┘
```

### Progress
```
[████████░░] 80% Complete
✅ Design    (2 days)
✅ Backend   (5 days)
🔄 Frontend  (3 days)
⏳ Testing   (pending)
```

See `references/` for complete patterns.

---
title: Assessment Dashboard Spec (json-render)
impact: HIGH
impactDescription: Reduces downstream context cost when chaining assessment results into /ork:implement, /ork:fix-issue, or /ork:create-pr.
tags: [json-render, dashboard, spec, assess]
---

# Assessment Dashboard Spec

When `--render=json-render` or `--render=both` is passed to `/ork:assess`, Phase 7 emits a json-render-compatible JSON spec to `.claude/chain/assess-dashboard.json` instead of (or in addition to) the markdown report.

The spec follows the **flat element-map format** documented in `ork:mcp-visual-output` — `{ root, elements }` with each element keyed by id and referencing children by id. This matches what `@json-render/mcp` 0.17+ consumes and what downstream skills can parse for structured handoff.

## Catalog

These are the only component types the spec is allowed to use. They map to `@json-render/shadcn` registry entries when rendered visually.

| Type | Purpose | Required Props |
|------|---------|----------------|
| `Card` | Section wrapper with optional title | `title?: string` |
| `StatGrid` | Composite score + grade at a glance | `items: { label, value, trend?, color? }[]` |
| `DataTable` | Per-dimension scores, pros/cons, alternatives | `columns: { key, label }[]`, `rows: Record<string,string>[]` |
| `StatusBadge` | Verdict (EXCELLENT, GOOD, ADEQUATE, NEEDS WORK, CRITICAL) | `label: string`, `status: success|warning|error|info|pending` |
| `BarMeter` | Per-dimension score 0-10 | `label: string`, `value: number` (0-10), `color?: string` |
| `Markdown` | Free-text reasoning, caveats | `content: string` |

`color` enum: `green | red | yellow | blue | gray`. Use `green` for ≥8, `yellow` for 5–7.9, `red` for <5.

## Example

A complete spec for `/ork:assess backend/app/services/auth.py`:

```json
{
  "root": "report",
  "version": "1.0.0",
  "skill": "assess",
  "target": "backend/app/services/auth.py",
  "grade": "B+",
  "composite": 7.4,
  "elements": {
    "report": {
      "type": "Card",
      "props": { "title": "Assessment — backend/app/services/auth.py" },
      "children": ["headline", "verdict", "dimensions", "pros-cons", "improvements"]
    },
    "headline": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Composite", "value": "7.4/10", "color": "green" },
          { "label": "Grade", "value": "B+", "color": "green" },
          { "label": "Effort to A", "value": "1 day" },
          { "label": "Lowest", "value": "Testability 5.5", "color": "yellow" }
        ]
      }
    },
    "verdict": {
      "type": "StatusBadge",
      "props": { "label": "GOOD — ship with two follow-ups", "status": "success" }
    },
    "dimensions": {
      "type": "Card",
      "props": { "title": "Per-Dimension Scores" },
      "children": ["dim-correctness", "dim-maintainability", "dim-security", "dim-performance", "dim-testability", "dim-architecture", "dim-documentation"]
    },
    "dim-correctness": { "type": "BarMeter", "props": { "label": "Correctness", "value": 8.5, "color": "green" } },
    "dim-maintainability": { "type": "BarMeter", "props": { "label": "Maintainability", "value": 7.0, "color": "green" } },
    "dim-security": { "type": "BarMeter", "props": { "label": "Security", "value": 8.0, "color": "green" } },
    "dim-performance": { "type": "BarMeter", "props": { "label": "Performance", "value": 7.5, "color": "green" } },
    "dim-testability": { "type": "BarMeter", "props": { "label": "Testability", "value": 5.5, "color": "yellow" } },
    "dim-architecture": { "type": "BarMeter", "props": { "label": "Architecture", "value": 8.0, "color": "green" } },
    "dim-documentation": { "type": "BarMeter", "props": { "label": "Documentation", "value": 6.0, "color": "yellow" } },
    "pros-cons": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "side", "label": "" },
          { "key": "item", "label": "Item" },
          { "key": "weight", "label": "Weight" }
        ],
        "rows": [
          { "side": "Pro", "item": "Token rotation correctly invalidates old refresh", "weight": "High" },
          { "side": "Pro", "item": "Pure functions for JWT verify — easy to test in isolation", "weight": "Med" },
          { "side": "Con", "item": "No tests for the rotation grace window", "weight": "High" },
          { "side": "Con", "item": "Session.refresh logs raw token on debug=True", "weight": "High" }
        ]
      }
    },
    "improvements": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "action", "label": "Action" },
          { "key": "effort", "label": "Effort" },
          { "key": "impact", "label": "Impact" },
          { "key": "priority", "label": "Priority" }
        ],
        "rows": [
          { "action": "Add rotation grace-window test", "effort": "1", "impact": "5", "priority": "5.0" },
          { "action": "Strip token from debug log line", "effort": "1", "impact": "4", "priority": "4.0" },
          { "action": "Document refresh contract", "effort": "2", "impact": "3", "priority": "1.5" }
        ]
      }
    }
  }
}
```

## Token cost (measured)

The example above serializes to **~900 tokens** of compact JSON. The equivalent markdown report (using `references/phase-templates.md` + `references/scoring-rubric.md`) for the same content is **~3500 tokens**.

The downstream win: `/ork:implement` reading this spec from `.claude/chain/assess-dashboard.json` knows the lowest-scoring dimension, the high-priority improvements, and the verdict — without re-parsing markdown tables.

## xhigh effort additions

When `effort=xhigh` is active, each `BarMeter` element gains a sibling `Markdown` element with caveats:

```json
"dim-security-caveats": {
  "type": "Markdown",
  "props": { "content": "**Confidence:** medium\n\n- Didn't execute SQL against a real DB to confirm parameterization\n- Reviewed 12 of 15 handlers; 3 deferred by scope filter" }
}
```

The `dimensions` Card lists both `dim-security` and `dim-security-caveats` as children. This is opt-in via `--render=json-render --effort=xhigh`.

## Validation

`scripts/render-spec.mjs` validates the spec on emission:

- All children ids resolve in `elements`
- Component types are in the catalog
- BarMeter values in [0, 10]
- DataTable rows match column keys
- Composite is in [0, 10]; grade matches grade interpretation thresholds

Invalid spec → fallback to markdown, never emit a partial spec.

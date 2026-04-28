---
title: Exploration Dashboard Spec (json-render)
impact: HIGH
impactDescription: Reduces downstream context cost ~3000 tok markdown → ~400 tok JSON spec when chained into /ork:fix-issue, /ork:implement, etc.
tags: [json-render, dashboard, spec, explore]
---

# Exploration Dashboard Spec

When `--render=json-render` or `--render=both` is passed to `/ork:explore`, Phase 8 emits a json-render-compatible JSON spec to `.claude/chain/explore-dashboard.json` instead of (or in addition to) the markdown report.

The spec follows the **flat element-map format** documented in `ork:mcp-visual-output` — `{ root, elements }` with each element keyed by id and referencing children by id. This is the format consumed by `@json-render/mcp` 0.17+ when an MCP host iframe-renders it, and is also consumable by downstream skills as a structured handoff.

## Catalog

These are the only component types the spec is allowed to use. They map to `@json-render/shadcn` registry entries when rendered visually.

| Type | Purpose | Required Props |
|------|---------|----------------|
| `Card` | Section wrapper with optional title | `title?: string` |
| `StatGrid` | 2–6 metrics in a grid | `items: { label, value, trend?, color? }[]` |
| `DataTable` | Tabular rows | `columns: { key, label }[]`, `rows: Record<string,string>[]` |
| `StatusBadge` | Single status indicator | `label: string`, `status: success|warning|error|info|pending` |
| `BarMeter` | 0-10 score bar | `label: string`, `value: number` (0-10), `color?: string` |
| `Heatmap` | Coupling/dependency matrix | `xLabels: string[]`, `yLabels: string[]`, `cells: number[][]` |
| `Markdown` | Free-text fallback for prose sections | `content: string` |

`trend` enum: `up | down | flat`. `color` enum: `green | red | yellow | blue | gray`.

Elements may reference children only by id from the same `elements` map. Recursion is bounded — Cards can contain other Cards but no deeper than 2 levels.

## Example

A complete spec for `/ork:explore authentication`:

```json
{
  "root": "report",
  "version": "1.0.0",
  "skill": "explore",
  "topic": "authentication",
  "elements": {
    "report": {
      "type": "Card",
      "props": { "title": "Exploration Report — authentication" },
      "children": ["summary", "health", "deps", "files"]
    },
    "summary": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Files matched", "value": "23" },
          { "label": "Health score", "value": "7.4/10", "color": "green" },
          { "label": "Coupling", "value": "Medium", "color": "yellow" },
          { "label": "Patterns", "value": "service-layer, repository" }
        ]
      }
    },
    "health": {
      "type": "Card",
      "props": { "title": "Code Health" },
      "children": ["health-readability", "health-maintainability", "health-testability"]
    },
    "health-readability": { "type": "BarMeter", "props": { "label": "Readability", "value": 8.0, "color": "green" } },
    "health-maintainability": { "type": "BarMeter", "props": { "label": "Maintainability", "value": 7.0, "color": "green" } },
    "health-testability": { "type": "BarMeter", "props": { "label": "Testability", "value": 6.5, "color": "yellow" } },
    "deps": {
      "type": "Card",
      "props": { "title": "Dependency Hotspots" },
      "children": ["deps-table"]
    },
    "deps-table": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "file", "label": "File" },
          { "key": "fanin", "label": "Fan-in" },
          { "key": "fanout", "label": "Fan-out" },
          { "key": "score", "label": "Coupling" }
        ],
        "rows": [
          { "file": "src/auth/session.ts", "fanin": "12", "fanout": "4", "score": "high" },
          { "file": "src/auth/jwt.ts", "fanin": "8", "fanout": "2", "score": "med" }
        ]
      }
    },
    "files": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "file", "label": "File" },
          { "key": "purpose", "label": "Purpose" },
          { "key": "score", "label": "Health" }
        ],
        "rows": [
          { "file": "src/auth/session.ts", "purpose": "Session tokens + refresh", "score": "8.0" },
          { "file": "src/auth/jwt.ts", "purpose": "JWT sign/verify wrapper", "score": "7.5" }
        ]
      }
    }
  }
}
```

## Token cost (measured, not promised)

The example above serializes to **~700 tokens** (compact JSON). The equivalent markdown report from `references/exploration-report-template.md` is **~3000 tokens** when filled with the same content, mostly because of repeated table syntax and ASCII art.

The savings show up when downstream skills (e.g., `/ork:fix-issue`, `/ork:implement`) parse this spec from `.claude/chain/explore-dashboard.json` instead of re-reading the human-facing markdown. The markdown still gets written for the human reader when `--render=both` (the default for `/ork:explore`).

## Validation

The companion script `scripts/render-spec.mjs` validates the spec on emission:

- All children ids resolve in `elements`
- Component types are in the catalog
- Required props are present
- BarMeter values are in [0, 10]
- DataTable rows match column keys

Validation failure aborts emission with a non-zero exit. The skill MUST fall back to markdown when validation fails — never emit a partial or invalid spec.

## How downstream skills consume it

```python
spec = JSON.parse(Read(".claude/chain/explore-dashboard.json"))
hotspots = spec.elements["deps-table"].props.rows  # structured rows
overall_health = spec.elements["summary"].props.items[1].value  # "7.4/10"
```

No regex. No markdown table parsing. The spec is the structured handoff; the markdown is the human view.

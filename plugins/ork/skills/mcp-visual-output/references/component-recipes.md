# Component Recipes for MCP Visual Output

OrchestKit-specific recipes for common dashboard use cases. Each recipe shows the catalog definition, a sample spec, and integration notes.

## Recipe 1: Eval Results Dashboard

Display skill evaluation results with pass rates, scores, and per-skill breakdowns.

### Catalog

```typescript
const evalCatalog = defineCatalog({
  StatGrid: {
    props: z.object({
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        color: z.enum(['green', 'red', 'yellow', 'blue']).optional(),
      })),
    }),
    children: false,
  },
  DataTable: {
    props: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string())),
      sortable: z.boolean().optional(),
    }),
    children: false,
  },
  StatusBadge: {
    props: z.object({
      label: z.string(),
      status: z.enum(['success', 'warning', 'error', 'info', 'pending']),
    }),
    children: false,
  },
})
```

### Sample Spec

```json
{
  "root": "eval-dashboard",
  "elements": {
    "eval-dashboard": {
      "type": "Card",
      "props": { "title": "Eval Results -- v7.21.1" },
      "children": ["run-status", "summary", "skill-results"]
    },
    "run-status": {
      "type": "StatusBadge",
      "props": { "label": "Eval Run #42", "status": "success" }
    },
    "summary": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Skills Evaluated", "value": "94", "trend": "flat" },
          { "label": "Pass Rate", "value": "97.8%", "trend": "up", "color": "green" },
          { "label": "Avg Score", "value": "8.2/10", "trend": "up" },
          { "label": "Regressions", "value": "2", "color": "yellow" }
        ]
      }
    },
    "skill-results": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "skill", "label": "Skill" },
          { "key": "score", "label": "Score" },
          { "key": "status", "label": "Status" },
          { "key": "delta", "label": "vs Previous" }
        ],
        "rows": [
          { "skill": "implement", "score": "9.1", "status": "pass", "delta": "+0.3" },
          { "skill": "verify", "score": "8.7", "status": "pass", "delta": "+0.1" },
          { "skill": "commit", "score": "7.2", "status": "pass", "delta": "-0.5" }
        ],
        "sortable": true
      }
    }
  }
}
```

## Recipe 2: Hook Pipeline Visualization

Show the status of hook execution across global, agent-scoped, and skill-scoped hooks.

### Sample Spec

```json
{
  "root": "hook-pipeline",
  "elements": {
    "hook-pipeline": {
      "type": "Stack",
      "props": { "gap": "md" },
      "children": ["global-hooks", "agent-hooks", "skill-hooks"]
    },
    "global-hooks": {
      "type": "Card",
      "props": { "title": "Global Hooks (37)" },
      "children": ["global-stats", "global-table"]
    },
    "global-stats": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Active", "value": "35", "color": "green" },
          { "label": "Disabled", "value": "2", "color": "yellow" }
        ]
      }
    },
    "global-table": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "hook", "label": "Hook" },
          { "key": "event", "label": "Event" },
          { "key": "status", "label": "Status" },
          { "key": "lastRun", "label": "Last Run" }
        ],
        "rows": [
          { "hook": "pre-commit-quality", "event": "PreToolUse", "status": "active", "lastRun": "2m ago" },
          { "hook": "commit-nudge", "event": "PostToolUse", "status": "active", "lastRun": "5m ago" }
        ]
      }
    },
    "agent-hooks": {
      "type": "Card",
      "props": { "title": "Agent-Scoped Hooks (47)" },
      "children": ["agent-badge"]
    },
    "agent-badge": {
      "type": "StatusBadge",
      "props": { "label": "All agent hooks healthy", "status": "success" }
    },
    "skill-hooks": {
      "type": "Card",
      "props": { "title": "Skill-Scoped Hooks (22)" },
      "children": ["skill-badge"]
    },
    "skill-badge": {
      "type": "StatusBadge",
      "props": { "label": "All skill hooks healthy", "status": "success" }
    }
  }
}
```

## Recipe 3: Test Coverage Dashboard

Show test suite results with coverage metrics and failing test details.

### Sample Spec

```json
{
  "root": "coverage-dashboard",
  "elements": {
    "coverage-dashboard": {
      "type": "Card",
      "props": { "title": "Test Coverage Report" },
      "children": ["coverage-stats", "suite-results"]
    },
    "coverage-stats": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Line Coverage", "value": "94.2%", "color": "green" },
          { "label": "Branch Coverage", "value": "87.1%", "color": "green" },
          { "label": "Tests Passed", "value": "847/850", "color": "green" },
          { "label": "Duration", "value": "3m 12s", "trend": "down" }
        ]
      }
    },
    "suite-results": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "suite", "label": "Suite" },
          { "key": "tests", "label": "Tests" },
          { "key": "passed", "label": "Passed" },
          { "key": "coverage", "label": "Coverage" }
        ],
        "rows": [
          { "suite": "unit", "tests": "620", "passed": "620", "coverage": "96%" },
          { "suite": "integration", "tests": "180", "passed": "178", "coverage": "89%" },
          { "suite": "e2e", "tests": "50", "passed": "49", "coverage": "82%" }
        ]
      }
    }
  }
}
```

## Recipe 4: Dependency Graph Summary

Show project dependency health at a glance.

### Sample Spec

```json
{
  "root": "deps",
  "elements": {
    "deps": {
      "type": "Card",
      "props": { "title": "Dependency Health" },
      "children": ["dep-stats", "outdated"]
    },
    "dep-stats": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Total Deps", "value": "142" },
          { "label": "Up to Date", "value": "128", "color": "green" },
          { "label": "Minor Behind", "value": "11", "color": "yellow" },
          { "label": "Major Behind", "value": "3", "color": "red" }
        ]
      }
    },
    "outdated": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "package", "label": "Package" },
          { "key": "current", "label": "Current" },
          { "key": "latest", "label": "Latest" },
          { "key": "type", "label": "Update Type" }
        ],
        "rows": [
          { "package": "react", "current": "18.2.0", "latest": "19.1.0", "type": "major" },
          { "package": "typescript", "current": "5.3.0", "latest": "5.7.0", "type": "minor" }
        ]
      }
    }
  }
}
```

## Guidelines for New Recipes

1. Start with a StatGrid summary at the top -- users want the headline numbers first
2. Follow with a DataTable for drillable details
3. Use StatusBadge for overall health indicators
4. Keep specs under 30 elements total for readability and token efficiency
5. Name elements after their content domain (e.g., `eval-stats`, `hook-table`), not their component type (e.g., `grid1`, `table2`)

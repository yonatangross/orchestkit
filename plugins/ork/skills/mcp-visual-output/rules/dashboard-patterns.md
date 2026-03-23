---
title: Use flat dashboard patterns with 3-5 component types for MCP visual output
impact: "MEDIUM"
impactDescription: "Complex component trees with 10+ types increase prompt token cost and make specs harder for the AI to generate correctly -- simpler catalogs produce more reliable output"
tags: [dashboard, patterns, stat-grid, status-badge, data-table, mcp, visual-output]
---

## Dashboard Patterns

Most MCP visual dashboards can be built with 3-5 component types: StatGrid, StatusBadge, DataTable, Card, and Stack. Keeping the catalog small reduces prompt tokens and makes AI-generated specs more reliable.

**Incorrect -- overly complex component tree:**
```json
{
  "root": "app",
  "elements": {
    "app": { "type": "ThemeProvider", "children": ["router"] },
    "router": { "type": "Router", "children": ["layout"] },
    "layout": { "type": "DashboardLayout", "children": ["sidebar", "main"] },
    "sidebar": { "type": "Sidebar", "children": ["nav", "filters"] },
    "nav": { "type": "Navigation", "props": { "items": [] } },
    "filters": { "type": "FilterPanel", "children": ["dateRange", "category"] },
    "dateRange": { "type": "DateRangePicker", "props": {} },
    "category": { "type": "Select", "props": {} },
    "main": { "type": "MainContent", "children": ["header", "body"] },
    "header": { "type": "PageHeader", "props": {} },
    "body": { "type": "ScrollArea", "children": ["grid"] },
    "grid": { "type": "ResponsiveGrid", "children": ["card1"] },
    "card1": { "type": "MetricCard", "props": {} }
  }
}
```

**Correct -- flat layout with standard dashboard components:**
```json
{
  "root": "dashboard",
  "elements": {
    "dashboard": {
      "type": "Card",
      "props": { "title": "System Overview" },
      "children": ["metrics", "services", "logs"]
    },
    "metrics": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Uptime", "value": "99.9%", "color": "green" },
          { "label": "Requests/s", "value": "1,247", "trend": "up" },
          { "label": "Error Rate", "value": "0.3%", "color": "yellow" },
          { "label": "P95 Latency", "value": "142ms", "trend": "down" }
        ]
      }
    },
    "services": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "name", "label": "Service" },
          { "key": "status", "label": "Status" },
          { "key": "version", "label": "Version" }
        ],
        "rows": [
          { "name": "api-gateway", "status": "healthy", "version": "2.4.1" },
          { "name": "auth-service", "status": "healthy", "version": "1.8.0" },
          { "name": "worker", "status": "degraded", "version": "3.1.2" }
        ]
      }
    },
    "logs": {
      "type": "StatusBadge",
      "props": { "label": "Last deploy", "status": "success" }
    }
  }
}
```

### Pattern: Multi-Section Dashboard

Use a Stack as root with multiple Cards for sections:

```json
{
  "root": "layout",
  "elements": {
    "layout": {
      "type": "Stack",
      "props": { "gap": "md" },
      "children": ["overview", "details"]
    },
    "overview": {
      "type": "Card",
      "props": { "title": "Overview" },
      "children": ["summary-stats"]
    },
    "summary-stats": {
      "type": "StatGrid",
      "props": { "items": [] }
    },
    "details": {
      "type": "Card",
      "props": { "title": "Details" },
      "children": ["detail-table"]
    },
    "detail-table": {
      "type": "DataTable",
      "props": { "columns": [], "rows": [] }
    }
  }
}
```

### Pattern: Status Dashboard

Combine StatusBadge with StatGrid for operational views. Root Card with a StatusBadge for overall health + StatGrid for key metrics:

```json
{
  "root": "status",
  "elements": {
    "status": { "type": "Card", "props": { "title": "Pipeline Status" }, "children": ["badge", "metrics"] },
    "badge": { "type": "StatusBadge", "props": { "label": "CI Pipeline", "status": "success" } },
    "metrics": { "type": "StatGrid", "props": { "items": [
      { "label": "Tests Passed", "value": "847/850", "color": "green" },
      { "label": "Build Time", "value": "3m 12s", "trend": "down" },
      { "label": "Coverage", "value": "94.2%", "trend": "up" }
    ]}}
  }
}
```

**Key rules:**
- Limit catalogs to 3-5 component types -- StatGrid, StatusBadge, DataTable, Card, and Stack cover most dashboards
- Keep element trees at 2-3 levels deep (root -> section -> component)
- Use Card as a sectioning container with a title prop
- Use Stack for vertical layouts with gap control
- StatGrid for multiple metrics at a glance (4-8 items works best visually)
- DataTable for structured data (paginate at 20 rows for readability)
- StatusBadge for single-status indicators (success/warning/error/info/pending)
- Name elements descriptively (e.g., `eval-stats`, `service-table`) -- the AI reads these names to understand structure

Reference: [json-render spec](https://github.com/nichochar/json-render)

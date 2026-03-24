---
title: "json-render Spec Format"
version: 1.0.0
---

# json-render Spec Format

The JSON spec is the data contract between AI and the renderer. It uses a flat-tree structure where all elements are top-level entries referenced by ID — no nesting.

## Structure

```json
{
  "root": "<element-id>",
  "elements": {
    "<element-id>": {
      "type": "<CatalogComponentName>",
      "props": { ... },
      "children": ["<child-id-1>", "<child-id-2>"],
      "on": { "<event>": { "action": "...", ... } },
      "watch": { "<state-path>": { "action": "...", ... } }
    }
  },
  "state": {
    "/<path>": <value>
  }
}
```

## Fields

### `root` (required)
The ID of the top-level element to render. Must reference a key in `elements`.

```json
{ "root": "page-container" }
```

### `elements` (required)
A flat map of element ID to element definition. Every element in the spec lives here — no nesting.

### Element Fields

**`type` (required):** Must match a component name in the catalog. Runtime validation rejects unknown types.

**`props` (required):** Object matching the Zod schema defined in the catalog for this type. Validated at render time.

**`children` (optional):** Array of element IDs that are children of this element. Only valid if the catalog entry allows children (`children: true` or a typed array like `['Button']`).

```json
"children": ["heading-1", "content-1", "footer-btn"]
```

**`on` (optional):** Event handlers keyed by event name.

```json
"on": {
  "press": { "action": "setState", "path": "/view", "value": "detail" },
  "change": { "action": "setState", "path": "/search", "value": "$event" }
}
```

The `$event` variable refers to the event value (input text, checkbox state, etc.).

**`watch` (optional):** Reactive bindings keyed by state path. When the watched path changes, the action fires.

```json
"watch": {
  "/filters": {
    "action": "load_data",
    "url": "/api/items",
    "params": { "$ref": "/filters" }
  }
}
```

### `state` (optional)
Top-level state tree using JSON Pointer paths. All `setState` and `watch` references point to paths in this tree.

```json
"state": {
  "/activeTab": "overview",
  "/selectedIds": [],
  "/filters": { "status": "all" },
  "/data": null
}
```

## Flat-Tree Design

json-render uses a flat tree (all elements as siblings) rather than nested JSON because:

1. **Streaming** — Elements can be added independently via JSON Patch without re-sending parent context
2. **Reuse** — The same element ID can be referenced as a child of multiple parents
3. **Simplicity** — AI generates a flat list, not deeply nested structures that are harder to validate
4. **Patching** — Updating a single element requires one patch operation, not a deep path traversal

## Complete Example

```json
{
  "root": "dashboard",
  "elements": {
    "dashboard": {
      "type": "Card",
      "props": { "title": "Sales Dashboard" },
      "children": ["stats", "tabs"]
    },
    "stats": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Revenue", "value": "$42K", "trend": "up" },
          { "label": "Orders", "value": "1,234", "trend": "up" },
          { "label": "Refunds", "value": "23", "trend": "down" }
        ]
      }
    },
    "tabs": {
      "type": "Tabs",
      "props": { "defaultValue": "chart" },
      "children": ["chart-tab", "table-tab"]
    },
    "chart-tab": {
      "type": "Card",
      "props": { "title": "Revenue Chart" },
      "children": []
    },
    "table-tab": {
      "type": "Table",
      "props": {
        "columns": [
          { "key": "date", "label": "Date", "sortable": true },
          { "key": "amount", "label": "Amount", "sortable": true },
          { "key": "status", "label": "Status", "sortable": false }
        ],
        "rows": []
      },
      "watch": {
        "/data/orders": {
          "action": "load_data",
          "url": "/api/orders"
        }
      }
    }
  },
  "state": {
    "/data/orders": null
  }
}
```

## Validation Flow

1. `root` must reference an existing element ID
2. Each element `type` must exist in the catalog
3. Each element `props` must pass the Zod schema for that type
4. Each `children` entry must reference an existing element ID
5. Children are only allowed if the catalog entry permits them
6. `on` event names must be valid for the component type
7. `watch` paths must reference paths in the `state` tree

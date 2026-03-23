---
title: "Actions and State Bindings in Specs"
impact: "MEDIUM"
impactDescription: "Without proper on/watch/state patterns, json-render specs are static — no interactivity, no dynamic data loading, no state synchronization"
tags: [json-render, actions, state, events, reactivity, watch, zustand, redux]
---

## Actions and State Bindings in Specs

json-render specs support three interactivity primitives: `on` (event handlers), `watch` (reactive data bindings), and `state` (shared state tree). These turn static specs into interactive UIs without AI generating imperative code.

**Incorrect:**
```json
{
  "root": "form-1",
  "elements": {
    "form-1": {
      "type": "Card",
      "props": { "title": "Settings" },
      "children": ["btn-1"]
    },
    "btn-1": {
      "type": "Button",
      "props": { "label": "Save" }
    }
  }
}
```
No interactivity — button click does nothing, no state, no data loading.

**Correct:**
```json
{
  "root": "form-1",
  "elements": {
    "form-1": {
      "type": "Card",
      "props": { "title": "Settings" },
      "children": ["toggle-1", "btn-1"],
      "watch": {
        "/settings": {
          "action": "load_data",
          "url": "/api/settings"
        }
      }
    },
    "toggle-1": {
      "type": "Switch",
      "props": { "label": "Dark Mode", "checked": false },
      "on": {
        "change": {
          "action": "setState",
          "path": "/settings/darkMode",
          "value": "toggle"
        }
      }
    },
    "btn-1": {
      "type": "Button",
      "props": { "label": "Save", "variant": "default" },
      "on": {
        "press": {
          "action": "submit",
          "url": "/api/settings",
          "method": "POST",
          "body": { "$ref": "/settings" }
        }
      }
    }
  },
  "state": {
    "/settings": {
      "darkMode": false,
      "notifications": true
    }
  }
}
```

### The Three Primitives

**`on` — Event Handlers:**
Attached to elements, fire on user interaction.

| Event | Triggers When |
|-------|---------------|
| `press` | Button click / tap |
| `change` | Input, Select, Switch, Checkbox value change |
| `submit` | Form submission |
| `focus` / `blur` | Element focus state changes |

**`watch` — Reactive Data Bindings:**
Attached to elements, react to state path changes. Supports `action`, `url`, and optional `interval` (polling in ms).

```json
"watch": { "/data/stats": { "action": "load_data", "url": "/api/stats", "interval": 30000 } }
```

**`state` — Shared State Tree:**
Top-level object with JSON Pointer paths. All `setState` and `watch` bindings reference these paths.

```json
"state": { "/activeTab": "overview", "/filters": { "status": "all" }, "/data": null }
```

### Built-in Actions

| Action | Description | Example |
|--------|-------------|---------|
| `setState` | Set a state path to a value | `{ "action": "setState", "path": "/tab", "value": "settings" }` |
| `load_data` | Fetch data from URL into state | `{ "action": "load_data", "url": "/api/data" }` |
| `submit` | POST/PUT data to URL | `{ "action": "submit", "url": "/api/save", "method": "POST" }` |
| `navigate` | Client-side navigation | `{ "action": "navigate", "to": "/dashboard" }` |
| `toggle` | Toggle boolean state path | `{ "action": "setState", "path": "/open", "value": "toggle" }` |

### State Adapters

Connect json-render state to your app's state management:

```typescript
// Zustand adapter
import { createZustandAdapter } from '@json-render/zustand'
const adapter = createZustandAdapter(useAppStore)
<Render catalog={catalog} components={components} spec={spec} stateAdapter={adapter} />

// Redux adapter
import { createReduxAdapter } from '@json-render/redux'
const adapter = createReduxAdapter(store)

// Jotai adapter
import { createJotaiAdapter } from '@json-render/jotai'
const adapter = createJotaiAdapter()

// XState adapter
import { createXStateAdapter } from '@json-render/xstate'
const adapter = createXStateAdapter(machine)
```

**Key rules:**
- Use `on` for user-initiated actions (clicks, input changes) — never for data loading
- Use `watch` for reactive data fetching — it re-fetches when the watched state path changes
- Define all state paths in the top-level `state` object — referencing undefined paths is a runtime error
- Use `$ref` in action bodies to reference state paths: `"body": { "$ref": "/formData" }`
- Choose the state adapter that matches your existing state management library — do not mix adapters

Reference: https://github.com/nicholasgriffintn/json-render

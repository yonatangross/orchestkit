---
name: vercel-json-render-zustand
description: "Zustand state store adapter for json-render StateStore interface."
tags:
  - json-render
  - zustand
  - state
  - adapter

version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: low
upstream:
  repo: vercel-labs/json-render
  path: skills/zustand/SKILL.md
  synced: "2026-03-31T11:04:31Z"
  status: synced
---


# @json-render/zustand

Zustand adapter for json-render's `StateStore` interface. Wire a Zustand vanilla store as the state backend for json-render.

## Installation

```bash
npm install @json-render/zustand @json-render/core @json-render/react zustand
```

Requires Zustand v5+. Zustand v4 is not supported due to breaking API changes in the vanilla store interface.

## Usage

```tsx
import { createStore } from "zustand/vanilla";
import { zustandStateStore } from "@json-render/zustand";
import { StateProvider } from "@json-render/react";

// 1. Create a Zustand vanilla store
const bearStore = createStore(() => ({
  count: 0,
  name: "Bear",
}));

// 2. Create the json-render StateStore adapter
const store = zustandStateStore({ store: bearStore });

// 3. Use it
<StateProvider store={store}>
  {/* json-render reads/writes go through Zustand */}
</StateProvider>
```

### With a Nested Slice

```tsx
const appStore = createStore(() => ({
  ui: { count: 0 },
  auth: { token: null },
}));

const store = zustandStateStore({
  store: appStore,
  selector: (s) => s.ui,
  updater: (next, s) => s.setState({ ui: next }),
});
```

## API

### `zustandStateStore(options)`

Creates a `StateStore` backed by a Zustand store.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `store` | `StoreApi<S>` | Yes | Zustand vanilla store (from `createStore` in `zustand/vanilla`) |
| `selector` | `(state) => StateModel` | No | Select the json-render slice. Defaults to entire state. |
| `updater` | `(nextState, store) => void` | No | Apply next state to the store. Defaults to shallow merge. Override for nested slices, or use `(next, s) => s.setState(next, true)` for full replacement. |

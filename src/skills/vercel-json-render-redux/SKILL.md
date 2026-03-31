---
name: vercel-json-render-redux
description: "Redux/RTK state store adapter for json-render StateStore interface."
tags:
  - json-render
  - redux
  - state
  - adapter

version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: low
upstream:
  repo: vercel-labs/json-render
  path: skills/redux/SKILL.md
  synced: "2026-03-31T11:04:30Z"
  status: synced
---


# @json-render/redux

Redux adapter for json-render's `StateStore` interface. Wire a Redux store (or Redux Toolkit slice) as the state backend for json-render.

## Installation

```bash
npm install @json-render/redux @json-render/core @json-render/react redux
# or with Redux Toolkit (recommended):
npm install @json-render/redux @json-render/core @json-render/react @reduxjs/toolkit
```

## Usage

```tsx
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { reduxStateStore } from "@json-render/redux";
import { StateProvider } from "@json-render/react";

// 1. Define a slice for json-render state
const uiSlice = createSlice({
  name: "ui",
  initialState: { count: 0 } as Record<string, unknown>,
  reducers: {
    replaceUiState: (_state, action) => action.payload,
  },
});

// 2. Create the Redux store
const reduxStore = configureStore({
  reducer: { ui: uiSlice.reducer },
});

// 3. Create the json-render StateStore adapter
const store = reduxStateStore({
  store: reduxStore,
  selector: (state) => state.ui,
  dispatch: (next, s) => s.dispatch(uiSlice.actions.replaceUiState(next)),
});

// 4. Use it
<StateProvider store={store}>
  {/* json-render reads/writes go through Redux */}
</StateProvider>
```

## API

### `reduxStateStore(options)`

Creates a `StateStore` backed by a Redux store.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `store` | `Store` | Yes | The Redux store instance |
| `selector` | `(state) => StateModel` | Yes | Select the json-render slice from the Redux state tree. Use `(s) => s` if the entire state is the model. |
| `dispatch` | `(nextState, store) => void` | Yes | Dispatch an action that replaces the selected slice with the next state |

The `dispatch` callback receives the full next state model and the Redux store.

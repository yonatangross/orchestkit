---
name: vercel-json-render-xstate
description: "XState Store atom adapter for json-render StateStore interface."
tags:
  - json-render
  - xstate
  - state
  - adapter

version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: low
upstream:
  repo: vercel-labs/json-render
  path: skills/xstate/SKILL.md
  synced: "2026-03-31T11:04:31Z"
  status: synced
---


# @json-render/xstate

[XState Store](https://stately.ai/docs/xstate-store) adapter for json-render's `StateStore` interface. Wire an `@xstate/store` atom as the state backend for json-render.

## Installation

```bash
npm install @json-render/xstate @json-render/core @json-render/react @xstate/store
```

Requires `@xstate/store` v3+.

## Usage

```tsx
import { createAtom } from "@xstate/store";
import { xstateStoreStateStore } from "@json-render/xstate";
import { StateProvider } from "@json-render/react";

// 1. Create an atom
const uiAtom = createAtom({ count: 0 });

// 2. Create the json-render StateStore adapter
const store = xstateStoreStateStore({ atom: uiAtom });

// 3. Use it
<StateProvider store={store}>
  {/* json-render reads/writes go through @xstate/store */}
</StateProvider>
```

## API

### `xstateStoreStateStore(options)`

Creates a `StateStore` backed by an `@xstate/store` atom.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `atom` | `Atom<StateModel>` | Yes | An `@xstate/store` atom (from `createAtom`) holding the json-render state model |

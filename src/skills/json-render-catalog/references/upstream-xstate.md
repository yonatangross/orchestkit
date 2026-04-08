<!-- SYNCED from vercel-labs/json-render (skills/xstate/SKILL.md) -->
<!-- Hash: f69e656f8e72e5f3225aa9e5b68304b1a4acf85cbc59c17a4b9f4c595b76d7bb -->
<!-- Re-sync: bash scripts/sync-vercel-skills.sh -->


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

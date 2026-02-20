---
title: Use the Zustand slice pattern to keep stores maintainable and avoid merge conflicts
category: zustand
impact: HIGH
impactDescription: "Monolithic stores become unmaintainable and cause merge conflicts. Missing slice types break TypeScript inference."
tags: [zustand, slices, architecture, StateCreator, modular]
---

## Zustand: Slice Pattern

Split large stores into typed slices using `StateCreator`. Each slice owns a domain of state and actions, combined into a single store at creation time.

**Incorrect:**
```typescript
// Monolithic store — all domains in one create() call
const useStore = create<AllState>()((set, get) => ({
  user: null, token: null,
  login: async (creds) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
  items: [], addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  sidebarOpen: false, theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  // ... 20 more fields — unmaintainable
}));
```

**Correct:**
```typescript
import { create, StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type AppStore = AuthSlice & CartSlice & UISlice;

// --- Auth Slice (store/auth-slice.ts) ---
interface AuthSlice { user: User | null; login: (creds: Credentials) => Promise<void>; logout: () => void; }

const createAuthSlice: StateCreator<
  AppStore, [['zustand/immer', never]], [], AuthSlice
> = (set) => ({
  user: null,
  login: async (creds) => { set({ user: await api.login(creds) }, undefined, 'auth/login'); },
  logout: () => set((s) => { s.user = null; }, undefined, 'auth/logout'),
});

// --- Cart Slice (cross-slice access via get()) ---
interface CartSlice { items: CartItem[]; addItem: (item: CartItem) => void; }

const createCartSlice: StateCreator<
  AppStore, [['zustand/immer', never]], [], CartSlice
> = (set, get) => ({
  items: [],
  addItem: (item) => {
    if (!get().user) return; // Cross-slice access via get()
    set((s) => { s.items.push(item); }, undefined, 'cart/addItem');
  },
});

// --- Combined Store ---
const useStore = create<AppStore>()(
  immer((...a) => ({
    ...createAuthSlice(...a),
    ...createCartSlice(...a),
    ...createUISlice(...a),
  }))
);
```

**Key rules:**
- Type each slice as `StateCreator<CombinedStore, MiddlewareMutators, [], SliceInterface>` for full store type inference
- Combine with spread: `create<Store>()((...a) => ({ ...createSliceA(...a), ...createSliceB(...a) }))` -- `...a` forwards `set`, `get`, `store`
- Access other slices via `get()` inside actions, never by importing state directly -- avoids circular dependencies
- Keep each slice in its own file, export only the creator function and interface
- Declare middleware mutator types in the `StateCreator` generic so TypeScript knows available features

Reference: `references/middleware-composition.md` (TypeScript Typing for Middleware)

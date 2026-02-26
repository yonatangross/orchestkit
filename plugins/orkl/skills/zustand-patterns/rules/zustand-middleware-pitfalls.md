---
title: Avoid Zustand middleware pitfalls that cause silent reactivity breaks and hydration failures
category: zustand
impact: HIGH
impactDescription: "Silent reactivity breaks, hydration failures, TS errors, and corrupted persisted state."
tags: [zustand, middleware, immer, persist, devtools, pitfalls]
---

## Zustand: Middleware Pitfalls

Four common middleware mistakes that cause silent bugs in Zustand stores.

### Pitfall 1: Mutating State Without Immer

**Incorrect:**
```typescript
set((state) => { state.items.push(item); return state; }); // Mutates in place, no re-render
```

**Correct:**
```typescript
set((state) => ({ items: [...state.items, item] }));           // Immutable update
immer((set) => ({ addItem: (item) => set((s) => { s.items.push(item); }) })) // With immer
```

### Pitfall 2: Duplicate Middleware / Wrong Nesting

**Incorrect:**
```typescript
persist(persist((set) => ({ /* ... */ }), { name: 'a' }), { name: 'b' }) // Double-wrap
```

**Correct:**
```typescript
persist((set) => ({ /* ... */ }), { name: 'app-storage', partialize: (s) => ({ theme: s.theme }) })
```

### Pitfall 3: Missing DevTools Type Import

**Incorrect:**
```typescript
import { devtools } from 'zustand/middleware'; // TS errors — types not augmented
```

**Correct:**
```typescript
import { devtools } from 'zustand/middleware';
import type {} from '@redux-devtools/extension'; // Required type augmentation
```

### Pitfall 4: Missing Persist Version Migrations

**Incorrect:**
```typescript
persist((set) => ({ theme: 'light', fontSize: 14 }), { name: 'settings', version: 2 })
// Was version 1 — no migrate function, old state silently dropped
```

**Correct:**
```typescript
persist((set) => ({ theme: 'light', fontSize: 14 }), {
  name: 'settings',
  version: 2,
  migrate: (persisted: unknown, version: number) => {
    const state = persisted as Record<string, unknown>;
    if (version === 1) return { ...state, fontSize: 14 }; // v1->v2: added fontSize
    return state;
  },
})
```

**Key rules:**
- Never use mutable methods (`push`, `splice`, property assignment) in `set()` without `immer` middleware
- Never double-wrap the same middleware -- each should appear exactly once
- Always `import type {} from '@redux-devtools/extension'` when using `devtools`
- Always provide a `migrate` function when bumping persist `version`

Reference: `references/middleware-composition.md` (Common Pitfalls)

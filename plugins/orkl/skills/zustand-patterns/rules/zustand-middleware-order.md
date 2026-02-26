---
title: Nest Zustand middleware in the correct order to prevent devtools and persist failures
category: zustand
impact: CRITICAL
impactDescription: "Wrong middleware nesting order causes devtools to miss actions, persist to serialize untransformed state, and immer drafts to leak outside their scope."
tags: [zustand, middleware, immer, devtools, persist]
---

## Zustand: Middleware Order

Zustand middleware wraps from inside out. The innermost middleware executes first, and the outermost middleware executes last. Getting this order wrong silently breaks persistence, devtools recording, and immutable updates.

**Incorrect:**
```typescript
// WRONG: immer outermost — draft mutations leak to devtools and persist
const useStore = create<AppState>()(
  immer(devtools(persist((set) => ({
    count: 0,
    increment: () => set((state) => { state.count += 1; }),
  }), { name: 'app-storage' }), { name: 'AppStore' }))
);

// WRONG: devtools inside persist — devtools won't see persist rehydration
devtools(persist(immer((set) => ({ /* ... */ })), { name: 'storage' }), { name: 'Store' });
```

**Correct:**
```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {} from '@redux-devtools/extension';

// Correct order: persist > devtools > subscribeWithSelector > immer
const useStore = create<AppState>()(
  persist(
    devtools(
      subscribeWithSelector(
        immer((set) => ({
          count: 0,
          increment: () =>
            set(
              (state) => { state.count += 1; },
              undefined,
              'counter/increment'
            ),
        }))
      ),
      { name: 'AppStore', enabled: process.env.NODE_ENV === 'development' }
    ),
    {
      name: 'app-storage',
      partialize: (state) => ({ count: state.count }),
    }
  )
);
```

**Key rules:**
- **Immer** is always innermost -- transforms draft mutations into immutable updates first
- **subscribeWithSelector** wraps immer -- needs transformed (immutable) state for granular subscriptions
- **devtools** wraps subscribeWithSelector -- records actions after immer transforms them
- **persist** is always outermost -- serializes the final, fully transformed state to storage
- When using a subset, preserve relative order (e.g., `devtools(immer(...))` not `immer(devtools(...))`)

Reference: `references/middleware-composition.md` (Middleware Execution Order, Why Order Matters)

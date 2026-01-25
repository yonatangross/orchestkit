# Middleware Composition

Comprehensive guide to combining Zustand middleware in the correct order for production applications.

## Middleware Execution Order

Middleware wraps from **inside out**. The innermost middleware executes first, outermost last.

```
┌─────────────────────────────────────────────────────────────┐
│ persist (outermost - serializes final state)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ devtools (records actions after transformation)       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ subscribeWithSelector (enables granular subs)   │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │ immer (innermost - transforms mutations)  │  │  │  │
│  │  │  │                                           │  │  │  │
│  │  │  │   Your store logic lives here             │  │  │  │
│  │  │  │                                           │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Why Order Matters

| Position | Middleware | Reason |
|----------|------------|--------|
| Innermost | `immer` | Transforms draft mutations into immutable updates FIRST |
| Middle | `subscribeWithSelector` | Needs transformed (immutable) state to work correctly |
| Middle | `devtools` | Records actions AFTER immer transforms them |
| Outermost | `persist` | Serializes the FINAL transformed state |

## Complete Production Setup

```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {} from '@redux-devtools/extension'; // Required for devtools typing

interface AppState {
  // UI State
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  // User preferences
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateNotification: (key: keyof AppState['notifications'], value: boolean) => void;
  reset: () => void;
}

const initialState = {
  sidebarOpen: true,
  theme: 'system' as const,
  notifications: {
    email: true,
    push: true,
    sms: false,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    devtools(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          toggleSidebar: () =>
            set(
              (state) => { state.sidebarOpen = !state.sidebarOpen; },
              undefined,
              'ui/toggleSidebar' // Action name for devtools
            ),

          setTheme: (theme) =>
            set(
              (state) => { state.theme = theme; },
              undefined,
              'ui/setTheme'
            ),

          updateNotification: (key, value) =>
            set(
              (state) => { state.notifications[key] = value; },
              undefined,
              `notifications/update/${key}`
            ),

          reset: () =>
            set(
              () => initialState,
              true, // Replace entire state
              'app/reset'
            ),
        }))
      ),
      {
        name: 'AppStore',
        enabled: process.env.NODE_ENV === 'development',
        // Sanitize sensitive data from devtools
        serialize: {
          replacer: (key, value) => {
            if (key === 'password' || key === 'token') return '[REDACTED]';
            return value;
          },
        },
      }
    ),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      version: 2,

      // Only persist specific fields
      partialize: (state) => ({
        theme: state.theme,
        notifications: state.notifications,
        // Don't persist: sidebarOpen (session-only UI state)
      }),

      // Handle migrations between versions
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<AppState>;

        if (version === 0) {
          // v0 → v1: Added notifications
          return {
            ...state,
            notifications: { email: true, push: true, sms: false },
          };
        }

        if (version === 1) {
          // v1 → v2: Changed theme from boolean to union
          return {
            ...state,
            theme: (state as any).darkMode ? 'dark' : 'light',
          };
        }

        return state as AppState;
      },

      // Called when hydration completes
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate store:', error);
        } else {
          console.log('Store rehydrated:', state?.theme);
        }
      },
    }
  )
);
```

## subscribeWithSelector Usage

Enables subscribing to specific state slices outside React:

```typescript
// Subscribe to theme changes only
const unsubscribe = useAppStore.subscribe(
  (state) => state.theme,
  (theme, prevTheme) => {
    console.log('Theme changed:', prevTheme, '→', theme);
    document.documentElement.dataset.theme = theme;
  },
  { fireImmediately: true }
);

// Subscribe with equality function
useAppStore.subscribe(
  (state) => state.notifications,
  (notifications) => {
    syncNotificationsToServer(notifications);
  },
  { equalityFn: shallow } // Only trigger if shallow-different
);

// Cleanup
unsubscribe();
```

## Devtools Best Practices

### Action Naming Convention

```typescript
// ✅ GOOD: Namespace/action format
set(state => { ... }, undefined, 'cart/addItem');
set(state => { ... }, undefined, 'auth/login');
set(state => { ... }, undefined, 'ui/toggleSidebar');

// ❌ BAD: No action name (shows as "anonymous")
set(state => { ... });
```

### Conditional DevTools

```typescript
const useStore = create<State>()(
  devtools(
    (set) => ({ ... }),
    {
      name: 'MyStore',
      enabled: process.env.NODE_ENV === 'development',
      // Trace calls for debugging (performance cost!)
      trace: process.env.NODE_ENV === 'development',
      traceLimit: 25,
    }
  )
);
```

## Persist Strategies

### Session Storage (Tab-Scoped)

```typescript
persist(
  (set) => ({ ... }),
  {
    name: 'session-store',
    storage: createJSONStorage(() => sessionStorage),
  }
)
```

### IndexedDB (Large Data)

```typescript
import { get, set, del } from 'idb-keyval';

const indexedDBStorage = {
  getItem: async (name: string) => {
    return (await get(name)) ?? null;
  },
  setItem: async (name: string, value: string) => {
    await set(name, value);
  },
  removeItem: async (name: string) => {
    await del(name);
  },
};

persist(
  (set) => ({ ... }),
  {
    name: 'large-store',
    storage: createJSONStorage(() => indexedDBStorage),
  }
)
```

### Async Storage (React Native)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

persist(
  (set) => ({ ... }),
  {
    name: 'mobile-store',
    storage: createJSONStorage(() => AsyncStorage),
  }
)
```

## Middleware Without Full Stack

### Immer Only (Simple Apps)

```typescript
const useStore = create<State>()(
  immer((set) => ({
    items: [],
    addItem: (item) => set((state) => { state.items.push(item); }),
  }))
);
```

### Persist Only (Simple Persistence)

```typescript
const useStore = create<State>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'theme-storage' }
  )
);
```

### DevTools Only (Development)

```typescript
const useStore = create<State>()(
  devtools(
    (set) => ({ ... }),
    { enabled: process.env.NODE_ENV === 'development' }
  )
);
```

## TypeScript Typing for Middleware

When using multiple middleware, TypeScript needs explicit middleware type annotation:

```typescript
import { create, StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface BearState {
  bears: number;
  increase: () => void;
}

// Explicit middleware types for slices
type BearSlice = StateCreator<
  BearState,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  BearState
>;

const createBearSlice: BearSlice = (set) => ({
  bears: 0,
  increase: () => set((state) => { state.bears += 1; }),
});

const useStore = create<BearState>()(
  devtools(
    immer(createBearSlice),
    { name: 'BearStore' }
  )
);
```

## Common Pitfalls

### ❌ Wrong Order

```typescript
// WRONG: persist inside devtools
devtools(persist(immer(...))) // DevTools won't see persist actions

// CORRECT: persist outside devtools
persist(devtools(immer(...)))
```

### ❌ Duplicate Middleware

```typescript
// WRONG: Double-wrapping
persist(persist(...)) // Causes hydration issues
```

### ❌ Missing Type Import

```typescript
// WRONG: DevTools types missing
import { devtools } from 'zustand/middleware';

// CORRECT: Import type augmentation
import { devtools } from 'zustand/middleware';
import type {} from '@redux-devtools/extension';
```

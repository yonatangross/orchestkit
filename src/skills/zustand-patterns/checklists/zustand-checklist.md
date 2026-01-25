# Zustand Implementation Checklist

Comprehensive checklist for production-ready Zustand stores.

## Store Setup

### TypeScript Configuration
- [ ] Store interface defined with all state and actions
- [ ] `create<State>()()` double-call pattern used for type inference
- [ ] Action return types are `void` (mutations via `set()`)
- [ ] `type {} from '@redux-devtools/extension'` imported for devtools typing

### Store Structure
- [ ] Single store with slices (not multiple separate stores)
- [ ] Each slice has single responsibility (auth, cart, ui, etc.)
- [ ] Initial state extracted to const for reset functionality
- [ ] Reset action implemented for testing/logout

### Middleware Stack
- [ ] Middleware applied in correct order: `persist(devtools(subscribeWithSelector(immer(...))))`
- [ ] Immer used if nested state updates needed (3+ levels deep)
- [ ] DevTools enabled for development only
- [ ] DevTools has meaningful store name

## Selectors

### Basic Selectors
- [ ] Every state access uses a selector
- [ ] No full-store destructuring: `const { x, y } = useStore()` ❌
- [ ] Selectors are granular (one value per selector when possible)

### Multi-Value Selectors
- [ ] `useShallow` used for selecting multiple related values
- [ ] Import from `zustand/react/shallow` (not deprecated `zustand/shallow`)

### Computed Values
- [ ] Derived state computed in selectors, not stored
- [ ] Expensive computations memoized with `useMemo` if needed

### Action Selectors
- [ ] Action selectors exported for stable references
- [ ] Actions grouped by domain: `useAuthActions()`, `useCartActions()`

## Persistence

### Configuration
- [ ] `partialize` used to persist only necessary fields
- [ ] Ephemeral state excluded (loading, errors, UI toggles)
- [ ] Storage key is unique and descriptive

### Migrations
- [ ] `version` field set (start at 1)
- [ ] `migrate` function handles all version transitions
- [ ] Migrations are tested
- [ ] `onRehydrateStorage` handles errors gracefully

### Storage Selection
- [ ] localStorage for cross-tab persistence
- [ ] sessionStorage for tab-scoped persistence
- [ ] IndexedDB for large data (via idb-keyval)

## DevTools

### Configuration
- [ ] DevTools disabled in production: `enabled: process.env.NODE_ENV === 'development'`
- [ ] Store has descriptive name
- [ ] Sensitive data sanitized in serialize config

### Action Naming
- [ ] All `set()` calls include action name: `set(fn, undefined, 'domain/action')`
- [ ] Action names follow convention: `domain/action` or `domain/sub/action`
- [ ] No anonymous actions in devtools timeline

## Performance

### Re-render Prevention
- [ ] Components only subscribe to needed state
- [ ] Large lists use virtualization
- [ ] Expensive selectors memoized

### Bundle Size
- [ ] Tree-shaking works (check bundle analyzer)
- [ ] Unused middleware not imported

## Testing

### Test Setup
- [ ] Store can be reset between tests
- [ ] `getState()` used for assertions
- [ ] `setState()` used for test setup

### Test Coverage
- [ ] All actions tested
- [ ] Selector outputs verified
- [ ] Persistence/rehydration tested
- [ ] Migrations tested with old state snapshots

## Integration

### React Query Separation
- [ ] Server state in React Query (API data)
- [ ] Client state in Zustand (UI, preferences)
- [ ] No API calls in Zustand actions (use React Query mutations)

### SSR/RSC Considerations
- [ ] Hydration mismatch handled
- [ ] `useStore` only called in client components
- [ ] Initial state matches server render

## Code Organization

### File Structure
```
stores/
├── index.ts           # Re-exports
├── app-store.ts       # Main store with all slices
├── slices/
│   ├── auth-slice.ts
│   ├── cart-slice.ts
│   └── ui-slice.ts
├── selectors/
│   └── index.ts       # All selector exports
└── types.ts           # Shared types
```

### Naming Conventions
- [ ] Store hook: `useAppStore`, `useAuthStore`
- [ ] Selectors: `useUser`, `useCartItems`, `useTheme`
- [ ] Action selectors: `useAuthActions`, `useCartActions`
- [ ] Slices: `createAuthSlice`, `createCartSlice`

## Security

- [ ] No sensitive data in persisted state (tokens, passwords)
- [ ] DevTools sanitizes sensitive fields
- [ ] Auth tokens stored in memory-only slice or secure storage

## Documentation

- [ ] Store interface documented with JSDoc
- [ ] Complex actions have usage examples
- [ ] Migration history documented
- [ ] README explains store architecture

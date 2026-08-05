---
name: zustand-patterns
license: MIT
compatibility: "Claude Code 2.1.220+."
description: "Reference for Zustand 5.x state management including slices, middleware, Immer, useShallow, persistence, selectors, and devtools integration. Documents 7 core patterns with TypeScript examples and anti-patterns. Use when building React state management with Zustand instead of Redux."
tags: [zustand, state-management, react, immer, middleware, persistence, slices]
context: inherit
agent: frontend-ui-developer
version: 1.0.0
allowed-tools: [Read, Write, Grep, Glob]
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: low
persuasion-type: reference
effort: low
targets:
  - library: zustand
    version: ">=5.0.0"
model: haiku
metadata:
  category: document-asset-creation
path_patterns: ["**/store/**", "**/stores/**", "*.store.*", "*.zustand.*"]
---

# Zustand Patterns

Modern state management with Zustand 5.x - lightweight, TypeScript-first, no boilerplate.

## Overview

- Global state without Redux complexity
- Shared state across components without prop drilling
- Persisted state with localStorage/sessionStorage
- Computed/derived state with selectors
- State that needs middleware (logging, devtools, persistence)

## Upstream coverage (do not restate)

Zustand's own docs are the source for the mechanics. This skill carries only the OrchestKit delta
on top of them, in `references/ork-delta.md`, the `rules/` files, and the checklist.

| Topic | First-party source |
|-------|--------------------|
| Basic store, `create<State>()()`, actions, async actions | https://github.com/pmndrs/zustand/blob/main/docs/reference/apis/create.md |
| Slices pattern (splitting and combining stores) | https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/slices-pattern.md |
| Typing slices and middleware mutator tuples | https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/advanced-typescript.md |
| Immer middleware (draft mutations) | https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/immer.md |
| persist: `partialize`, `version`, `migrate`, `onRehydrateStorage`, storage adapters | https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md |
| devtools: action names, `enabled`, `serialize`, `trace` | https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/devtools.md |
| `subscribeWithSelector` and non-React subscriptions | https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/subscribe-with-selector.md |
| Selectors and `useShallow` re-render control | https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/prevent-rerenders-with-use-shallow.md |
| v4 to v5 migration (`createWithEqualityFn`, React 18 floor) | https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md |
| SSR and hydration | https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/ssr-and-hydration.md |
| Store testing and reset | https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/testing.md |
| Server-state ownership (use TanStack Query, not Zustand) | https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state |

## Quick Reference

```typescript
// ✅ Create typed store with double-call pattern
const useStore = create<State>()((set, get) => ({ ... }));

// ✅ Use selectors for all state access
const count = useStore((s) => s.count);

// ✅ Use useShallow for multiple values (Zustand 5.x)
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })));

// ✅ Middleware order: immer → subscribeWithSelector → devtools → persist
create(persist(devtools(immer((set) => ({ ... })))))

// ❌ Never destructure entire store
const store = useStore(); // Re-renders on ANY change

// ❌ Never store server state (use TanStack Query instead)
const useStore = create((set) => ({ users: [], fetchUsers: async () => ... }));
```

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| State structure | Single store | Multiple stores | **Slices in single store** - easier cross-slice access |
| Nested updates | Spread operator | Immer middleware | **Immer** for deeply nested state (3+ levels) |
| Persistence | Manual localStorage | persist middleware | **persist middleware** with partialize |
| Multiple values | Multiple selectors | useShallow | **useShallow** for 2-5 related values |
| Server state | Zustand | TanStack Query | **TanStack Query** - Zustand for client-only state |
| DevTools | Always on | Conditional | **Conditional** - `enabled: process.env.NODE_ENV === 'development'` |

## Anti-Patterns & Integration

Forbidden patterns (store destructuring, derived state, server state, direct mutation) and React Query integration guidance.

Load Read("${CLAUDE_PLUGIN_ROOT}/skills/zustand-patterns/references/anti-patterns-and-integration.md") for anti-pattern examples and TanStack Query separation patterns.

## Related Skills

- `react-server-components-framework` - RSC hydration considerations with Zustand
- Server state: https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state
- Form state: https://react-hook-form.com/docs/useform

## Capability Details

### store-creation
**Keywords**: zustand, create, store, typescript, state
**Solves**: Setting up type-safe Zustand stores with proper TypeScript inference

### slices-pattern
**Keywords**: slices, modular, split, combine, StateCreator
**Solves**: Organizing large stores into maintainable, domain-specific slices

### middleware-stack
**Keywords**: immer, persist, devtools, middleware, compose
**Solves**: Combining middleware in correct order for immutability, persistence, and debugging

### selector-optimization
**Keywords**: selector, useShallow, re-render, performance, memoization
**Solves**: Preventing unnecessary re-renders with proper selector patterns

### persistence-migration
**Keywords**: persist, localStorage, sessionStorage, migrate, version
**Solves**: Persisting state with schema migrations between versions

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/zustand-patterns/references/<file>")`:

| File | Content |
|------|---------|
| `ork-delta.md` | OrchestKit-specific rules: the corrected `zustand/shallow` label, the v5 floor, secret handling, graded slice typing |
| `anti-patterns-and-integration.md` | Forbidden patterns and React Query integration |

Other resources:
- Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/zustand-patterns/scripts/store-template.ts")` - Production-ready store template
- Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/zustand-patterns/checklists/zustand-checklist.md")` - Implementation checklist

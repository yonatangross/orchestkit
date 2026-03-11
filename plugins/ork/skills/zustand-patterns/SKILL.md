---
name: zustand-patterns
license: MIT
compatibility: "Claude Code 2.1.73+."
description: Zustand 5.x state management with slices, middleware, Immer, useShallow, and persistence patterns for React applications. Use when building state management with Zustand.
tags: [zustand, state-management, react, immer, middleware, persistence, slices]
context: fork
agent: frontend-ui-developer
version: 1.0.0
allowed-tools: [Read, Write, Grep, Glob]
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: low
model: haiku
metadata:
  category: document-asset-creation
---

# Zustand Patterns

Modern state management with Zustand 5.x - lightweight, TypeScript-first, no boilerplate.

## Overview

- Global state without Redux complexity
- Shared state across components without prop drilling
- Persisted state with localStorage/sessionStorage
- Computed/derived state with selectors
- State that needs middleware (logging, devtools, persistence)

## Core Patterns

Covers basic stores, slices, Immer, persist, selectors, async actions, and devtools.

Load Read("${CLAUDE_SKILL_DIR}/references/core-patterns.md") for full code examples of all 7 core patterns.

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

Load Read("${CLAUDE_SKILL_DIR}/references/anti-patterns-and-integration.md") for anti-pattern examples and TanStack Query separation patterns.

## Related Skills

- `tanstack-query-advanced` - Server state management (use with Zustand for client state)
- `form-state-patterns` - Form state (React Hook Form vs Zustand for forms)
- `react-server-components-framework` - RSC hydration considerations with Zustand

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

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `core-patterns.md` | Basic store, slices, Immer, persist, selectors, async, devtools |
| `anti-patterns-and-integration.md` | Forbidden patterns and React Query integration |
| `middleware-composition.md` | Combining multiple middleware in correct order |

Other resources:
- Load: `Read("${CLAUDE_SKILL_DIR}/scripts/store-template.ts")` - Production-ready store template
- Load: `Read("${CLAUDE_SKILL_DIR}/checklists/zustand-checklist.md")` - Implementation checklist

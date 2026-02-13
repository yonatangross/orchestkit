---
title: React Compiler
impact: HIGH
impactDescription: "React Compiler auto-memoizes components, values, callbacks, and JSX — eliminating most manual optimization"
tags: react-compiler, auto-memo, memoization, react-19
---

# React Compiler

React 19's compiler is the primary approach to render optimization in 2026.

## Decision Tree

```
Is React Compiler enabled?
├─ YES → Let compiler handle memoization automatically
│        Only use useMemo/useCallback as escape hatches
│        DevTools shows "Memo ✨" badge
│
└─ NO → Profile first, then optimize
         1. React DevTools Profiler
         2. Identify actual bottlenecks
         3. Apply targeted optimizations
```

## What the Compiler Memoizes

- Component re-renders
- Intermediate values (like useMemo)
- Callback references (like useCallback)
- JSX elements

## Enabling the Compiler

```tsx
// next.config.js (Next.js 16+)
const nextConfig = {
  reactCompiler: true,
}

// Expo SDK 54+ enables by default
```

## Verification

Open React DevTools and look for the "Memo ✨" badge on components. If present, the compiler is successfully memoizing that component.

## Key Rules

1. **Enable** React Compiler as the first step
2. **Let** the compiler handle memoization automatically
3. **Verify** with DevTools "Memo ✨" badge
4. **Only** use manual memoization as escape hatches
5. **Profile** before adding any manual optimization

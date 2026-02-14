---
title: React Server Components Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Server-Client Boundary (rsc) — CRITICAL — 3 rules

Correct placement and usage of the server-client boundary to prevent bundle bloat and data leaks.

- `rsc-client-boundaries.md` — Push 'use client' to leaf components, avoid unnecessary client boundaries
- `rsc-serialization.md` — Only pass serializable props across server-client boundary
- `rsc-cache-safety.md` — Use request-scoped caches with proper user-keyed entries

## 2. Client Rendering (rsc) — HIGH — 2 rules

Hydration correctness and React 19 component patterns.

- `rsc-hydration.md` — Avoid hydration mismatches from browser API access during render
- `rsc-component-types.md` — Use function declarations, avoid deprecated React.FC

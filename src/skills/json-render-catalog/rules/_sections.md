---
title: json-render Catalog Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Catalog Definition (catalog) — HIGH — 1 rule

How to define component catalogs with `defineCatalog()` and Zod schemas.

- `catalog-definition.md` — defineCatalog with Zod schemas, children types, custom validators

## 2. Prop Constraints (prop) — HIGH — 1 rule

Constraining component props to prevent AI hallucination and invalid output.

- `prop-constraints.md` — z.enum for bounded choices, z.string().max() limits, z.array().max() caps

## 3. shadcn Catalog (shadcn) — MEDIUM — 1 rule

Using the 29 pre-built @json-render/shadcn components.

- `shadcn-catalog.md` — Component list, prop schemas, extending vs using as-is

## 4. Token Optimization (token) — MEDIUM — 1 rule

Reducing token usage by choosing the right spec format.

- `token-optimization.md` — YAML mode for standalone (30% fewer tokens), JSON for inline/streaming

## 5. Actions & State (action) — MEDIUM — 1 rule

Adding interactivity to specs with events, watchers, and state bindings.

- `action-state.md` — on event handlers, watch reactivity, setState/load_data actions, state adapters

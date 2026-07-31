---
title: json-render Catalog Rule Categories
version: 1.0.0
---

# Rule Categories

**Total: 3 rules across 3 categories.**

The shadcn Catalog and Actions & State categories were retired on 2026-07-31. Both files
restated vendor documentation, and had drifted into API names the vendor never shipped.
Their topics now point at https://github.com/vercel-labs/json-render from the
"Upstream coverage" table in `SKILL.md`; the lesson is in `references/ork-delta.md`.

## 1. Catalog Definition (catalog) — HIGH — 1 rule

How to define component catalogs with `defineCatalog()` and Zod schemas.

- `catalog-definition.md` — defineCatalog with Zod schemas, children types, custom validators

## 2. Prop Constraints (prop) — HIGH — 1 rule

Constraining component props to prevent AI hallucination and invalid output.

- `prop-constraints.md` — z.enum for bounded choices, z.string().max() limits, z.array().max() caps

## 3. Token Optimization (token) — MEDIUM — 1 rule

Reducing token usage by choosing the right spec format.

- `token-optimization.md` — YAML mode for standalone (30% fewer tokens), JSON for inline/streaming

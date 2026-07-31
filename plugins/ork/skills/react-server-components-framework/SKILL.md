---
name: react-server-components-framework
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Use when building Next.js 16+ apps with React Server Components. Covers App Router, Cache Components (replacing experimental_ppr), streaming SSR, Server Actions, and React 19 patterns for server-first architecture.
context: fork
agent: frontend-ui-developer
version: 1.5.0
author: OrchestKit
tags: [frontend, react, react-19.2, nextjs-16, server-components, streaming, cache-components, turbopack]
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: next.js
    version: ">=16.2.6"
  - library: react
    version: ">=19.2.6"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["*.tsx", "*.jsx", "**/next.config.*", "**/app/**/*.tsx"]
---

# React Server Components Framework

## Overview

React Server Components (RSC) enable server-first rendering with client-side interactivity. This skill covers Next.js 16.2 LTS App Router patterns, Server Components, Server Actions, and streaming.

> **Next.js 16.2.6 / React 19.2.6 (security release, May 2026)** — Turbopack is the default bundler (no `--turbo` flag needed), Server Fast Refresh is on by default, and the new `cacheComponents` config flag replaces the legacy `experimental_ppr` escape hatch. For AI-agent debugging Next.js ships **Next DevTools MCP** — wire `npx -y next-devtools-mcp@latest` into `.mcp.json` (it connects via the dev server's `/_next/mcp` endpoint) to inspect render trees and cache boundaries mid-session.

**When to use this skill:**
- Building Next.js 16+ applications with the App Router
- Designing component boundaries (Server vs Client Components)
- Implementing data fetching with caching and revalidation
- Creating mutations with Server Actions
- Optimizing performance with streaming and Suspense

---

## Quick Reference

### Server vs Client Components

| Feature | Server Component | Client Component |
|---------|-----------------|------------------|
| Directive | None (default) | `'use client'` |
| Async/await | Yes | No |
| Hooks | No | Yes |
| Browser APIs | No | Yes |
| Database access | Yes | No |
| Client JS bundle | Zero | Ships to client |

**Key Rule**: Server Components can render Client Components, but Client Components cannot directly import Server Components (use `children` prop instead).

### Data Fetching Quick Reference

**Next.js 16 Cache Components (Recommended):**

```tsx
import { cacheLife, cacheTag } from 'next/cache'

// Default — shared across all users (public CDN-cached)
async function CachedProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return await db.product.findMany()
}

// Remote variant (16.2+) — always served from the edge/CDN, never rendered
// inline on the origin. Best for static product listings, marketing content.
async function MarketingHero() {
  'use cache: remote'
  cacheLife('days')
  return <Hero />
}

// Private variant (16.2+) — cached per-user session. Never shared across
// users. Use for personalized dashboards with expensive computation.
async function UserDashboard({ userId }: { userId: string }) {
  'use cache: private'
  cacheLife('minutes')
  cacheTag(`user:${userId}`)
  return await loadDashboard(userId)
}

// Invalidate cache — v16 requires a cacheLife profile as the 2nd arg
import { revalidateTag } from 'next/cache'
revalidateTag('products', 'max') // or updateTag('products') for read-your-writes
```

Enable via `next.config.ts`:

```ts
import type { NextConfig } from 'next'
const config: NextConfig = {
  cacheComponents: true,  // 16.2+ — replaces experimental_ppr flag
}
export default config
```

**Legacy Fetch Options (Next.js 15):**

```tsx
// Static (cached indefinitely)
await fetch(url, { cache: 'force-cache' })

// Revalidate every 60 seconds
await fetch(url, { next: { revalidate: 60 } })

// Always fresh
await fetch(url, { cache: 'no-store' })

// Tag-based revalidation
await fetch(url, { next: { tags: ['posts'] } })
```

### Server Actions Quick Reference

```tsx
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const post = await db.post.create({ data: { title } })
  revalidatePath('/posts')
  redirect("/posts/" + post.id)
}
```

### Async Params/SearchParams (Next.js 16)

Route parameters and search parameters are now Promises that must be awaited:

```tsx
// app/posts/[slug]/page.tsx
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  return <Post slug={slug} page={page} />
}
```

**Note:** Also applies to `layout.tsx`, `generateMetadata()`, and route handlers. Complete migration guide: first-party `next-upgrade` / `vercel:next-upgrade` skill. House scars: `Read("${CLAUDE_SKILL_DIR}/references/ork-delta.md")`.

### Dev Server (Next.js 16.2 LTS)

- **Turbopack default** — `next dev` and `next build` run Turbopack without any flag. Pass `--webpack` only when forced (legacy plugin).
- **Server Fast Refresh** — Server Components hot-reload on save without losing client state. No extra config; it's on by default in 16.2.
- **Next DevTools MCP** — register `npx -y next-devtools-mcp@latest` in `.mcp.json`; it attaches to the running dev server over the `/_next/mcp` endpoint and exposes RSC payloads and cache boundaries to an MCP client. Designed for AI agents that need to inspect render trees mid-session without screenshotting. (There is no `next-browser` binary.)

---

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `ork-delta.md` | House rules and scars: fabricated-API corrections from PR #2143, React 19 house conventions (2026-07-31 distillation) |
| `tanstack-router-patterns.md` | React 19 features without Next.js, route-based data fetching, client-rendered app patterns |
| `capability-details.md` | Keyword and problem-mapping metadata for all 12 RSC capabilities |

---

## Upstream coverage (do not restate)

Vendor tutorials for these topics live in first-party skills and docs. This skill keeps only floors, scars, and house decisions (`references/ork-delta.md`).

| Topic | First-party source |
|-------|--------------------|
| Server Components fundamentals (async components, data fetching, route segment config, generateStaticParams, error handling) | `next-best-practices` / `vercel:nextjs` skill; nextjs.org/docs |
| Client Components, `'use client'`, hydration, client-only rendering | `next-best-practices` / `vercel:nextjs` skill |
| Server/Client boundary and composition patterns, serializable props | `next-best-practices` / `vercel:nextjs` skill; `vercel-composition-patterns` |
| Data fetching and caching (fetch cache options, revalidate, tags) | `next-best-practices` / `vercel:nextjs` skill |
| Streaming SSR, Suspense boundaries, loading.tsx, skeleton states | `vercel:nextjs` skill (streaming) |
| Server Actions, progressive enhancement, useActionState forms, Zod validation | `vercel:nextjs` skill (Server Actions) |
| Advanced routing (parallel, intercepting, route groups, dynamic and catch-all) | `vercel:nextjs` skill (routing) |
| Pages Router to App Router migration | `next-upgrade` / `vercel:next-upgrade` skill |
| Next.js 16 upgrade, breaking changes, codemods | `next-upgrade` / `vercel:next-upgrade` skill |
| Cache Components: `use cache`, cacheLife, cacheTag, updateTag, PPR | `next-cache-components` / `vercel:next-cache-components` skill |
| React 19 core APIs (useActionState, useFormStatus, useOptimistic, use(), ref as prop) | context7: `/vercel/next.js` + react.dev (query-docs) |
| RSC implementation and deployment checklist | `next-best-practices` skill |

---

## Best Practices Summary

### Component Boundaries
- Keep Client Components at the edges (leaves) of the component tree
- Use Server Components by default
- Extract minimal interactive parts to Client Components
- Pass Server Components as `children` to Client Components

### Data Fetching
- Fetch data in Server Components close to where it's used
- Use parallel fetching (`Promise.all`) for independent data
- Set appropriate cache and revalidate options
- Use `generateStaticParams` for static routes

### Performance
- Use Suspense boundaries for streaming
- Implement loading.tsx for instant loading states
- Enable PPR for static/dynamic mix
- Use route segment config to control rendering mode

---

## Templates

- **`scripts/server-component-template.tsx`** - Basic async Server Component with data fetching
- **`scripts/client-component-template.tsx`** - Interactive Client Component with hooks
- **`scripts/server-action-template.ts`** - Server Action with validation and revalidation
- **`scripts/create-server-component.md`** - Command-style scaffold; kept as the script-invocation contract exercised by `tests/skills/scripts/`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "You're importing a component that needs useState" | Add `'use client'` directive |
| "async/await is not valid in non-async Server Components" | Add `async` to function declaration |
| "Cannot use Server Component inside Client Component" | Pass Server Component as `children` prop |
| "Hydration mismatch" | Use `'use client'` for Date.now(), Math.random(), browser APIs |
| "params is not defined" or params returning Promise | Add `await` before `params` (Next.js 16 breaking change) |
| "experimental_ppr is not a valid export" | Use Cache Components with `"use cache"` directive instead |
| "cookies/headers is not a function" | Add `await` before `cookies()` or `headers()` (Next.js 16) |

---

## Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19.2 Blog Post](https://react.dev/blog/2025/10/01/react-19-2)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)

---

## Related Skills

After mastering React Server Components:
1. **Streaming API Patterns** - Real-time data patterns
2. **Type Safety & Validation** - tRPC integration
3. **Edge Computing Patterns** - Global deployment
4. **Performance Optimization** - Core Web Vitals

---

## Capability Details

Keyword and problem-mapping metadata for each RSC capability (react-19-patterns, use-hook-suspense, optimistic-updates-async, rsc-patterns, server-actions, data-fetching, streaming-ssr, caching, cache-components, tanstack-router-patterns, async-params, nextjs-16-upgrade).

Load full capability details: `Read("${CLAUDE_SKILL_DIR}/references/capability-details.md")`
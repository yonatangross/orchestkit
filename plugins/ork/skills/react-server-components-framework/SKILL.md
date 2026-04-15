---
name: react-server-components-framework
license: MIT
compatibility: "Claude Code 2.1.76+."
description: Use when building Next.js 16+ apps with React Server Components. Covers App Router, Cache Components (replacing experimental_ppr), streaming SSR, Server Actions, and React 19 patterns for server-first architecture.
context: fork
agent: frontend-ui-developer
version: 1.5.0
author: AI Agent Hub
tags: [frontend, react, react-19.2, nextjs-16, server-components, streaming, cache-components, turbopack]
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: next.js
    version: ">=16.2.3"
  - library: react
    version: ">=19.2.0"
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

> **Next.js 16.2.3 LTS (Apr 2026)** — Turbopack is the default bundler (no `--turbo` flag needed), Server Fast Refresh is on by default, and the new `cacheComponents` config flag replaces the legacy `experimental_ppr` escape hatch. For AI-agent debugging Next.js also ships the `next-browser` binary (`npx next-browser`), a CDP client for mid-run inspection.

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

// Invalidate cache
import { revalidateTag } from 'next/cache'
revalidateTag('products')
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

**Note:** Also applies to `layout.tsx`, `generateMetadata()`, and route handlers. Load: `Read("${CLAUDE_SKILL_DIR}/references/nextjs-16-upgrade.md")` for complete migration guide.

### Dev Server (Next.js 16.2 LTS)

- **Turbopack default** — `next dev` and `next build` run Turbopack without any flag. Pass `--webpack` only when forced (legacy plugin).
- **Server Fast Refresh** — Server Components hot-reload on save without losing client state. No extra config; it's on by default in 16.2.
- **`next-browser` agent CDP client** — `npx next-browser --url http://localhost:3000 --trace` attaches to the running dev server, streams RSC payloads and cache boundaries to stdout in JSON. Designed for AI agents that need to inspect render trees mid-session without screenshotting.

---

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `server-components.md` | Async server components, data fetching patterns, route segment config, generateStaticParams, error handling |
| `client-components.md` | `'use client'` directive, React 19 patterns, interactivity, hydration, composition via children |
| `streaming-patterns.md` | Suspense boundaries, loading.tsx, parallel streaming, PPR, skeleton best practices |
| `react-19-patterns.md` | Function declarations, ref as prop, useActionState, useFormStatus, useOptimistic, Activity, useEffectEvent |
| `server-actions.md` | Progressive enhancement, useActionState forms, Zod validation, optimistic updates |
| `routing-patterns.md` | Parallel routes, intercepting routes, route groups, dynamic and catch-all routes |
| `migration-guide.md` | Pages Router to App Router migration, getServerSideProps/getStaticProps replacement |
| `cache-components.md` | `"use cache"` directive (replaces `experimental_ppr`), cacheLife, cacheTag, revalidateTag, PPR integration |
| `nextjs-16-upgrade.md` | Node.js 20.9+, breaking changes (async params, cookies, headers), proxy.ts migration, Turbopack, new caching APIs |
| `tanstack-router-patterns.md` | React 19 features without Next.js, route-based data fetching, client-rendered app patterns |
| `capability-details.md` | Keyword and problem-mapping metadata for all 12 RSC capabilities |

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

- **`scripts/ServerComponent.tsx`** - Basic async Server Component with data fetching
- **`scripts/ClientComponent.tsx`** - Interactive Client Component with hooks
- **`scripts/ServerAction.tsx`** - Server Action with validation and revalidation

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
---
title: Minimize RSC client boundaries to avoid shipping unnecessary JavaScript to the browser
category: rsc
impact: CRITICAL
impactDescription: "Marking parent components as client components ships unnecessary JavaScript to the browser, disables server-side data fetching for the entire subtree, and defeats the purpose of RSC."
tags: [rsc, client-boundary, use-client, performance]
---

## RSC: Client Boundaries

The `'use client'` directive marks the boundary between Server and Client component trees. Every component imported by a Client Component becomes a Client Component too. Push `'use client'` to the smallest interactive leaf components to keep the server-rendered surface area as large as possible.

**Incorrect:**
```tsx
// app/products/page.tsx
'use client' // Entire page is now a client component

import { useState, useEffect } from 'react'

export default function ProductsPage() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts)
  }, [])

  return (
    <div>
      <h1>Products</h1>
      <ProductFilters />
      <ProductList products={products} />
    </div>
  )
}
```

**Correct:**
```tsx
// app/products/page.tsx — Server Component (default, no directive)
import { db } from '@/lib/database'
import { ProductFilters } from '@/components/ProductFilters'

export default async function ProductsPage() {
  const products = await db.product.findMany()

  return (
    <div>
      <h1>Products</h1>
      <ProductFilters />             {/* Client Component — leaf */}
      <ProductList products={products} /> {/* Server Component */}
    </div>
  )
}

// components/ProductFilters.tsx — only the interactive leaf is 'use client'
'use client'

import { useState } from 'react'

export function ProductFilters() {
  const [filter, setFilter] = useState('')
  return (
    <input
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      placeholder="Filter..."
    />
  )
}
```

**Key rules:**
- Never add `'use client'` to page or layout files; extract interactive parts into dedicated leaf components.
- Server Components can render Client Components, but Client Components **cannot** directly import Server Components — use the `children` prop pattern instead.
- Pass Server Components into Client Components via `children` or render-prop slots so they stay server-rendered.
- Every module imported by a `'use client'` file is pulled into the client bundle — keep imports minimal.

Reference: `references/client-components.md` (Common Mistakes), `references/component-patterns.md` (Composition Rules)

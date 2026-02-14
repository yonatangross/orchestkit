---
title: "RSC: Serialization"
category: rsc
impact: CRITICAL
impactDescription: "Passing non-serializable props (functions, class instances, Symbols) from Server to Client Components causes runtime errors or silent data loss at the server-client boundary."
tags: [rsc, serialization, props, server-client-boundary]
---

## RSC: Serialization

Only serializable data can cross the Server-to-Client Component boundary. React must serialize props into the RSC payload sent over the wire. Passing non-serializable values causes build or runtime errors.

**Incorrect:**
```tsx
// app/dashboard/page.tsx — Server Component
export default async function Dashboard() {
  const data = await getData()
  return (
    <ClientCard
      item={data}
      onClick={() => console.log('clicked')} // Functions cannot be serialized
      formatter={new Intl.NumberFormat('en-US')} // Class instances cannot be serialized
      icon={Symbol('star')} // Symbols cannot be serialized
    />
  )
}
```

**Correct:**
```tsx
// app/dashboard/page.tsx — Server Component
import { handleClick } from '@/app/actions' // Server Action

export default async function Dashboard() {
  const data = await getData()
  return (
    <ClientCard
      item={{ id: data.id, name: data.name, price: data.price }} // Plain object
      tags={['featured', 'sale']}  // Array of primitives
      isActive={true}              // Boolean
      onAction={handleClick}       // Server Actions ARE serializable
    />
  )
}

// components/ClientCard.tsx
'use client'

export function ClientCard({ item, tags, isActive, onAction }: ClientCardProps) {
  const handleLocalClick = () => onAction(item.id) // Call server action

  return (
    <div onClick={handleLocalClick}>
      <h2>{item.name}</h2>
      <p>{isActive ? 'Active' : 'Inactive'}</p>
    </div>
  )
}
```

**Serializable types** (safe to pass as props):
- Primitives: `string`, `number`, `bigint`, `boolean`, `null`, `undefined`
- Plain objects and arrays containing serializable values
- Server Actions (functions defined with `'use server'`)
- `Date`, `Map`, `Set`, `TypedArray`, `ArrayBuffer`

**Non-serializable types** (will error at the boundary):
- Regular functions and closures
- Class instances (`new Intl.NumberFormat()`, `new URL()`, custom classes)
- Symbols, `WeakMap`, `WeakSet`

**Key rules:**
- Define event handlers (`onClick`, `onChange`) inside the Client Component, not in the Server Component.
- Use Server Actions (`'use server'`) when you need to pass callable behavior from server to client.
- Convert class instances to plain objects before passing: `{ url: myUrl.toString() }` instead of `myUrl`.
- When in doubt, check if `JSON.stringify(prop)` would succeed — that is a reasonable (though not exact) heuristic.

Reference: `references/component-patterns.md` (Serializable Props Only)

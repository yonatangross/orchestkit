---
title: Prevent RSC hydration mismatches that cause visual flicker and degraded performance
category: rsc
impact: HIGH
impactDescription: "Hydration mismatches cause React to discard server-rendered HTML and re-render on the client, producing visual flicker, layout shifts, and degraded performance."
tags: [rsc, hydration, ssr, client-component, mismatch]
---

## RSC: Hydration

Hydration attaches event listeners to server-rendered HTML. If the client render produces different output than the server render, React throws a hydration mismatch warning and falls back to client-side rendering. Common causes: accessing browser APIs during render, using non-deterministic values (`Date.now()`, `Math.random()`), and conditional rendering based on client-only state.

**Incorrect — non-deterministic value in render:**
```tsx
'use client'

function TimestampBadge() {
  // Server renders one value, client renders another → mismatch
  return <span>{Date.now()}</span>
}
```

**Correct — defer to useEffect:**
```tsx
'use client'

import { useState, useEffect } from 'react'

function TimestampBadge() {
  const [time, setTime] = useState<number | null>(null)

  useEffect(() => {
    setTime(Date.now())
  }, [])

  return <span>{time ?? 'Loading...'}</span>
}
```

**Incorrect — browser API access during render:**
```tsx
'use client'

function ScreenWidth() {
  // window is undefined on the server → crash or mismatch
  const width = window.innerWidth
  return <p>Width: {width}px</p>
}
```

**Correct — browser API in useEffect with state:**
```tsx
'use client'

import { useState, useEffect } from 'react'

function ScreenWidth() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return <p>Width: {width}px</p>
}
```

**Key rules:**
- Never access `window`, `document`, `navigator`, `localStorage`, or other browser APIs during render — always use `useEffect`.
- Avoid non-deterministic expressions (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) in JSX — initialize as `null` and set in `useEffect`.
- Use `suppressHydrationWarning` only for intentional, harmless mismatches — never to silence bugs.
- For components that depend entirely on browser APIs, use a `ClientOnly` wrapper (mount guard via `useEffect`) or `next/dynamic` with `ssr: false`.

Reference: `references/client-components.md` (Avoiding Hydration Mismatches, Client-Only Rendering)

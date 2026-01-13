# Edge Caching Strategies

## Overview

Edge caching reduces latency and backend load by serving responses from the nearest edge location. This guide covers Cache-Control headers, cache invalidation, and personalization strategies for 2025.

## Cache-Control Headers

### Basic Patterns

#### Public Static Assets (Immutable)
```typescript
// Images, fonts, versioned JS/CSS
export async function GET(request: Request) {
  const response = await fetch('https://cdn.example.com/app.v123.js')

  return new Response(response.body, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable'
      // 1 year cache, never revalidate (version in filename)
    }
  })
}
```

#### Dynamic Content (Short Cache)
```typescript
// User dashboards, personalized feeds
export async function GET(request: Request) {
  const data = await fetchDynamicContent()

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60, must-revalidate'
      // 1 minute cache, only in browser, revalidate when stale
    }
  })
}
```

#### Semi-Static Content (Medium Cache)
```typescript
// Blog posts, product pages
export async function GET(request: Request) {
  const post = await fetchBlogPost()

  return new Response(JSON.stringify(post), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
      // Browser: 1 hour, CDN: 24 hours, serve stale for 24 hours while revalidating
    }
  })
}
```

#### No Cache (Always Fresh)
```typescript
// Real-time data, stock prices
export async function GET(request: Request) {
  const liveData = await fetchLiveData()

  return new Response(JSON.stringify(liveData), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
      // Never cache, always fetch fresh
    }
  })
}
```

## Stale-While-Revalidate

The `stale-while-revalidate` directive serves stale content while fetching fresh data in the background.

### Basic Implementation
```typescript
export async function GET(request: Request) {
  const url = new URL(request.url)
  const cacheKey = new Request(url.toString())
  const cache = caches.default

  // Try cache first
  let response = await cache.match(cacheKey)

  if (response) {
    // Serve from cache
    const age = parseInt(response.headers.get('Age') || '0')
    const maxAge = 300 // 5 minutes

    // If stale, revalidate in background
    if (age > maxAge) {
      // Don't await - serve stale immediately
      revalidateInBackground(cacheKey, cache)
    }

    return response
  }

  // Cache miss - fetch fresh
  response = await fetchFresh(request)
  await cache.put(cacheKey, response.clone())

  return response
}

async function revalidateInBackground(cacheKey: Request, cache: Cache) {
  try {
    const fresh = await fetchFresh(cacheKey)
    await cache.put(cacheKey, fresh)
  } catch (error) {
    console.error('Background revalidation failed:', error)
  }
}

async function fetchFresh(request: Request): Promise<Response> {
  const data = await fetch('https://api.example.com/data')
  return new Response(data.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=300, stale-while-revalidate=3600',
      'Age': '0'
    }
  })
}
```

### Advanced: Stale-If-Error
```typescript
export async function GET(request: Request) {
  const cache = caches.default
  const cacheKey = new Request(request.url)

  try {
    // Try fetching fresh data
    const response = await fetchWithTimeout('https://api.example.com/data', 5000)

    // Cache successful response
    await cache.put(cacheKey, response.clone())
    return response

  } catch (error) {
    // Origin failed - serve stale if available
    const stale = await cache.match(cacheKey)

    if (stale) {
      console.warn('Serving stale due to error:', error)
      return new Response(stale.body, {
        ...stale,
        headers: {
          ...Object.fromEntries(stale.headers),
          'X-Served-Stale': 'true',
          'X-Stale-Reason': 'origin-error'
        }
      })
    }

    // No stale version - return error
    throw error
  }
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
}
```

## Cache Invalidation

### Tag-Based Invalidation (Cloudflare)
```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Invalidate cache by tag
    if (url.pathname === '/api/purge' && request.method === 'POST') {
      const { tags } = await request.json()

      // Cloudflare Cache API with tags
      await fetch('https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      })

      return new Response('Cache purged', { status: 200 })
    }

    // Serve with cache tags
    const response = await fetch('https://origin.example.com' + url.pathname)
    return new Response(response.body, {
      headers: {
        ...Object.fromEntries(response.headers),
        'Cache-Tag': 'blog,post-123' // Tag for invalidation
      }
    })
  }
}
```

### Manual Cache Deletion
```typescript
export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const cacheKey = url.searchParams.get('key')

  if (!cacheKey) {
    return new Response('Missing key', { status: 400 })
  }

  const cache = caches.default
  const deleted = await cache.delete(new Request(`https://cache/${cacheKey}`))

  return new Response(
    JSON.stringify({ deleted }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

### Time-Based Invalidation (TTL)
```typescript
// Cloudflare KV with TTL
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const key = 'data:latest'

    // Try KV cache
    const cached = await env.CACHE_KV.get(key, 'json')
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      })
    }

    // Fetch fresh data
    const fresh = await fetchData()

    // Store with 5-minute TTL
    await env.CACHE_KV.put(key, JSON.stringify(fresh), {
      expirationTtl: 300
    })

    return new Response(JSON.stringify(fresh), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    })
  }
}
```

## Personalization at Edge

### Cookie-Based Personalization
```typescript
export async function GET(request: Request) {
  const userId = request.headers.get('Cookie')?.match(/userId=([^;]+)/)?.[1]

  if (userId) {
    // Serve personalized content (don't cache in CDN)
    const personalData = await fetchPersonalData(userId)
    return new Response(JSON.stringify(personalData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
        // Only cache in browser, not CDN
      }
    })
  }

  // Serve generic content (cache in CDN)
  const genericData = await fetchGenericData()
  return new Response(JSON.stringify(genericData), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
```

### Vary Header for Multiple Versions
```typescript
export async function GET(request: Request) {
  const country = request.headers.get('CF-IPCountry') || 'US'
  const language = request.headers.get('Accept-Language')?.split(',')[0] || 'en'

  // Fetch localized content
  const content = await fetchLocalizedContent(country, language)

  return new Response(JSON.stringify(content), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Vary': 'CF-IPCountry, Accept-Language'
      // Cache separate versions for each country/language
    }
  })
}
```

### Edge-Side Includes (ESI) Pattern
```typescript
// Compose cached fragments at edge
export async function GET(request: Request) {
  const cache = caches.default

  // Fetch cached fragments
  const [header, personalContent, footer] = await Promise.all([
    cache.match(new Request('https://cache/header')),
    fetchPersonalContent(), // Always fresh
    cache.match(new Request('https://cache/footer'))
  ])

  const html = `
    ${await header?.text() || ''}
    ${personalContent}
    ${await footer?.text() || ''}
  `

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'private, max-age=0'
      // Don't cache composed page
    }
  })
}
```

## Advanced Caching Patterns

### Conditional Requests (ETag)
```typescript
export async function GET(request: Request) {
  const data = await fetchData()
  const etag = await generateETag(data)

  // Check If-None-Match header
  const clientETag = request.headers.get('If-None-Match')

  if (clientETag === etag) {
    return new Response(null, {
      status: 304, // Not Modified
      headers: { 'ETag': etag }
    })
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'public, max-age=60'
    }
  })
}

async function generateETag(data: any): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(data))
  )
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
```

### Multi-Tier Caching
```typescript
export async function GET(request: Request, env: Env) {
  const key = 'data:product-123'

  // Tier 1: Edge cache (fastest)
  const edgeCache = caches.default
  let response = await edgeCache.match(request)
  if (response) {
    return addCacheHeader(response, 'edge')
  }

  // Tier 2: KV cache (fast, distributed)
  const kvData = await env.CACHE_KV.get(key, 'json')
  if (kvData) {
    response = new Response(JSON.stringify(kvData), {
      headers: { 'Content-Type': 'application/json' }
    })
    await edgeCache.put(request, response.clone())
    return addCacheHeader(response, 'kv')
  }

  // Tier 3: Database (slow)
  const dbData = await fetchFromDatabase()
  response = new Response(JSON.stringify(dbData), {
    headers: { 'Content-Type': 'application/json' }
  })

  // Populate caches
  await env.CACHE_KV.put(key, JSON.stringify(dbData), { expirationTtl: 3600 })
  await edgeCache.put(request, response.clone())

  return addCacheHeader(response, 'database')
}

function addCacheHeader(response: Response, tier: string): Response {
  const newResponse = new Response(response.body, response)
  newResponse.headers.set('X-Cache-Tier', tier)
  return newResponse
}
```

## Performance Monitoring

### Cache Hit Ratio Tracking
```typescript
let cacheHits = 0
let cacheMisses = 0

export async function GET(request: Request) {
  const cache = caches.default
  const cached = await cache.match(request)

  if (cached) {
    cacheHits++
    console.log(`Cache hit ratio: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2)}%`)
    return cached
  }

  cacheMisses++
  const fresh = await fetchFresh(request)
  await cache.put(request, fresh.clone())

  return fresh
}
```

### Cache Analytics Headers
```typescript
export async function GET(request: Request) {
  const startTime = Date.now()
  const cache = caches.default
  const cached = await cache.match(request)

  const cacheTime = Date.now() - startTime

  if (cached) {
    const age = parseInt(cached.headers.get('Age') || '0')
    const response = new Response(cached.body, cached)
    response.headers.set('X-Cache', 'HIT')
    response.headers.set('X-Cache-Age', age.toString())
    response.headers.set('X-Cache-Lookup-Time', `${cacheTime}ms`)
    return response
  }

  const fetchStart = Date.now()
  const fresh = await fetchFresh(request)
  const fetchTime = Date.now() - fetchStart

  fresh.headers.set('X-Cache', 'MISS')
  fresh.headers.set('X-Origin-Time', `${fetchTime}ms`)

  return fresh
}
```

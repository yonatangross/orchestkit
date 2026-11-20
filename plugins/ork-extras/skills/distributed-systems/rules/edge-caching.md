---
title: Configure edge caching with CDN invalidation, TTL, and stale-while-revalidate strategies
impact: HIGH
impactDescription: "Edge caching without proper invalidation strategies serves stale data indefinitely — cache-aside with TTL and stale-while-revalidate prevents this"
tags: edge-cache, cdn, cache-control, stale-while-revalidate, cloudflare-kv
---

## Edge Caching & CDN Patterns

Cache responses at the edge using Cache API, KV storage, and CDN headers for sub-millisecond response times.

**Incorrect — caching without TTL or invalidation:**
```typescript
// WRONG: Cache forever, no way to update
export default {
  async fetch(request: Request) {
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached; // Stale forever!

    const response = await fetch(request);
    await cache.put(request, response.clone()); // No expiry!
    return response;
  }
};
```

**Correct — cache-aside with TTL and stale-while-revalidate:**
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    // Check edge cache
    let response = await cache.match(cacheKey);
    if (response) return response;

    // Check KV (global, eventually consistent)
    const kvData = await env.CACHE_KV.get(url.pathname, 'text');
    if (kvData) {
      response = new Response(kvData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'CDN-Cache-Control': 'max-age=3600', // CDN caches longer
        },
      });
      // Populate edge cache
      await cache.put(cacheKey, response.clone());
      return response;
    }

    // Fetch from origin
    response = await fetch(request);
    const body = await response.text();

    // Store in KV with TTL
    await env.CACHE_KV.put(url.pathname, body, { expirationTtl: 3600 });

    const cachedResponse = new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
    await cache.put(cacheKey, cachedResponse.clone());
    return cachedResponse;
  }
};
```

**Cache header strategy:**
```
# Static assets (hashed filenames)
Cache-Control: public, max-age=31536000, immutable

# API responses (frequently changing)
Cache-Control: public, max-age=60, stale-while-revalidate=300

# Personalized content
Cache-Control: private, no-cache
Vary: Cookie, Authorization
```

**Key rules:**
- Always set `Cache-Control` with `max-age` and `stale-while-revalidate`
- Use `CDN-Cache-Control` to set different TTLs for CDN vs browser
- Use `Vary` header for content that changes by user/locale
- Cloudflare KV is eventually consistent (read-after-write may be stale)
- Use purge APIs for immediate invalidation of critical content
- Never cache authenticated/personalized responses without `Vary` or `private`

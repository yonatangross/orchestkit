---
title: Deploy edge workers with V8 isolate runtime constraints and fallback handling
impact: HIGH
impactDescription: "Deploying to edge without understanding runtime constraints causes silent failures — Node.js APIs are unavailable in V8 isolates"
tags: edge, cloudflare-workers, vercel-edge, deno-deploy, v8-isolates
---

## Edge Workers & Runtime

Deploy code to Cloudflare Workers, Vercel Edge, or Deno Deploy with correct runtime constraints and platform-specific patterns.

**Incorrect — using Node.js APIs at edge:**
```typescript
// WRONG: Node.js APIs not available in edge runtime
import fs from 'fs';
import { createHash } from 'crypto';

export default async function handler(req: Request) {
  const data = fs.readFileSync('./config.json'); // FAILS at edge
  const hash = createHash('sha256').update(data); // FAILS at edge
  return new Response(hash.digest('hex'));
}
```

**Correct — using Web APIs at edge:**
```typescript
// Cloudflare Worker with Web Crypto API
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const country = (request as any).cf?.country || 'US';

    // Web Crypto API (available at edge)
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
    }

    // Geo-based routing
    if (country === 'EU') {
      return Response.redirect(`https://eu.example.com${url.pathname}`);
    }

    return fetch(request);
  }
};
```

**Vercel Edge Middleware pattern:**
```typescript
// middleware.ts (Next.js Edge Middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = { matcher: ['/dashboard/:path*'] };

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // A/B testing via cookie
  const bucket = request.cookies.get('ab-bucket')?.value || 'control';
  return NextResponse.rewrite(new URL(`/${bucket}${request.nextUrl.pathname}`, request.url));
}
```

**Key rules:**
- Edge runtimes use V8 isolates — no `fs`, `path`, `child_process`, native modules
- Available: `fetch`, `Request`, `Response`, `crypto.subtle`, `TextEncoder`, streams
- Keep bundles < 1MB compressed for fast cold starts (< 1ms on Cloudflare)
- Use KV (Cloudflare) or Edge Config (Vercel) for distributed state
- Use Durable Objects for strong consistency when needed

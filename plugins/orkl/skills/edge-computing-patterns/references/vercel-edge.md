# Vercel Edge Functions Reference

## Overview

Vercel Edge Functions run on Vercel's global network using V8 isolates, providing low-latency responses across 100+ regions. They integrate seamlessly with Next.js for middleware and API routes.

## Edge Functions vs Serverless Functions

| Feature | Edge Functions | Serverless Functions |
|---------|---------------|---------------------|
| Runtime | V8 Isolates | Node.js |
| Cold Start | <10ms | 50-200ms |
| Max Duration | 25s (Hobby), 30s (Pro) | 10s (Hobby), 60s (Pro) |
| Memory | 128 MB | 1024 MB |
| APIs | Web APIs only | Full Node.js |
| Best For | Auth, routing, headers | Database queries, heavy compute |

### When to Use Edge Functions
```typescript
// ✅ Good: Authentication check (fast, no DB)
export const runtime = 'edge'

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')
  const isValid = await verifyJWT(token)

  if (!isValid) {
    return new Response('Unauthorized', { status: 401 })
  }

  return new Response('Authorized')
}

// ❌ Bad: Heavy database queries (use serverless instead)
export const runtime = 'edge' // Wrong choice!

export async function GET() {
  // Edge has no connection pooling, no Prisma, limited DB drivers
  const users = await db.query('SELECT * FROM users') // Will be slow/fail
  return new Response(JSON.stringify(users))
}
```

## Edge Middleware Patterns

Middleware runs before every request, enabling global request/response modification.

### Basic Middleware
```typescript
// middleware.ts (root of project)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Add custom header
  const response = NextResponse.next()
  response.headers.set('X-Custom-Header', 'value')

  return response
}

// Run on all routes
export const config = {
  matcher: '/:path*'
}
```

### A/B Testing Middleware
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()

  // Check existing bucket cookie
  let bucket = request.cookies.get('ab-test-bucket')?.value

  if (!bucket) {
    // Assign new bucket (50/50 split)
    bucket = Math.random() < 0.5 ? 'control' : 'variant'
  }

  // Rewrite to appropriate page
  if (bucket === 'variant') {
    url.pathname = `/variant${url.pathname}`
  }

  const response = NextResponse.rewrite(url)

  // Set persistent cookie
  response.cookies.set('ab-test-bucket', bucket, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: 'strict'
  })

  return response
}

export const config = {
  matcher: '/landing-page'
}
```

### Geolocation-Based Routing
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'
  const city = request.geo?.city
  const region = request.geo?.region

  const url = request.nextUrl.clone()

  // Redirect EU users to GDPR-compliant page
  const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'GB']
  if (euCountries.includes(country)) {
    url.pathname = '/eu' + url.pathname
    return NextResponse.rewrite(url)
  }

  // Pass geo data to page
  const response = NextResponse.next()
  response.headers.set('X-User-Country', country)
  response.headers.set('X-User-City', city || 'Unknown')

  return response
}

export const config = {
  matcher: '/:path*'
}
```

### Authentication Middleware
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Verify token at edge (fast!)
    const isValid = await verifyAuth(token)
    if (!isValid) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/private/:path*']
}
```

## Streaming Responses

Edge Functions support streaming for real-time data delivery without buffering.

### Basic Streaming
```typescript
export const runtime = 'edge'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send chunks over time
      controller.enqueue(encoder.encode('data: chunk 1\n\n'))
      await new Promise(resolve => setTimeout(resolve, 1000))

      controller.enqueue(encoder.encode('data: chunk 2\n\n'))
      await new Promise(resolve => setTimeout(resolve, 1000))

      controller.enqueue(encoder.encode('data: chunk 3\n\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### LLM Streaming Response
```typescript
export const runtime = 'edge'

export async function POST(request: Request) {
  const { prompt } = await request.json()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
  })

  // Stream OpenAI response directly to client
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  })
}
```

### Transform Stream Pattern
```typescript
export const runtime = 'edge'

export async function GET() {
  const upstream = await fetch('https://api.example.com/data')

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      // Modify each chunk (e.g., add metadata)
      const modified = JSON.parse(chunk)
      modified.timestamp = Date.now()
      controller.enqueue(JSON.stringify(modified))
    }
  })

  return new Response(upstream.body?.pipeThrough(transformStream), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Edge Config for Feature Flags

Edge Config is a globally distributed read-only data store optimized for feature flags and configuration.

### Setup Edge Config
```bash
# Create Edge Config
npx vercel env pull
npx vercel edge-config create my-config

# Link to project
npx vercel link
```

### Usage in Edge Function
```typescript
import { get } from '@vercel/edge-config'

export const runtime = 'edge'

export async function GET(request: Request) {
  // Read feature flag (sub-millisecond latency)
  const enableNewFeature = await get('enable_new_feature')

  if (enableNewFeature) {
    return new Response('New feature enabled!')
  }

  return new Response('Old feature')
}
```

### Advanced Edge Config Patterns
```typescript
import { get, getAll } from '@vercel/edge-config'

export async function middleware(request: NextRequest) {
  // Get all config at once (faster than multiple get() calls)
  const config = await getAll([
    'maintenance_mode',
    'allowed_countries',
    'rate_limit'
  ])

  // Maintenance mode
  if (config.maintenance_mode === true) {
    return new Response('Site under maintenance', { status: 503 })
  }

  // Country blocking
  const country = request.geo?.country
  if (!config.allowed_countries.includes(country)) {
    return new Response('Not available in your region', { status: 403 })
  }

  // Dynamic rate limiting
  const rateLimit = config.rate_limit || 100
  // ... rate limit logic

  return NextResponse.next()
}
```

## Edge API Routes

### Basic Edge API Route
```typescript
// app/api/hello/route.ts
export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name') || 'World'

  return new Response(JSON.stringify({ message: `Hello, ${name}!` }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### Edge API with Environment Variables
```typescript
export const runtime = 'edge'

export async function POST(request: Request) {
  const body = await request.json()

  // Access env vars (set in Vercel dashboard)
  const apiKey = process.env.API_KEY
  const region = process.env.VERCEL_REGION // Automatic var

  const response = await fetch('https://api.example.com/endpoint', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Region': region
    },
    body: JSON.stringify(body)
  })

  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Performance Tips

### Reduce Bundle Size
```typescript
// ❌ Bad: Large dependency
import { hugeLibrary } from 'huge-library' // 500KB!

// ✅ Good: Lightweight edge-compatible library
import { tinyLibrary } from '@edge/tiny-library' // 5KB
```

### Cache Expensive Computations
```typescript
import { unstable_cache } from 'next/cache'

export const runtime = 'edge'

const getCachedData = unstable_cache(
  async (userId: string) => {
    // Expensive operation
    const data = await fetchUserData(userId)
    return data
  },
  ['user-data'],
  { revalidate: 300 } // 5 minutes
)

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  const data = await getCachedData(userId!)
  return new Response(JSON.stringify(data))
}
```

## Common Gotchas

1. **No Node.js APIs**: Must use Web APIs only (no `fs`, `path`, `crypto` from Node)
2. **25-30s timeout**: Long-running tasks need serverless functions
3. **No connection pooling**: Database connections are expensive
4. **No file uploads**: Large request bodies should use serverless
5. **Limited npm packages**: Many packages depend on Node.js APIs

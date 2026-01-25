# Cloudflare Workers Reference

## Overview

Cloudflare Workers run on Cloudflare's global network of 300+ edge locations using V8 isolates (not containers), providing sub-millisecond cold starts and unlimited concurrency.

## Runtime Constraints

### Execution Limits
- **CPU Time**: 10ms (free), 30s (paid), unlimited (Enterprise)
- **Memory**: 128 MB per request
- **Subrequests**: 50 outbound fetch() calls per request (free), 1000 (paid)
- **Script Size**: 1 MB compressed, 10 MB uncompressed
- **Environment Variables**: 64 KB total size

### Duration Patterns
```typescript
// Good: Fast edge computation (<10ms)
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const cached = await caches.default.match(request)
    if (cached) return cached

    return new Response('Fast response')
  }
}

// Risky: Heavy computation (may timeout on free tier)
export default {
  async fetch(request: Request): Promise<Response> {
    // Expensive image processing, large JSON parsing
    const data = await fetch('https://api.example.com/large-dataset')
    const json = await data.json() // Could be 100MB+
    // Process json... (CPU-intensive)
    return new Response(JSON.stringify(result))
  }
}
```

## KV Storage Patterns

Cloudflare KV is an eventually consistent key-value store optimized for high-read, low-write scenarios.

### Basic Usage
```typescript
interface Env {
  MY_KV: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Write (takes 60s to propagate globally)
    await env.MY_KV.put('user:123', JSON.stringify({ name: 'Alice' }), {
      expirationTtl: 3600, // 1 hour
      metadata: { createdAt: Date.now() }
    })

    // Read (fast, from nearest edge)
    const value = await env.MY_KV.get('user:123', 'json')

    // List keys (expensive, paginate for many keys)
    const keys = await env.MY_KV.list({ prefix: 'user:', limit: 100 })

    return new Response(JSON.stringify(value))
  }
}
```

### KV Best Practices
```typescript
// ✅ Good: Cache with TTL
await env.CACHE.put('api:response', data, { expirationTtl: 300 })

// ✅ Good: Namespace keys to avoid conflicts
await env.KV.put(`tenant:${tenantId}:config`, config)

// ❌ Bad: Frequent writes (eventual consistency causes issues)
for (let i = 0; i < 100; i++) {
  await env.KV.put(`counter:${i}`, i.toString()) // Takes 60s each!
}

// ✅ Better: Use Durable Objects for frequent writes
const id = env.COUNTER.idFromName('global')
const stub = env.COUNTER.get(id)
await stub.fetch(new Request('https://counter/increment'))
```

## Durable Objects for Stateful Edge

Durable Objects provide strong consistency and persistent state with automatic migration across edge locations.

### Counter Example
```typescript
// durable-objects/counter.ts
export class Counter {
  private state: DurableObjectState
  private count: number = 0
  private initialized = false

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    // Lazy initialization
    if (!this.initialized) {
      this.count = (await this.state.storage.get<number>('count')) || 0
      this.initialized = true
    }

    const url = new URL(request.url)

    if (url.pathname === '/increment') {
      this.count++
      await this.state.storage.put('count', this.count)
    }

    if (url.pathname === '/decrement') {
      this.count--
      await this.state.storage.put('count', this.count)
    }

    return new Response(JSON.stringify({ count: this.count }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### WebSocket Chat Room
```typescript
export class ChatRoom {
  private state: DurableObjectState
  private sessions: Set<WebSocket> = new Set()

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.sessions.add(server)

    server.addEventListener('message', (event) => {
      // Broadcast to all connected clients
      this.sessions.forEach((session) => {
        if (session !== server) {
          session.send(event.data)
        }
      })
    })

    server.addEventListener('close', () => {
      this.sessions.delete(server)
    })

    server.accept()

    return new Response(null, { status: 101, webSocket: client })
  }
}
```

## Wrangler CLI Usage

### Project Initialization
```bash
# Create new Worker project
npm create cloudflare@latest my-worker -- --type=worker

# Or with TypeScript template
npm create cloudflare@latest my-worker -- --type=worker --ts

# Install dependencies
cd my-worker
npm install
```

### Development Workflow
```bash
# Local development (with hot reload)
npx wrangler dev

# Local dev with remote KV/Durable Objects
npx wrangler dev --remote

# Tail live logs from production
npx wrangler tail

# Tail with filters
npx wrangler tail --status error --method POST
```

### Deployment
```bash
# Deploy to production
npx wrangler deploy

# Deploy to preview environment
npx wrangler deploy --env staging

# Rollback to previous version
npx wrangler rollback --message "Reverting bad deploy"
```

### Managing Secrets
```bash
# Set secret (interactive prompt)
npx wrangler secret put API_KEY

# Bulk secrets from .env file
npx wrangler secret bulk .env.production

# Delete secret
npx wrangler secret delete API_KEY
```

### KV and Durable Objects
```bash
# Create KV namespace
npx wrangler kv:namespace create MY_KV

# Put key-value
npx wrangler kv:key put --namespace-id=<id> "myKey" "myValue"

# Get value
npx wrangler kv:key get --namespace-id=<id> "myKey"

# List Durable Object instances
npx wrangler durable-objects list COUNTER
```

## wrangler.toml Configuration

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

# KV Bindings
kv_namespaces = [
  { binding = "MY_KV", id = "abc123", preview_id = "xyz789" }
]

# Durable Objects
durable_objects.bindings = [
  { name = "COUNTER", class_name = "Counter" },
  { name = "CHAT_ROOM", class_name = "ChatRoom" }
]

[[migrations]]
tag = "v1"
new_classes = ["Counter", "ChatRoom"]

# R2 Bindings (object storage)
r2_buckets = [
  { binding = "MY_BUCKET", bucket_name = "my-bucket" }
]

# Environment Variables
[vars]
ENVIRONMENT = "production"

# Staging environment override
[env.staging]
name = "my-worker-staging"
kv_namespaces = [
  { binding = "MY_KV", id = "staging-id" }
]
```

## Performance Tips

### Cold Start Optimization
```typescript
// ✅ Good: Minimal imports, lazy initialization
export default {
  async fetch(request: Request): Promise<Response> {
    const result = await handleRequest(request)
    return new Response(result)
  }
}

// ❌ Bad: Heavy imports at top-level
import heavyLibrary from 'heavy-library' // Adds 500ms cold start
```

### Caching Strategies
```typescript
// Cache expensive computations
const cache = caches.default

async function getExpensiveData(key: string): Promise<any> {
  const cacheKey = new Request(`https://cache/${key}`)
  let response = await cache.match(cacheKey)

  if (!response) {
    const data = await computeExpensiveData(key)
    response = new Response(JSON.stringify(data), {
      headers: {
        'Cache-Control': 'max-age=3600',
        'Content-Type': 'application/json'
      }
    })
    await cache.put(cacheKey, response.clone())
  }

  return response.json()
}
```

## Common Gotchas

1. **KV is eventually consistent**: Writes take ~60s to propagate globally
2. **No persistent state in Workers**: Use Durable Objects for stateful logic
3. **Subrequest limits**: 50 fetch() calls on free tier
4. **No Node.js APIs**: Must use Web APIs only
5. **CPU time includes async waits**: Use streaming to avoid timeouts

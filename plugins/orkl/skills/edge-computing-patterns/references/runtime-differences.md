# Edge Runtime vs Node.js Runtime Differences

## Overview

Edge runtimes use the Web Standard APIs (V8 isolates) instead of Node.js, providing faster cold starts but with limited functionality. This guide helps you write edge-compatible code.

## Runtime API Comparison

### Available in Edge Runtime

#### Fetch & Networking
```typescript
// ✅ Available: Web Fetch API
const response = await fetch('https://api.example.com')
const data = await response.json()

// ✅ Available: Request/Response
const request = new Request('https://example.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
})

// ✅ Available: Headers
const headers = new Headers()
headers.set('X-Custom', 'value')

// ✅ Available: URL & URLSearchParams
const url = new URL('https://example.com/path?query=value')
const params = new URLSearchParams(url.search)
```

#### Text Processing
```typescript
// ✅ Available: TextEncoder/TextDecoder
const encoder = new TextEncoder()
const bytes = encoder.encode('Hello')

const decoder = new TextDecoder()
const text = decoder.decode(bytes)

// ✅ Available: atob/btoa (base64)
const encoded = btoa('Hello World')
const decoded = atob(encoded)
```

#### Cryptography
```typescript
// ✅ Available: Web Crypto API
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
)

const data = new TextEncoder().encode('secret')
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
  key,
  data
)

// ✅ Available: crypto.randomUUID()
const id = crypto.randomUUID()
```

#### Streams
```typescript
// ✅ Available: ReadableStream, WritableStream, TransformStream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('chunk 1')
    controller.enqueue('chunk 2')
    controller.close()
  }
})

const transform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase())
  }
})

const transformed = stream.pipeThrough(transform)
```

#### Timers
```typescript
// ✅ Available: setTimeout, setInterval, clearTimeout, clearInterval
const timer = setTimeout(() => console.log('Delayed'), 1000)
clearTimeout(timer)

// ✅ Available: Promise APIs
await Promise.all([fetch('/a'), fetch('/b')])
await Promise.race([fetch('/a'), fetch('/b')])
```

### NOT Available in Edge Runtime

#### File System
```typescript
// ❌ NOT Available: fs module
import fs from 'fs' // Error!
fs.readFileSync('./file.txt') // Error!

// ✅ Alternative: Fetch from origin or use R2/S3
const file = await fetch('https://cdn.example.com/file.txt')
const content = await file.text()
```

#### Path & OS
```typescript
// ❌ NOT Available: path module
import path from 'path' // Error!
path.join('/foo', 'bar') // Error!

// ✅ Alternative: Manual string manipulation or URL
const joined = '/foo/bar'
const url = new URL('/foo/bar', 'https://example.com')
```

#### Process & Environment
```typescript
// ❌ NOT Available: process.cwd(), process.env (limited)
process.cwd() // Error!

// ✅ Available: env vars via platform-specific binding
// Cloudflare Workers
export default {
  async fetch(request: Request, env: Env) {
    const apiKey = env.API_KEY // From wrangler.toml
  }
}

// Vercel Edge
export const runtime = 'edge'
export async function GET() {
  const apiKey = process.env.API_KEY // From Vercel env vars
}
```

#### Child Processes
```typescript
// ❌ NOT Available: child_process
import { exec } from 'child_process' // Error!
exec('ls -la') // Error!

// ✅ Alternative: Call external API for heavy compute
const result = await fetch('https://compute-api.example.com/process')
```

#### Node.js Crypto
```typescript
// ❌ NOT Available: Node.js crypto module
import crypto from 'crypto' // Error!
crypto.createHash('sha256') // Error!

// ✅ Alternative: Web Crypto API
const data = new TextEncoder().encode('data')
const hashBuffer = await crypto.subtle.digest('SHA-256', data)
const hashArray = Array.from(new Uint8Array(hashBuffer))
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
```

#### Buffers
```typescript
// ❌ NOT Available: Node.js Buffer
const buf = Buffer.from('hello') // Error!

// ✅ Alternative: Uint8Array
const arr = new TextEncoder().encode('hello')
const decoded = new TextDecoder().decode(arr)
```

## Polyfills and Alternatives

### Base64 Encoding/Decoding
```typescript
// Node.js way (NOT available)
// const encoded = Buffer.from('hello').toString('base64')

// Edge-compatible way
function base64Encode(str: string): string {
  return btoa(str)
}

function base64Decode(str: string): string {
  return atob(str)
}

// For binary data
function base64EncodeBytes(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join('')
  return btoa(binString)
}

function base64DecodeBytes(str: string): Uint8Array {
  const binString = atob(str)
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!)
}
```

### SHA-256 Hashing
```typescript
// Node.js way (NOT available)
// const hash = crypto.createHash('sha256').update('data').digest('hex')

// Edge-compatible way
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Usage
const hash = await sha256('hello world')
```

### HMAC Signing
```typescript
// Node.js way (NOT available)
// const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex')

// Edge-compatible way
async function hmacSign(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  )

  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Usage
const signature = await hmacSign('secret-key', 'message')
```

### JWT Verification
```typescript
// Node.js way (jsonwebtoken package - NOT compatible)
// import jwt from 'jsonwebtoken'

// Edge-compatible way (use @tsndr/cloudflare-worker-jwt)
import { verify } from '@tsndr/cloudflare-worker-jwt'

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const isValid = await verify(token, secret)
    return isValid
  } catch (error) {
    return false
  }
}
```

### Random Number Generation
```typescript
// Node.js way (NOT available)
// const random = crypto.randomBytes(16)

// Edge-compatible way
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function getRandomInt(min: number, max: number): number {
  const range = max - min
  const bytes = crypto.getRandomValues(new Uint32Array(1))
  return min + (bytes[0] % range)
}

// UUID generation (built-in!)
const uuid = crypto.randomUUID()
```

## Cold Start Optimization

### Import Strategies
```typescript
// ❌ Bad: Large top-level imports (increases cold start)
import { heavy, unused, functions } from 'large-library'

export default {
  async fetch() {
    return new Response(heavy())
  }
}

// ✅ Good: Dynamic imports (faster cold start)
export default {
  async fetch() {
    const { heavy } = await import('large-library')
    return new Response(heavy())
  }
}

// ✅ Better: Import only what's needed
import { specificFunction } from 'large-library/specific'
```

### Lazy Initialization
```typescript
// ❌ Bad: Initialize at top-level
const expensiveComputation = computeExpensiveValue() // Runs on every cold start!

export default {
  async fetch() {
    return new Response(expensiveComputation)
  }
}

// ✅ Good: Lazy initialization
let cachedValue: string | null = null

export default {
  async fetch() {
    if (!cachedValue) {
      cachedValue = computeExpensiveValue()
    }
    return new Response(cachedValue)
  }
}
```

### Bundle Size Optimization
```typescript
// ❌ Bad: Import entire library
import _ from 'lodash' // 70KB!

// ✅ Good: Import specific function
import debounce from 'lodash.debounce' // 2KB

// ✅ Better: Use native alternatives
const unique = [...new Set(array)]
const mapped = array.map(x => x * 2)
```

## Testing Edge-Compatible Code

### Local Testing
```bash
# Cloudflare Workers
npx wrangler dev

# Vercel Edge (Next.js)
npm run dev

# Deno Deploy
deno run --allow-net --allow-env main.ts
```

### Unit Testing with Miniflare (Cloudflare)
```typescript
import { Miniflare } from 'miniflare'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Worker', () => {
  let mf: Miniflare

  beforeAll(() => {
    mf = new Miniflare({
      script: `
        export default {
          async fetch(request) {
            return new Response('Hello!')
          }
        }
      `
    })
  })

  afterAll(() => mf.dispose())

  it('returns response', async () => {
    const response = await mf.dispatchFetch('https://example.com')
    expect(await response.text()).toBe('Hello!')
  })
})
```

## Package Compatibility

### Edge-Compatible Packages
- ✅ `@tsndr/cloudflare-worker-jwt` - JWT for edge
- ✅ `zod` - Schema validation
- ✅ `date-fns` - Date utilities (tree-shakeable)
- ✅ `nanoid` - ID generation
- ✅ `hono` - Lightweight router
- ✅ `@vercel/edge-config` - Feature flags

### NOT Edge-Compatible (Common Mistakes)
- ❌ `jsonwebtoken` - Uses Node.js crypto
- ❌ `bcrypt` - Native bindings
- ❌ `sharp` - Image processing (use Cloudflare Images API)
- ❌ `prisma` - Database ORM (use `@prisma/client/edge` with Data Proxy)
- ❌ `axios` - Use native `fetch` instead
- ❌ `moment` - Large bundle, use `date-fns` or native `Intl`

## Common Gotchas

1. **No `__dirname` or `__filename`**: Use `import.meta.url` instead (Deno/modern runtimes)
2. **Limited `process.env`**: Use platform-specific env bindings
3. **No synchronous file I/O**: Everything must be async
4. **No `Buffer`**: Use `Uint8Array` and `TextEncoder/TextDecoder`
5. **Strict Content Security Policy**: Some eval-based libraries won't work

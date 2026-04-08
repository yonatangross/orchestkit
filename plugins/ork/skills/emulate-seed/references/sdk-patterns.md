# SDK Patterns

Programmatic usage of emulate via the `createEmulate()` API (v0.3.0+, `@emulators/*` scope).

## Basic Usage

```typescript
import { createEmulate } from '@emulators/emulate'

const github = await createEmulate({
  service: 'github',
  port: 4001,
  seed: './emulate.config.yaml'  // Optional seed file
})

console.log(github.url) // 'http://localhost:4001'

// Use the emulated API
const res = await fetch(`${github.url}/repos/org/repo`)
const repo = await res.json()

// Cleanup
github.reset()       // Synchronous — wipes all state, keeps server running
await github.close() // Async — shuts down server and frees port
```

## Multi-Service Setup

```typescript
import { createEmulate } from '@emulators/emulate'

const [github, vercel] = await Promise.all([
  createEmulate({ service: 'github', port: 4001, seed: './config.yaml' }),
  createEmulate({ service: 'vercel', port: 4000, seed: './config.yaml' }),
])

// Both share the same seed config — tokens, users, projects
const ghRes = await fetch(`${github.url}/repos/org/repo`)
const vcRes = await fetch(`${vercel.url}/v9/projects`)

// Cleanup both
await Promise.all([github.close(), vercel.close()])
```

## Test Framework Integration

### Vitest

```typescript
// vitest.setup.ts
import { createEmulate, type Emulator } from '@emulators/emulate'

let github: Emulator

beforeAll(async () => {
  const workerPort = 4001 + parseInt(process.env.VITEST_WORKER_ID || '0')
  github = await createEmulate({
    service: 'github',
    port: workerPort,
    seed: '.emulate/test.yaml'
  })
  process.env.GITHUB_API_BASE = github.url
})

afterAll(async () => {
  await github.close()
})

beforeEach(() => {
  github.reset() // Fresh state per test
})
```

### Jest

```typescript
// jest.setup.ts
import { createEmulate, type Emulator } from '@emulators/emulate'

let github: Emulator

beforeAll(async () => {
  const workerPort = 4001 + parseInt(process.env.JEST_WORKER_ID || '0')
  github = await createEmulate({
    service: 'github',
    port: workerPort,
    seed: '.emulate/test.yaml'
  })
  process.env.GITHUB_API_BASE = github.url
})

afterAll(async () => {
  await github.close()
})

beforeEach(() => {
  github.reset()
})
```

## Emulator API

### `createEmulate(options)`

Creates and starts an emulator instance.

```typescript
interface EmulatorOptions {
  service: 'github' | 'vercel' | 'google'
  port?: number      // Default: 4001 (github), 4000 (vercel), 4002 (google)
  seed?: string      // Path to YAML seed config
}

const emulator: Emulator = await createEmulate(options)
```

### `emulator.url`

The base URL of the running emulator.

```typescript
github.url // 'http://localhost:4001'
```

### `emulator.reset()`

Synchronously wipes all state and re-applies the seed config. The server stays running — useful for resetting between tests without the overhead of restarting.

```typescript
github.reset() // Instant — no await needed
```

### `emulator.close()`

Asynchronously shuts down the server and frees the port. Call in `afterAll`.

```typescript
await github.close()
```

## URL Patterns

When using emulate with existing SDKs, set the base URL:

### Octokit

```typescript
import { Octokit } from '@octokit/rest'

const octokit = new Octokit({
  baseUrl: process.env.GITHUB_API_BASE || 'https://api.github.com',
  auth: 'dev_token'  // Seeded token name
})

const { data: repos } = await octokit.repos.listForOrg({ org: 'my-org' })
```

### Vercel SDK

```typescript
import { Vercel } from '@vercel/sdk'

const vercel = new Vercel({
  baseUrl: process.env.VERCEL_API_BASE || 'https://api.vercel.com',
  bearerToken: 'dev_token'
})
```

### fetch

```typescript
const base = process.env.GITHUB_API_BASE || 'https://api.github.com'

const res = await fetch(`${base}/repos/org/repo/pulls`, {
  headers: { Authorization: 'Bearer dev_token' }
})
```

## State Lifecycle

```
createEmulate() -> seed applied -> tests run -> reset() -> tests run -> close()
                     ^                            ^
                     |                            |
                     Initial state                State wiped, seed re-applied
```

- `createEmulate()` — Starts server, applies seed config
- Tests run — State accumulates (created PRs, issues, etc.)
- `reset()` — Wipes state, re-applies seed — server stays up
- `close()` — Shuts down server, frees port

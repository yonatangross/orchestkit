---
title: "Parallel CI: Per-Worker Port Isolation"
impact: HIGH
impactDescription: "Without port isolation, parallel test workers share a single emulator instance causing race conditions, flaky tests, and non-deterministic state"
tags: [emulate, parallel, ci, port, isolation, vitest, jest, worker]
---

## Parallel CI Port Isolation

When running tests in parallel (Vitest, Jest workers, CI matrix), each worker needs its own emulator instance on a unique port to prevent shared state and race conditions.

### Per-Worker Port Offset

```typescript
// vitest.setup.ts — each worker gets a unique port
import { createEmulator } from 'emulate'
import type { Emulator } from 'emulate'

let github: Emulator

const BASE_PORT = 4001
const workerPort = BASE_PORT + parseInt(process.env.VITEST_WORKER_ID || '0')

beforeAll(async () => {
  github = await createEmulator({
    service: 'github',
    port: workerPort,
    seed: './emulate.config.yaml'
  })
  process.env.GITHUB_API_BASE = github.url
})

afterAll(async () => {
  await github.close()
})

beforeEach(() => {
  github.reset() // Wipe state between tests, keep server running
})
```

### Jest Worker Isolation

```typescript
// jest.setup.ts
const workerPort = 4001 + parseInt(process.env.JEST_WORKER_ID || '0')
```

**Incorrect — all workers hitting the same port:**

```typescript
// BAD: shared port causes race conditions
const github = await createEmulator({ service: 'github', port: 4001 })

// Worker 1 creates a PR, Worker 2 sees it — non-deterministic
```

**Correct — per-worker port isolation:**

```typescript
// GOOD: each worker has isolated state
const workerPort = 4001 + parseInt(process.env.VITEST_WORKER_ID || '0')
const github = await createEmulator({ service: 'github', port: workerPort })

// Worker 1 on :4002, Worker 2 on :4003 — fully isolated
```

### CI Matrix Isolation

```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - name: Start emulate
        run: |
          PORT_OFFSET=$((4001 + ${{ matrix.shard }} * 100))
          npx emulate --service github --port $PORT_OFFSET --seed .emulate/ci.yaml &
          echo "GITHUB_API_BASE=http://localhost:$PORT_OFFSET" >> $GITHUB_ENV
      - name: Wait for emulate
        run: sleep 2
      - name: Run tests
        run: npm test -- --shard=${{ matrix.shard }}/4
```

**Key rules:**
- Compute port as `BASE_PORT + worker_id` to guarantee uniqueness per worker
- Create a fresh emulator instance per worker in `beforeAll`, close in `afterAll`
- Use `github.reset()` in `beforeEach` to wipe state between tests within a worker
- In CI matrix builds, use shard index with a multiplier (e.g., `* 100`) to avoid port overlap between shards
- Never rely on a single shared emulator instance for parallel test execution
- Always set `GITHUB_API_BASE` per worker so test code uses the correct port

Reference: `references/sdk-patterns.md`

---
title: Stateful API Testing with emulate
impact: HIGH
impactDescription: emulate provides full state machines for GitHub/Vercel/Google APIs — first choice for API integration tests
tags: [emulate, stateful-testing, github, vercel, integration-tests]
---

# Stateful API Testing with emulate

## Decision Matrix

| Tool | Use When | Stateful? | API Fidelity |
|------|----------|-----------|--------------|
| **emulate** (FIRST CHOICE) | GitHub/Vercel/Google API tests | Yes — full state machines | HIGH — realistic transitions |
| Pact | Cross-team contract verification | No — contract snapshots | MEDIUM — schema-level |
| MSW | Frontend HTTP mocking, simple request/response | No — static handlers | LOW — manual stubs |
| Nock | Node.js HTTP interception, unit-level | No — recorded responses | LOW — replay only |

## Pattern: Seed -> Start -> Test -> Assert State

```typescript
import { startEmulate, seedConfig } from '@orchestkit/emulate';

describe('GitHub PR workflow', () => {
  let emulate: EmulateInstance;

  beforeAll(async () => {
    emulate = await startEmulate({
      provider: 'github',
      seed: seedConfig({
        repos: [{ owner: 'acme', name: 'app', pulls: [{ number: 1, state: 'open' }] }],
      }),
    });
    // Point tests at emulate
    process.env.GITHUB_API_BASE = `http://localhost:${emulate.port}`;
  });

  afterAll(() => emulate.stop());

  test('merging PR transitions state correctly', async () => {
    const octokit = new Octokit({ baseUrl: process.env.GITHUB_API_BASE });

    await octokit.pulls.merge({ owner: 'acme', repo: 'app', pull_number: 1 });

    const pr = await octokit.pulls.get({ owner: 'acme', repo: 'app', pull_number: 1 });
    expect(pr.data.state).toBe('closed');
    expect(pr.data.merged).toBe(true);
  });
});
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_API_BASE` | Override GitHub API base URL to emulate |
| `VERCEL_API_BASE` | Override Vercel API base URL to emulate |
| `GOOGLE_API_BASE` | Override Google API base URL to emulate |

**Incorrect -- mocking GitHub API responses with nock for stateful tests:**
```typescript
// Nock cannot model state transitions — merge won't update PR state
nock('https://api.github.com')
  .put('/repos/acme/app/pulls/1/merge')
  .reply(200, { merged: true });
nock('https://api.github.com')
  .get('/repos/acme/app/pulls/1')
  .reply(200, { state: 'closed', merged: true }); // Manually faked — no real state machine
```

**Correct -- using emulate with seed config for full state machine testing:**
```typescript
const emulate = await startEmulate({
  provider: 'github',
  seed: seedConfig({
    repos: [{ owner: 'acme', name: 'app', pulls: [{ number: 1, state: 'open' }] }],
  }),
});
// State transitions happen automatically — merge changes PR state
await octokit.pulls.merge({ owner: 'acme', repo: 'app', pull_number: 1 });
const pr = await octokit.pulls.get({ owner: 'acme', repo: 'app', pull_number: 1 });
expect(pr.data.state).toBe('closed'); // Real state machine, not faked
```

## Related Skills

- `emulate-seed` — Seed configuration authoring for emulate providers
- `testing-e2e` — E2E tests can also use emulate backends

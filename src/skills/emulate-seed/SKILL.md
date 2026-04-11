---
name: emulate-seed
description: "Generate emulate seed configs for stateful API emulation. Wraps Vercel's emulate tool for GitHub, Vercel, Google OAuth, Slack, Apple Auth, Microsoft Entra, and AWS (S3/SQS/IAM) APIs. Not mocks — full state machines where create-a-PR-and-it-appears-in-the-list. Use when setting up test environments, CI pipelines, integration tests, or offline development."
tags: [emulate, testing, api-emulation, github, vercel, google, seed, ci, stateful-testing]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: guidance
metadata:
  category: testing
  upstream-package: emulate
  upstream-version-tested: "0.3.0"
---

# Emulate Seed Configs

Generate and manage seed configs for [emulate](https://github.com/vercel-labs/emulate) (Apache-2.0) — Vercel Labs' stateful API emulation tool. Each category has individual rule files in `rules/` loaded on-demand.

**Not mocks.** Emulate provides full state machines with cascading deletes, cursor pagination, webhook delivery, and HMAC signature verification. Create a PR via the API and it appears in `GET /repos/:owner/:repo/pulls`. Delete a repo and its issues, PRs, and webhooks cascade-delete.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Seed Config](#seed-config) | 1 | HIGH | Setting up emulate.config.yaml for test environments |
| [Service Selection](#service-selection) | 1 | MEDIUM | Choosing GitHub/Vercel/Google for your tests |
| [Webhook Setup](#webhook-setup) | 1 | MEDIUM | Testing webhook delivery with HMAC verification |
| [Parallel CI](#parallel-ci) | 1 | HIGH | Running tests in parallel without port collisions |
| [Auth Tokens](#auth-tokens) | 1 | MEDIUM | Seeding tokens mapped to emulated users |

**Total: 5 rules across 5 categories**

## Quick Start

```bash
# Install (v0.3.0+: packages moved to @emulators/* scope)
npm install --save-dev emulate

# Start all services
npx emulate

# Start specific services with seed data
npx emulate --service github,slack --seed ./emulate.config.yaml

# Generate a starter config
npx emulate init --service github
```

## Services

| Service | Default Port | Coverage |
|---------|-------------|----------|
| **GitHub** | `:4001` | Repos, PRs, issues, comments, reviews, Actions, webhooks, orgs, teams |
| **Vercel** | `:4000` | Projects, deployments, domains, env vars, teams |
| **Google OAuth** | `:4002` | OAuth 2.0 authorize, token exchange, userinfo |
| **Slack** | `:4003` | Chat, conversations, users, reactions, OAuth v2 with consent UI |
| **Apple Auth** | `:4004` | Sign in with Apple — OIDC discovery, JWKS (RS256), auth flow, token exchange |
| **Microsoft Entra** | `:4005` | OAuth 2.0/OIDC v2.0, authorization code + PKCE, refresh token rotation |
| **AWS** | `:4006` | S3 buckets, SQS queues, IAM users/roles, STS identity |

See `references/api-coverage.md` for full endpoint lists.

## Seed Config Structure

A seed config pre-populates the emulator with tokens, users, repos, and projects so tests start from a known state.

```yaml
# emulate.config.yaml
tokens:
  dev_token:
    login: yonatangross
    scopes: [repo, workflow, admin:org]
  ci_token:
    login: ci-bot
    scopes: [repo]

github:
  users:
    - login: yonatangross
      name: Yonatan Gross
    - login: ci-bot
      name: CI Bot
  repos:
    - owner: yonatangross
      name: my-project
      private: false
      default_branch: main
      topics: [typescript, testing]

vercel:
  users:
    - username: yonatangross
      email: yonaigross@gmail.com
  projects:
    - name: my-docs
      framework: next
```

See `rules/seed-config.md` for full schema and best practices.

## Programmatic SDK

> **v0.3.0 scope change**: Packages moved to `@emulators/*` scope (e.g., `@emulators/emulate`). The bare `emulate` import still works as a re-export but is deprecated.

```typescript
import { createEmulate } from '@emulators/emulate'

const github = await createEmulate({ service: 'github', port: 4001 })
// github.url -> 'http://localhost:4001'

// State is real — create a PR and it appears in the list
const res = await fetch(`${github.url}/repos/org/repo/pulls`, {
  method: 'POST',
  headers: { Authorization: 'Bearer dev_token' },
  body: JSON.stringify({ title: 'Test PR', head: 'feature', base: 'main' })
})

const prs = await fetch(`${github.url}/repos/org/repo/pulls`)
// -> includes the PR we just created

// Cleanup
github.reset()       // Synchronous state wipe
await github.close() // Shut down server
```

See `references/sdk-patterns.md` for advanced patterns (multi-service, lifecycle hooks).

## Webhook Delivery

Emulate delivers real webhooks with HMAC-SHA256 signatures when state changes:

```typescript
import crypto from 'crypto'

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

See `rules/webhook-setup.md` for webhook receiver patterns.

## CI Integration

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - name: Start emulate
        run: npx emulate --service github --seed .emulate/ci.yaml &
      - name: Wait for emulate
        run: sleep 2
      - name: Run tests
        run: npm test
        env:
          GITHUB_API_BASE: http://localhost:4001
          VERCEL_API_BASE: http://localhost:4000
```

### Parallel Test Execution

Each test worker gets its own port to avoid race conditions:

```typescript
// vitest.config.ts
const workerPort = 4001 + parseInt(process.env.VITEST_WORKER_ID || '0')
```

See `rules/parallel-ci.md` for full parallel isolation patterns.

## Decision Matrix

| Tool | When to Use | Stateful? | Platforms |
|------|------------|-----------|-----------|
| **emulate** (FIRST CHOICE) | GitHub/Vercel/Google API testing | YES | GitHub, Vercel, Google |
| Pact | Contract verification between services | No | Any |
| MSW | In-browser/Node HTTP mocking | No | Any |
| Nock | Node.js HTTP intercept | No | Any |
| WireMock | HTTP stub server | Partial | Any |

**Use emulate when:**
- Testing code that calls GitHub, Vercel, or Google APIs
- You need state persistence across multiple API calls in a test
- You want webhook delivery with real HMAC signatures
- You need cascading side-effects (delete repo -> PRs cascade-delete)

**Use MSW/Nock when:**
- Mocking arbitrary HTTP APIs not covered by emulate
- You need in-browser interception (MSW)
- Tests only need single request/response pairs

## Related Skills

- `testing-integration` — Integration test patterns (emulate as first choice for API tests)
- `testing-e2e` — End-to-end test patterns with emulated backends
- `testing-unit` — Unit test patterns (use emulate for API-dependent units)
- `security-patterns` — Auth token patterns (emulate token seeding)

## CLI Reference

See `references/cli-reference.md` for all CLI flags and commands.

## SDK Patterns

See `references/sdk-patterns.md` for programmatic `createEmulate()` usage.

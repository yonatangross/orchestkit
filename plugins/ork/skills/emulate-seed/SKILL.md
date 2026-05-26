---
name: emulate-seed
compatibility: "Claude Code 2.1.148+"
description: "Generate emulate seed configs for stateful API emulation. Wraps Vercel's emulate tool for GitHub, Vercel, Google OAuth, Slack, Apple Auth, Microsoft Entra, AWS (S3/SQS/IAM), Okta, Clerk, Resend, Stripe, and MongoDB Atlas APIs. Not mocks — full state machines where create-a-PR-and-it-appears-in-the-list, send-an-email-and-retrieve-from-local-inbox. Use when setting up test environments, CI pipelines, integration tests, or offline development."
tags: [emulate, testing, api-emulation, github, vercel, google, stripe, resend, okta, clerk, mongodb, seed, ci, stateful-testing]
version: 1.3.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: guidance
agent: emulate-engineer
metadata:
  category: testing
  upstream-package: emulate
  upstream-version-tested: "0.6.0"
---

# Emulate Seed Configs

Generate and manage seed configs for [emulate](https://github.com/vercel-labs/emulate) (Apache-2.0) — Vercel Labs' stateful API emulation tool. Each category has individual rule files in `rules/` loaded on-demand.

> **Paired agent:** This skill pairs with the [`emulate-engineer`](../../agents/emulate-engineer.md) subagent (`subagent_type: "emulate-engineer"`). When a task involves generating a full emulate config from scratch, webhook HMAC setup, CI pipeline integration, or parallel-worker port isolation, spawn the agent rather than handling it inline — it has the full 12-emulator service-port matrix and seed-rules in context.

**Not mocks.** Emulate provides full state machines with cascading deletes, cursor pagination, webhook delivery, and HMAC signature verification. Create a PR via the API and it appears in `GET /repos/:owner/:repo/pulls`. Delete a repo and its issues, PRs, and webhooks cascade-delete.

## New in 2026-04 (emulate 0.4.x)

- **Modular `@emulators/*` packages** — each service is its own package (`@emulators/github`, `@emulators/stripe`, etc.); top-level `emulate` re-exports `createEmulator` and the CLI.
- **4 new services** (12 total): `mongoatlas:4007`, `okta:4008`, `resend:4009`, `stripe:4010` with drop-in seed YAML blocks.
- **Resend local inbox** — `GET http://localhost:4009/inbox` returns captured emails for assertions without hitting a real provider.
- **Stripe hosted checkout** — real session redirect flow + `checkout.session.completed`/`expired` webhook delivery, suitable for E2E payment tests.
- **MongoDB Atlas** — Admin API v2 (projects/clusters/DB users) + Data API v1 with full CRUD + aggregate.
- **Okta OIDC** — full discovery, JWKS, `authorize/token/userinfo/revoke/introspect` plus Users/Groups/Apps CRUD.
- **Entra / Apple / Slack expansions (v0.4.0)** — PKCE + refresh rotation (Entra), RS256 JWKS (Apple), OAuth v2 consent UI (Slack).
- **`@emulators/adapter-next`** — catch-all Next.js route handler runs emulators on the same origin as the app; fixes OAuth callback URL drift on Vercel preview deploys.

## Auto-Discovery (M125 #4)

`scripts/auto-discover.sh` scans the project's `package.json`, matches deps against `references/dep-to-emulator-map.json`, and either reports the matches or writes `emulate.config.yaml`. Three modes:

| Mode | Behavior |
|---|---|
| (default) | Report matched deps + emulator union on stderr; do not write |
| `--json` | Emit machine-readable JSON instead of human report |
| `--apply` | Write `emulate.config.yaml` (refuses to overwrite without `--force`) |

```bash
$ bash scripts/auto-discover.sh
/ork:emulate-seed --auto — scanning /path/to/package.json

Detected:
  @octokit/rest  →  github · Any GitHub API client
  next-auth  →  google-oauth, apple-auth, microsoft-entra · Default OAuth providers
  stripe  →  stripe
  @vercel/blob  →  aws · @vercel/blob is S3-compatible

Union: apple-auth, aws, github, google-oauth, microsoft-entra, stripe

$ bash scripts/auto-discover.sh --apply
…
✓ Wrote /path/to/emulate.config.yaml with 6 service(s)
```

Multi-emulator deps default to all reasonable providers; the user prunes the YAML afterwards. Unmapped deps are silently skipped — extending coverage is a docs PR (edit `references/dep-to-emulator-map.json`), not a code change.

`/ork:dev` reads the resulting `emulate.config.yaml` at boot — see `src/skills/dev/scripts/boot.sh`.

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
# Install (packages published under @emulators/* scope)
npm install --save-dev emulate

# Start all services
npx emulate

# Start specific services with seed data
npx emulate --service github,stripe --seed ./emulate.config.yaml

# Generate a starter config
npx emulate init --service github
```

## Services (0.5.0 — 13 emulators)

> **New in 0.5.0 (Apr 2026):** Clerk emulator (auth/sessions), portless integration (embedded emulators without dedicated ports), Google OAuth `hd` claim support, Stripe Checkout + Resend magic link examples, AWS S3 emulator now matches the official SDK wire format. Backwards-compatible.

| Service | Default Port | Coverage |
|---------|-------------|----------|
| **Vercel** | `:4000` | Projects, deployments, domains, env vars, teams |
| **GitHub** | `:4001` | Repos, PRs, issues, comments, reviews, Actions, webhooks, orgs, teams |
| **Google OAuth** | `:4002` | OAuth 2.0 authorize, token exchange, userinfo |
| **Slack** | `:4003` | Chat, conversations, users, reactions, OAuth v2 with consent UI |
| **Apple Auth** | `:4004` | Sign in with Apple — OIDC discovery, JWKS (RS256), auth flow, token exchange |
| **Microsoft Entra** | `:4005` | OAuth 2.0/OIDC v2.0, authorization code + PKCE, refresh token rotation, v1 token endpoint, Graph `/users/{id}` |
| **AWS** | `:4006` | S3 buckets, SQS queues, IAM users/roles, STS identity |
| **MongoDB Atlas** *(0.4+)* | `:4007` | Admin API v2 (projects, clusters, DB users) + Data API v1 (full CRUD + aggregate) |
| **Okta** *(0.4+)* | `:4008` | OIDC discovery, JWKS, authorize/token/userinfo/revoke/introspect, Users/Groups/Apps CRUD |
| **Resend** *(0.4+)* | `:4009` | Send + batch (100/req), list/retrieve/cancel, domains, API keys, audiences, contacts, **local inbox** (`GET /inbox`) |
| **Stripe** *(0.4+)* | `:4010` | Customers, payment methods, customer sessions, payment intents, charges, products, prices, **hosted checkout session** w/ webhook delivery |
| **Clerk** | (on-demand) | Users, sessions, organizations |

See `references/api-coverage.md` for full endpoint lists.

### Next.js Adapter (0.4+) — `@emulators/adapter-next`

Runs emulators **on the same origin** as your Next.js app via a catch-all route handler. Fixes the OAuth callback URL drift problem on Vercel preview deploys — no more `http://localhost:4001` redirect mismatches.

```typescript
// next.config.js
const { withEmulate } = require('@emulators/adapter-next')
module.exports = withEmulate({ /* your next config */ })

// app/api/[...emulate]/route.ts
import { createEmulateHandler } from '@emulators/adapter-next'
export const { GET, POST } = createEmulateHandler({
  services: ['github', 'stripe', 'resend'],
  persistence: { /* load(), save() or built-in filePersistence */ },
})
```

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

# NEW in 0.4.x — drop-in seed blocks
okta:
  users:
    - login: alice@example.com
      firstName: Alice
      lastName: Smith
  groups: [{ name: Everyone }, { name: Admins }]
  apps: [{ name: My Web App }]
  authorization_servers:
    - name: default
      audiences: ["api://default"]

resend:
  domains: [{ name: example.com }]
  api_keys: [{ name: default }]
  # In tests: GET http://localhost:4009/inbox to assert captured emails

stripe:
  customers:
    - name: Test Customer
      email: customer@example.com
  products: [{ name: Pro Plan }, { name: Starter Plan }]
  prices:
    - { product: Pro Plan, unit_amount: 4900, currency: usd, recurring: { interval: month } }
    - { product: Starter Plan, unit_amount: 1900, currency: usd, recurring: { interval: month } }
  # Webhook delivery fires on checkout.session.completed / expired

mongoatlas:
  projects: [{ name: my-project }]
  clusters: [{ project: my-project, name: my-cluster }]
  database_users: [{ project: my-project, username: app-user }]
```

See `rules/seed-config.md` for full schema and best practices.

## Programmatic SDK

> Service packages live under the `@emulators/*` scope (e.g., `@emulators/github`, `@emulators/stripe`). The programmatic API (`createEmulator`) is exported from the top-level `emulate` package.

```typescript
import { createEmulator } from 'emulate'

const github = await createEmulator({ service: 'github', port: 4001 })
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
| **emulate** (FIRST CHOICE) | GitHub/Vercel/Google/Slack/Apple/Entra/AWS/Okta/Resend/Stripe/MongoDB testing | YES | All 12 services |
| Pact | Contract verification between services | No | Any |
| MSW | In-browser/Node HTTP mocking | No | Any |
| Nock | Node.js HTTP intercept | No | Any |
| WireMock | HTTP stub server | Partial | Any |

**Use emulate when:**
- Testing code that calls GitHub, Vercel, Google, Slack, Apple, Entra, AWS, Okta, Resend, Stripe, or MongoDB Atlas
- You need state persistence across multiple API calls in a test
- You want webhook delivery with real HMAC signatures (GitHub, Stripe)
- You need cascading side-effects (delete repo -> PRs cascade-delete)
- You need to assert on sent emails without hitting a real provider (Resend local `/inbox`)
- You need hosted Stripe checkout sessions with real redirect flow in tests

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

---
title: "Service Selection: GitHub, Vercel, and Google"
impact: MEDIUM
impactDescription: "Choosing the wrong tool wastes time writing manual mocks when emulate already provides full stateful coverage for GitHub, Vercel, and Google APIs"
tags: [emulate, github, vercel, google, service, selection]
---

## Service Selection

Choose the right emulate service based on which APIs your code interacts with. Use emulate as the first choice whenever the target API is covered.

### Service Defaults

| Service | Flag | Port | Use When |
|---------|------|------|----------|
| GitHub | `--service github` | `:4001` | Repos, PRs, issues, reviews, Actions, webhooks, orgs |
| Vercel | `--service vercel` | `:4000` | Projects, deployments, domains, env vars, teams |
| Google OAuth | `--service google` | `:4002` | OAuth 2.0 flows, token exchange, userinfo |

### Multi-Service

```bash
# Start GitHub + Vercel together
npx emulate --service github,vercel --seed ./emulate.config.yaml

# Custom ports
npx emulate --service github --port 5001
```

**Incorrect — writing manual GitHub API mocks when emulate covers it:**

```typescript
// BAD: hand-rolled mock that doesn't maintain state
const mockListPRs = jest.fn().mockResolvedValue([])
const mockCreatePR = jest.fn().mockResolvedValue({ number: 1 })
// After createPR, listPRs still returns [] — not stateful
```

**Correct — use emulate for stateful GitHub API testing:**

```typescript
import { createEmulate } from '@emulators/emulate'

const github = await createEmulate({ service: 'github', port: 4001 })

// Create PR via API
await fetch(`${github.url}/repos/org/repo/pulls`, {
  method: 'POST',
  headers: { Authorization: 'Bearer dev_token' },
  body: JSON.stringify({ title: 'Fix bug', head: 'fix', base: 'main' })
})

// PR now appears in list — state is real
const prs = await (await fetch(`${github.url}/repos/org/repo/pulls`)).json()
expect(prs).toHaveLength(1)
expect(prs[0].title).toBe('Fix bug')

await github.close()
```

**Key rules:**
- Use `emulate --service github` whenever testing GitHub API interactions — it covers repos, PRs, issues, comments, reviews, Actions, webhooks, orgs, and teams
- Use `emulate --service vercel` for Vercel platform API testing — projects, deployments, domains, env vars
- Use `emulate --service google` for Google OAuth flows — authorize, token exchange, userinfo
- Combine services with comma separation: `--service github,vercel`
- Fall back to MSW/Nock only for APIs emulate does not cover
- Custom ports via `--port` when defaults conflict with existing services

Reference: `references/api-coverage.md`

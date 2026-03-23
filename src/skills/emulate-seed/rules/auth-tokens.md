---
title: "Auth Tokens: Token Seeding and Credential Hygiene"
impact: MEDIUM
impactDescription: "Using real tokens in tests risks credential leakage and couples tests to external state; seeded tokens provide deterministic, safe authentication"
tags: [emulate, auth, tokens, seed, credentials, testing]
---

## Auth Token Seeding

Emulate maps token strings to emulated users with configurable scopes. Tests use these seeded token names as Bearer tokens — no real credentials involved.

### Token Configuration

```yaml
# emulate.config.yaml
tokens:
  admin_token:
    login: admin-user
    scopes: [repo, admin:org, workflow, delete_repo]
  dev_token:
    login: dev-user
    scopes: [repo, workflow]
  readonly_token:
    login: viewer
    scopes: [repo:read]
  ci_token:
    login: ci-bot
    scopes: [repo, actions]
```

### Using Seeded Tokens

```typescript
// The token name IS the Bearer value
const adminRes = await fetch(`${GITHUB_API_BASE}/orgs/my-org/repos`, {
  method: 'POST',
  headers: { Authorization: 'Bearer admin_token' },
  body: JSON.stringify({ name: 'new-repo' })
})
// -> 201 Created (admin_token has admin:org scope)

const readonlyRes = await fetch(`${GITHUB_API_BASE}/orgs/my-org/repos`, {
  method: 'POST',
  headers: { Authorization: 'Bearer readonly_token' },
  body: JSON.stringify({ name: 'new-repo' })
})
// -> 403 Forbidden (readonly_token lacks admin:org scope)
```

**Incorrect — using real tokens in test configs:**

```yaml
# BAD: real GitHub PAT in test config — leaks if committed
tokens:
  my_token:
    login: yonatangross
    value: ghp_abc123realtoken456  # NEVER put real tokens here
```

```typescript
// BAD: hardcoded real token in test file
headers: { Authorization: 'Bearer ghp_abc123realtoken456' }
```

**Correct — descriptive seeded token names:**

```yaml
# GOOD: token name is the bearer value, no real credentials
tokens:
  test_admin:
    login: admin-user
    scopes: [repo, admin:org]
```

```typescript
// GOOD: seeded token name as bearer value
headers: { Authorization: 'Bearer test_admin' }
```

### Permission Testing Pattern

```typescript
describe('permission checks', () => {
  it('admin can delete repos', async () => {
    const res = await fetch(`${GITHUB_API_BASE}/repos/org/repo`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin_token' }
    })
    expect(res.status).toBe(204)
  })

  it('readonly user cannot delete repos', async () => {
    const res = await fetch(`${GITHUB_API_BASE}/repos/org/repo`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer readonly_token' }
    })
    expect(res.status).toBe(403)
  })
})
```

**Key rules:**
- Token names in the config are the literal Bearer strings used in API requests
- Never put real GitHub PATs, Vercel tokens, or Google credentials in seed configs
- Use descriptive token names: `admin_token`, `ci_token`, `readonly_token`
- Map each token to a user login defined in the same config
- Test permission boundaries by creating tokens with different scope sets
- Keep token configs in committed files for reproducibility — they contain no secrets

Reference: `rules/seed-config.md`

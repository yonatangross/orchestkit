---
title: "Seed Config: emulate.config.yaml Structure"
impact: HIGH
impactDescription: "Without a centralized seed config, tests start from empty state requiring verbose per-test setup, and tokens get hardcoded in test files"
tags: [emulate, seed, config, yaml, testing]
---

## Seed Config Structure

The `emulate.config.yaml` file pre-populates the emulator with tokens, users, repos, and projects so every test starts from a known, reproducible state.

### Config Sections

```yaml
# emulate.config.yaml — full structure
tokens:
  dev_token:
    login: dev-user        # Maps this token string to a user
    scopes: [repo, workflow, admin:org]
  read_only_token:
    login: reader
    scopes: [repo:read]

github:
  users:
    - login: dev-user
      name: Developer
    - login: reader
      name: Read-Only User
  orgs:
    - login: my-org
      name: My Organization
  repos:
    - owner: my-org
      name: backend
      private: false
      default_branch: main
      topics: [api, typescript]
    - owner: dev-user
      name: side-project
      private: true
      default_branch: main

vercel:
  users:
    - username: dev-user
      email: dev@example.com
  projects:
    - name: frontend
      framework: next
    - name: docs
      framework: astro

google:
  users:
    - email: dev@example.com
      name: Developer
```

**Incorrect — hardcoding tokens in test files:**

```typescript
// BAD: tokens scattered across test files, no shared state
const res = await fetch('http://localhost:4001/repos/org/repo', {
  headers: { Authorization: 'Bearer ghp_realtoken123' }
})
```

**Correct — centralized seed config:**

```yaml
# .emulate/test.config.yaml
tokens:
  test_admin:
    login: admin-user
    scopes: [repo, admin:org]
```

```typescript
// Tests reference seeded token names
const res = await fetch(`${GITHUB_API_BASE}/repos/org/repo`, {
  headers: { Authorization: 'Bearer test_admin' }
})
```

**Key rules:**
- Place configs in `.emulate/` directory or project root
- One config per environment: `ci.config.yaml`, `dev.config.yaml`, `test.config.yaml`
- Token names are the literal Bearer strings used in requests — keep them descriptive
- Every token must map to a user defined in the same config's users section
- Add `.emulate/` to `.gitignore` only if it contains environment-specific overrides
- Commit shared base configs (e.g., `emulate.config.yaml`) to the repo for reproducibility
- Use `npx emulate init --service github` to generate a starter config

Reference: `references/cli-reference.md`

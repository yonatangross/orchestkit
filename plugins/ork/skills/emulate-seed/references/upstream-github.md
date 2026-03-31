<!-- SYNCED from vercel-labs/emulate (skills/github/SKILL.md) -->
<!-- Hash: 635cb8ee698f5fe8b6fb4fafa9d5aaf0d9cd697c71fd980d1b56d34c328bda00 -->
<!-- Re-sync: bash scripts/sync-vercel-skills.sh -->


# GitHub API Emulator

Fully stateful GitHub REST API emulation. Creates, updates, and deletes persist in memory and affect related entities.

## Start

```bash
# GitHub only
npx emulate --service github

# Default port
# http://localhost:4001
```

Or programmatically:

```typescript
import { createEmulator } from 'emulate'

const github = await createEmulator({ service: 'github', port: 4001 })
// github.url === 'http://localhost:4001'
```

## Auth

Pass tokens as `Authorization: Bearer <token>` or `Authorization: token <token>`.

```bash
curl http://localhost:4001/user \
  -H "Authorization: Bearer gho_test_token_admin"
```

Public repo endpoints work without auth. Private repos and write operations require a valid token. When no token is provided, requests fall back to the first seeded user.

### GitHub App JWT

Configure apps in the seed config with a private key. Sign a JWT with `{ iss: "<app_id>" }` using RS256. The emulator verifies the signature and resolves the app.

```yaml
github:
  apps:
    - app_id: 12345
      slug: my-github-app
      name: My GitHub App
      private_key: |
        -----BEGIN RSA PRIVATE KEY-----
        ...
        -----END RSA PRIVATE KEY-----
      permissions:
        contents: read
        issues: write
      events: [push, pull_request]
      installations:
        - installation_id: 100
          account: my-org
          repository_selection: all
```

## Pointing Your App at the Emulator

### Environment Variable

```bash
GITHUB_EMULATOR_URL=http://localhost:4001
```

### Octokit

```typescript
import { Octokit } from '@octokit/rest'

const octokit = new Octokit({
  baseUrl: process.env.GITHUB_EMULATOR_URL ?? 'https://api.github.com',
  auth: 'gho_test_token_admin',
})
```

### OAuth URL Mapping

| Real GitHub URL | Emulator URL |
|-----------------|-------------|
| `https://github.com/login/oauth/authorize` | `$GITHUB_EMULATOR_URL/login/oauth/authorize` |
| `https://github.com/login/oauth/access_token` | `$GITHUB_EMULATOR_URL/login/oauth/access_token` |
| `https://api.github.com/user` | `$GITHUB_EMULATOR_URL/user` |

### Auth.js / NextAuth.js

```typescript
import GitHub from '@auth/core/providers/github'

GitHub({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  authorization: {
    url: `${process.env.GITHUB_EMULATOR_URL}/login/oauth/authorize`,
  },
  token: {
    url: `${process.env.GITHUB_EMULATOR_URL}/login/oauth/access_token`,
  },
  userinfo: {
    url: `${process.env.GITHUB_EMULATOR_URL}/user`,
  },
})
```

## Seed Config

```yaml
tokens:
  gho_test_token_admin:
    login: admin
    scopes: [repo, user, admin:org, admin:repo_hook]

github:
  users:
    - login: octocat
      name: The Octocat
      email: octocat@github.com
      bio: I am the Octocat
      company: GitHub
      location: San Francisco
  orgs:
    - login: my-org
      name: My Organization
      description: A test organization
  repos:
    - owner: octocat
      name: hello-world
      description: My first repository
      language: JavaScript
      topics: [hello, world]
      auto_init: true
  oauth_apps:
    - client_id: Iv1.abc123
      client_secret: secret_abc123
      name: My Web App
      redirect_uris:
        - http://localhost:3000/api/auth/callback/github
```

## Pagination

All list endpoints support `page` and `per_page` query params with `Link` headers:

```bash
curl "http://localhost:4001/repos/octocat/hello-world/issues?page=1&per_page=10" \
  -H "Authorization: Bearer gho_test_token_admin"
```

## API Endpoints

### Users

```bash
# Authenticated user
curl http://localhost:4001/user -H "Authorization: Bearer $TOKEN"

# Update profile
curl -X PATCH http://localhost:4001/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Hello!"}'

# Get user by username
curl http://localhost:4001/users/octocat

# List users
curl http://localhost:4001/users

# User repos / orgs / followers / following
curl http://localhost:4001/users/octocat/repos
curl http://localhost:4001/users/octocat/orgs
curl http://localhost:4001/users/octocat/followers
curl http://localhost:4001/users/octocat/following
```

### Repositories

```bash
# Get repo
curl http://localhost:4001/repos/octocat/hello-world

# Create user repo
curl -X POST http://localhost:4001/user/repos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "new-repo", "private": false}'

# Create org repo
curl -X POST http://localhost:4001/orgs/my-org/repos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "org-project"}'

# Update repo
curl -X PATCH http://localhost:4001/repos/octocat/hello-world \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'

# Delete repo (cascades issues, PRs, etc.)
curl -X DELETE http://localhost:4001/repos/octocat/hello-world \
  -H "Authorization: Bearer $TOKEN"

# Topics, languages, contributors, forks, collaborators, tags, transfer
```

### Issues

```bash
# List issues (filter by state, labels, assignee, milestone, creator, since)
curl "http://localhost:4001/repos/octocat/hello-world/issues?state=open&labels=bug"

# Create issue
curl -X POST http://localhost:4001/repos/octocat/hello-world/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Bug report", "body": "Details here", "labels": ["bug"]}'

# Get issue
curl http://localhost:4001/repos/octocat/hello-world/issues/1

# Update issue
curl -X PATCH http://localhost:4001/repos/octocat/hello-world/issues/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "closed"}'

# Lock/unlock, timeline, events, assignees
```

### Pull Requests

```bash
# List PRs
curl "http://localhost:4001/repos/octocat/hello-world/pulls?state=open"

# Create PR
curl -X POST http://localhost:4001/repos/octocat/hello-world/pulls \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Feature", "head": "feature-branch", "base": "main"}'

# Get PR
curl http://localhost:4001/repos/octocat/hello-world/pulls/1

# Update PR
curl -X PATCH http://localhost:4001/repos/octocat/hello-world/pulls/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated title"}'

# Merge PR (enforces branch protection)
curl -X PUT http://localhost:4001/repos/octocat/hello-world/pulls/1/merge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"merge_method": "squash"}'

# Commits, files, requested reviewers, update branch
```

### Comments

```bash
# Issue comments: full CRUD
curl http://localhost:4001/repos/octocat/hello-world/issues/1/comments
curl -X POST http://localhost:4001/repos/octocat/hello-world/issues/1/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Looks good!"}'

# Review comments on PRs
curl http://localhost:4001/repos/octocat/hello-world/pulls/1/comments

# Commit comments
curl http://localhost:4001/repos/octocat/hello-world/commits/abc123/comments
```

### Reviews

```bash
# List reviews
curl http://localhost:4001/repos/octocat/hello-world/pulls/1/reviews

# Create review (with inline comments)
curl -X POST http://localhost:4001/repos/octocat/hello-world/pulls/1/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event": "APPROVE", "body": "LGTM"}'

# Get, update, submit, dismiss reviews
```

### Labels & Milestones

Full CRUD for labels and milestones. Add/remove labels from issues, replace all labels.

### Branches & Git Data

```bash
# List branches
curl http://localhost:4001/repos/octocat/hello-world/branches

# Get branch
curl http://localhost:4001/repos/octocat/hello-world/branches/main

# Branch protection CRUD (status checks, PR reviews, enforce admins)
curl -X PUT http://localhost:4001/repos/octocat/hello-world/branches/main/protection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"required_status_checks": {"strict": true, "contexts": ["ci"]}}'

# Refs, commits, trees (recursive), blobs, tags
```

### Organizations & Teams

```bash
# Get org
curl http://localhost:4001/orgs/my-org

# Org members, teams, repos
curl http://localhost:4001/orgs/my-org/members
curl http://localhost:4001/orgs/my-org/teams
```

### Releases

```bash
# Create release
curl -X POST http://localhost:4001/repos/octocat/hello-world/releases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_name": "v1.0.0", "name": "v1.0.0"}'

# List, get, latest, by tag, assets, generate notes
```

### Webhooks

```bash
# Create webhook (real HTTP delivery on state changes)
curl -X POST http://localhost:4001/repos/octocat/hello-world/hooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {"url": "http://localhost:8080/webhook"}, "events": ["push", "pull_request"]}'

# Full CRUD, ping, test, deliveries
# Org webhooks also supported
```

### Search

```bash
# Search repositories
curl "http://localhost:4001/search/repositories?q=language:JavaScript+user:octocat"

# Search issues and PRs
curl "http://localhost:4001/search/issues?q=repo:octocat/hello-world+is:open"

# Search users, code, commits, topics, labels
```

### Actions

```bash
# Workflows: list, get, enable/disable, dispatch
# Workflow runs: list, get, cancel, rerun, delete, logs
# Jobs: list, get, logs
# Artifacts: list, get, delete
# Secrets: repo + org CRUD
```

### Checks

```bash
# Create check run
curl -X POST http://localhost:4001/repos/octocat/hello-world/check-runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CI", "head_sha": "abc123", "status": "completed", "conclusion": "success"}'

# Check suites, annotations, rerequest, list by ref
# Automatic suite status rollup from check run results
```

### OAuth

```bash
# Authorize (browser flow -- shows user picker)
# GET /login/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...

# Token exchange
curl -X POST http://localhost:4001/login/oauth/access_token \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"client_id": "Iv1.abc123", "client_secret": "secret_abc123", "code": "<code>"}'

# User emails
curl http://localhost:4001/user/emails -H "Authorization: Bearer $TOKEN"
```

### Misc

```bash
curl http://localhost:4001/rate_limit
curl http://localhost:4001/meta
curl http://localhost:4001/octocat
curl http://localhost:4001/zen
```

## Common Patterns

### Create Repo, Issue, and PR

```bash
TOKEN="gho_test_token_admin"
BASE="http://localhost:4001"

# Create repo
curl -X POST $BASE/user/repos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project"}'

# Create issue
curl -X POST $BASE/repos/admin/my-project/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "First issue"}'

# Create PR
curl -X POST $BASE/repos/admin/my-project/pulls \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "First PR", "head": "feature", "base": "main"}'
```

### OAuth Flow

1. Redirect user to `$GITHUB_EMULATOR_URL/login/oauth/authorize?client_id=...&redirect_uri=...&scope=user+repo&state=...`
2. User picks a seeded user on the emulator's UI
3. Emulator redirects back with `?code=...&state=...`
4. Exchange code for token via `POST /login/oauth/access_token`
5. Use token to call API endpoints

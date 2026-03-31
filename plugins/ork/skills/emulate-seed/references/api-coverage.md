# API Coverage

Full list of supported API endpoints per emulate service.

## GitHub API (`:4001`)

### Repositories
- `GET /repos/:owner/:repo` — Get repository
- `POST /user/repos` — Create user repository
- `POST /orgs/:org/repos` — Create org repository
- `PATCH /repos/:owner/:repo` — Update repository
- `DELETE /repos/:owner/:repo` — Delete repository (cascading: PRs, issues, webhooks)
- `GET /repos/:owner/:repo/topics` — List topics
- `PUT /repos/:owner/:repo/topics` — Replace topics

### Pull Requests
- `GET /repos/:owner/:repo/pulls` — List PRs (cursor pagination)
- `POST /repos/:owner/:repo/pulls` — Create PR
- `GET /repos/:owner/:repo/pulls/:number` — Get PR
- `PATCH /repos/:owner/:repo/pulls/:number` — Update PR
- `PUT /repos/:owner/:repo/pulls/:number/merge` — Merge PR
- `GET /repos/:owner/:repo/pulls/:number/reviews` — List reviews
- `POST /repos/:owner/:repo/pulls/:number/reviews` — Create review
- `GET /repos/:owner/:repo/pulls/:number/comments` — List review comments
- `POST /repos/:owner/:repo/pulls/:number/comments` — Create review comment

### Issues
- `GET /repos/:owner/:repo/issues` — List issues
- `POST /repos/:owner/:repo/issues` — Create issue
- `GET /repos/:owner/:repo/issues/:number` — Get issue
- `PATCH /repos/:owner/:repo/issues/:number` — Update issue
- `GET /repos/:owner/:repo/issues/:number/comments` — List comments
- `POST /repos/:owner/:repo/issues/:number/comments` — Create comment

### Actions / Workflows
- `GET /repos/:owner/:repo/actions/workflows` — List workflows
- `POST /repos/:owner/:repo/actions/workflows/:id/dispatches` — Trigger workflow
- `GET /repos/:owner/:repo/actions/runs` — List workflow runs
- `GET /repos/:owner/:repo/actions/runs/:id` — Get run
- `GET /repos/:owner/:repo/actions/runs/:id/jobs` — List jobs

### Webhooks
- `GET /repos/:owner/:repo/hooks` — List webhooks
- `POST /repos/:owner/:repo/hooks` — Create webhook
- `PATCH /repos/:owner/:repo/hooks/:id` — Update webhook
- `DELETE /repos/:owner/:repo/hooks/:id` — Delete webhook

### Organizations & Teams
- `GET /orgs/:org` — Get organization
- `GET /orgs/:org/repos` — List org repos
- `GET /orgs/:org/teams` — List teams
- `POST /orgs/:org/teams` — Create team
- `GET /orgs/:org/members` — List members

### Users
- `GET /user` — Authenticated user
- `GET /users/:username` — Get user
- `GET /users/:username/repos` — List user repos

## Vercel API (`:4000`)

### Projects
- `GET /v9/projects` — List projects
- `POST /v9/projects` — Create project
- `GET /v9/projects/:id` — Get project
- `PATCH /v9/projects/:id` — Update project
- `DELETE /v9/projects/:id` — Delete project

### Deployments
- `GET /v6/deployments` — List deployments
- `POST /v13/deployments` — Create deployment
- `GET /v13/deployments/:id` — Get deployment
- `DELETE /v13/deployments/:id` — Cancel deployment

### Domains
- `GET /v5/domains` — List domains
- `POST /v5/domains` — Add domain
- `DELETE /v5/domains/:name` — Remove domain

### Environment Variables
- `GET /v9/projects/:id/env` — List env vars
- `POST /v9/projects/:id/env` — Create env var
- `PATCH /v9/projects/:id/env/:envId` — Update env var
- `DELETE /v9/projects/:id/env/:envId` — Delete env var

### Teams
- `GET /v2/teams` — List teams
- `POST /v1/teams` — Create team
- `GET /v2/teams/:id` — Get team

## Google OAuth (`:4002`)

### OAuth 2.0
- `GET /o/oauth2/v2/auth` — Authorization endpoint
- `POST /oauth2/v4/token` — Token exchange
- `GET /oauth2/v2/userinfo` — User info
- `POST /oauth2/revoke` — Token revocation

## Slack Web API (`:4003`)

### Chat & Conversations
- `POST /api/chat.postMessage` — Send message
- `GET /api/conversations.list` — List conversations
- `GET /api/conversations.history` — Get messages in channel
- `POST /api/reactions.add` — Add emoji reaction
- `GET /api/users.list` — List workspace users

### OAuth
- `GET /oauth/v2/authorize` — OAuth v2 consent UI
- `POST /api/oauth.v2.access` — Token exchange

## Apple Authentication (`:4004`)

- `GET /.well-known/openid-configuration` — OIDC discovery
- `GET /auth/keys` — JWKS endpoint (RS256)
- `GET /auth/authorize` — Authorization flow
- `POST /auth/token` — Token exchange
- `POST /auth/revoke` — Token revocation

## Microsoft Entra ID (`:4005`)

- `GET /{tenant}/v2.0/.well-known/openid-configuration` — OIDC discovery
- `GET /{tenant}/oauth2/v2.0/authorize` — Authorization code + PKCE
- `POST /{tenant}/oauth2/v2.0/token` — Token exchange with refresh rotation
- `GET /{tenant}/oauth2/v2.0/logout` — Logout endpoint

## AWS (`:4006`)

### S3
- `PUT /{bucket}` — Create bucket
- `GET /` — List buckets
- `PUT /{bucket}/{key}` — Put object
- `GET /{bucket}/{key}` — Get object
- `DELETE /{bucket}/{key}` — Delete object

### SQS
- `POST /` — CreateQueue, SendMessage, ReceiveMessage, DeleteMessage

### IAM & STS
- `POST /` — CreateUser, CreateRole, GetCallerIdentity, AssumeRole

## Stateful Behaviors

All services maintain full state:
- **Cascading deletes**: Delete a repo and its PRs, issues, and webhooks are removed
- **Cursor pagination**: List endpoints support `?per_page=N&page=N` and Link headers
- **Auto-incrementing IDs**: PRs, issues, comments get sequential IDs
- **Webhook delivery**: State mutations trigger webhook POST to configured URLs with HMAC signatures
- **Scope enforcement**: Token scopes are checked — insufficient scopes return 403

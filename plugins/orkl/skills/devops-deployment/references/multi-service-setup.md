# Multi-Service Setup on Railway

Deploy multiple services in one Railway project for monorepos, microservices, or web + worker architectures.

## Monorepo Configuration

Each service in a Railway project can point to a different root directory:

```
my-monorepo/
├── apps/
│   ├── api/           ← Service 1 (root: apps/api)
│   │   ├── package.json
│   │   └── railway.json
│   ├── web/           ← Service 2 (root: apps/web)
│   │   ├── package.json
│   │   └── railway.json
│   └── worker/        ← Service 3 (root: apps/worker)
│       ├── package.json
│       └── railway.json
├── packages/          ← Shared packages
└── package.json       ← Root workspace
```

Set each service's root directory in the Railway dashboard under Settings > Source.

## Private Networking

Services within the same project communicate over Railway's private network:

```
# From the web service, call the API service:
http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}/endpoint

# In environment variables (set on web service):
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
```

**Key points:**
- Private networking uses internal DNS, no public internet
- Zero egress costs between services
- Always use the `PORT` variable — not hardcoded ports
- Services must listen on `0.0.0.0` (not `localhost`)

## Common Architectures

### Web + API + Worker

| Service | Role | Public? |
|---------|------|---------|
| `web` | Frontend (Next.js, Vite) | Yes |
| `api` | Backend API | Yes (or private if only web calls it) |
| `worker` | Background jobs (BullMQ, Celery) | No |
| `postgres` | Database | No (private only) |
| `redis` | Cache / queue broker | No (private only) |

### Shared Environment Variables

Use Railway's shared variables (project-level) for values needed by all services:
- `NODE_ENV=production`
- `LOG_LEVEL=info`

Use reference variables for cross-service connections:
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `REDIS_URL=${{Redis.REDIS_URL}}`
- `API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`

## Deploy Order

Railway deploys services in parallel by default. If you need ordering (e.g., run migrations before starting web):
1. Put migrations in the API service's `startCommand`
2. Use healthchecks — dependent services will retry connections until the API is healthy
3. For strict ordering, use separate deploy triggers via Railway CLI

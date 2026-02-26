---
title: Configure Railway PaaS deployment with correct Nixpacks, environment, and railway.json settings
category: devops
impact: HIGH
impactDescription: Railway simplifies PaaS deployment but misconfigured railway.json, Nixpacks, or environment variables cause failed deploys and unexpected costs.
tags: [railway, deployment, nixpacks, hosting, paas, devops]
---

# Railway Deployment Patterns

## railway.json Configuration

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Nixpacks vs Dockerfile

| Factor | Nixpacks (default) | Dockerfile |
|--------|-------------------|-----------|
| Setup | Zero config, auto-detect | Manual, full control |
| Build time | Fast (Nix cache) | Depends on layers |
| Customization | nixpacks.toml | Unlimited |
| Use when | Standard apps | Custom runtimes, multi-stage |

## Environment Variables

- Use Railway's **shared variables** for cross-service config (DATABASE_URL, REDIS_URL)
- **Service-specific** variables override shared ones
- Reference other vars: `${{shared.DATABASE_URL}}`
- Never hardcode secrets — use Railway's encrypted env vars

## Database Provisioning

Railway provisions managed databases with one click:
- PostgreSQL, MySQL, Redis, MongoDB
- Connection string auto-injected as env var
- Backups included on paid plans

## Multi-Service Setup

- Use **monorepo** config: set `rootDirectory` per service
- Internal networking: services communicate via `${{service.RAILWAY_PRIVATE_DOMAIN}}:port`
- Shared env groups for common config

## Railway CLI

```bash
railway login              # Authenticate
railway link               # Connect to project
railway up                 # Deploy from local
railway logs               # View deployment logs
railway variables          # List env vars
railway shell              # Open shell in service
```

## Anti-Patterns

**Incorrect:**
- Running `railway up` from CI without `railway link` — deploys to wrong project
- Using Dockerfile when Nixpacks handles the stack — unnecessary complexity
- Storing secrets in railway.json — use env vars
- Skipping healthcheck config — Railway can't detect failed deploys

**Correct:**
- Configure healthcheckPath for all web services
- Use shared variables for cross-service config
- Set restart policy for resilience
- Use Nixpacks unless you need custom runtime

## References

- `references/railway-json-config.md` — Full railway.json schema and examples
- `references/nixpacks-customization.md` — Custom build configs, environment detection
- `references/multi-service-setup.md` — Monorepo deploy, service networking

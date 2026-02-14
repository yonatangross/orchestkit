# railway.json Configuration

Complete reference for `railway.json` schema — the primary way to configure build and deploy behavior on Railway.

## Full Schema

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build",
    "watchPatterns": ["src/**", "package.json"],
    "nixpacksConfigPath": "nixpacks.toml",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "numReplicas": 1,
    "sleepApplication": false,
    "region": "us-west1",
    "cronSchedule": "0 */6 * * *"
  }
}
```

## Builder Options

| Builder | When to Use |
|---------|-------------|
| `NIXPACKS` | Default — auto-detects language and builds (Node, Python, Go, Rust, etc.) |
| `DOCKERFILE` | Complex builds, multi-stage images, custom system deps |
| `PAKETO` | Cloud Native Buildpacks alternative |

## Deploy Settings

| Field | Default | Description |
|-------|---------|-------------|
| `startCommand` | Auto-detected | Overrides default start command |
| `healthcheckPath` | None | HTTP path to check for 200 response |
| `healthcheckTimeout` | 30 | Seconds before healthcheck is considered failed |
| `restartPolicyType` | `ON_FAILURE` | `ON_FAILURE`, `ALWAYS`, or `NEVER` |
| `restartPolicyMaxRetries` | 3 | Max restart attempts before marking deploy failed |
| `numReplicas` | 1 | Number of instances (horizontal scaling) |
| `sleepApplication` | false | Sleep service when no traffic (saves credits) |
| `cronSchedule` | None | Cron expression for scheduled services |

## Examples

### Node.js API with migrations

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && node dist/server.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 60
  }
}
```

### Python FastAPI

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health"
  }
}
```

### Cron Worker (no web traffic)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "node dist/worker.js",
    "cronSchedule": "*/15 * * * *",
    "restartPolicyType": "NEVER"
  }
}
```

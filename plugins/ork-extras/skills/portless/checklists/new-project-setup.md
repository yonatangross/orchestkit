# New Project Setup Checklist

Add portless to an existing or new project in 7 steps.

## Prerequisites

- `portless` CLI installed (`npm i -g portless` or `brew install portless`)
- Project runs locally with a dev server

## Steps

### 1. Choose Name(s)

Pick portless names for your services. Conventions:

| Pattern | Example | When to use |
|---------|---------|-------------|
| `<project>` | `myapp` | Single-service project |
| `<project>-<layer>` | `myapp-api`, `myapp-web` | Multi-service / monorepo |
| `<service>` | `api`, `web`, `docs` | When project context is obvious |

Names become `https://<name>.localhost`. Keep them short.

### 2. Update Dev Scripts

Wrap your dev commands with `portless run`:

```jsonc
// package.json
{
  "scripts": {
    // Before
    "dev": "next dev",
    // After
    "dev": "portless run --name myapp next dev"
  }
}
```

For frameworks that don't auto-detect `PORT` (FastAPI, Django), add explicit flags. See `references/framework-integration.md` for per-framework recipes.

### 3. Update Environment Variables

Replace hardcoded `localhost:NNNN` URLs in `.env` files:

```bash
# Before
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# After
API_URL=https://api.localhost
NEXT_PUBLIC_API_URL=https://api.localhost
```

Search for stale references:

```bash
grep -rn 'localhost:[0-9]' --include='*.env*' --include='*.ts' --include='*.js' .
```

### 4. Update Proxy Configs

If your frontend proxies API calls, update the target and add `changeOrigin: true`:

**Next.js** (`next.config.js`):
```js
rewrites: () => [{
  source: "/api/:path*",
  destination: "https://api.localhost/:path*",
  changeOrigin: true,
}]
```

**Vite** (`vite.config.ts`):
```js
server: {
  proxy: {
    "/api": { target: "https://api.localhost", changeOrigin: true, secure: false }
  }
}
```

### 5. CI Compatibility

Portless is a dev-only tool. Disable it in CI:

```yaml
# GitHub Actions
env:
  PORTLESS: "0"

# Or in package.json
"dev:ci": "PORTLESS=0 next dev"
```

### 6. Monorepo Pattern

For Turborepo / Nx workspaces, configure per-package:

```jsonc
// apps/web/package.json
{ "scripts": { "dev": "portless run --name web next dev" } }

// apps/api/package.json
{ "scripts": { "dev": "portless run --name api uvicorn main:app --port $PORT --host $HOST" } }

// Root — runs both via turbo
// turbo dev → starts web.localhost + api.localhost
```

### 7. Verify

```bash
# List active portless services
portless list

# Open in browser
open https://myapp.localhost

# Test cross-service calls
curl https://api.localhost/health
```

Check that:
- [ ] Dev server starts at `https://<name>.localhost`
- [ ] Cross-service calls resolve (no `ECONNREFUSED`)
- [ ] OAuth callbacks work with new URLs (if applicable)
- [ ] CI still works with `PORTLESS=0`

## Rollback

If something breaks, remove `portless run --name <name>` from scripts and revert `.env` changes. Portless is additive — removing it just falls back to direct `localhost:PORT`.

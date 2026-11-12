# Framework Integration Recipes

How to configure popular frameworks to work with `portless run`.

## How Portless Works

Portless injects `PORT` and `HOST` environment variables into your process. Frameworks that read `PORT` automatically (Express, Fastify, Hono, Next.js, Vite) work out of the box. Others need explicit flags.

## Framework Reference

### Node.js (Express, Fastify, Hono)

Auto-detected. No extra flags needed:

```bash
portless run --name api node server.js
# Express/Fastify/Hono read process.env.PORT automatically
```

**IPv6 ECONNREFUSED fix**: If you see `ECONNREFUSED ::1:4001`, Node 18+ prefers IPv6 by default. Fix:

```js
// At the top of your entry file
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
```

Or set the env var: `NODE_OPTIONS="--dns-result-order=ipv4first"`.

### Next.js

Auto-detected. Reads `PORT` from environment:

```bash
portless run --name web next dev
# → https://web.localhost
```

**Proxy rewrites** (e.g., `/api` → backend service): use `changeOrigin: true` to avoid 508 redirect loops:

```js
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.localhost/:path*",
        // CRITICAL: prevents 508 loop when proxying to another portless service
        changeOrigin: true,
      },
    ];
  },
};
```

### Vite / Astro

Auto-detected. Reads `PORT` from environment:

```bash
portless run --name app vite dev
# → https://app.localhost
```

**Proxy config** for API backends:

```js
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "https://api.localhost",
        changeOrigin: true, // prevents 508 loop
        secure: false, // allow self-signed .localhost certs
      },
    },
  },
});
```

### FastAPI / Uvicorn

**NOT auto-detected** — uvicorn ignores the `PORT` env var. You MUST pass `--port` and `--host` explicitly:

```bash
# WRONG — uvicorn ignores PORT, binds to 8000
portless run --name api uvicorn main:app

# CORRECT — read from injected env vars
portless run --name api uvicorn main:app --port \$PORT --host \$HOST
```

**Trailing slash gotcha**: FastAPI redirects `/api/users` to `/api/users/` by default. This 307 redirect can confuse proxied setups. Fix:

```python
from fastapi import FastAPI

app = FastAPI(redirect_slashes=False)
```

Or ensure all routes have consistent trailing slashes.

### Django

**NOT auto-detected** — pass `$HOST:$PORT` as a positional argument:

```bash
# WRONG — Django ignores PORT env var
portless run --name admin python manage.py runserver

# CORRECT
portless run --name admin python manage.py runserver \$HOST:\$PORT
```

### Ruby on Rails

Auto-detected. Reads `PORT` from environment:

```bash
portless run --name app rails server
```

### Go (net/http)

Read from environment in your code:

```go
port := os.Getenv("PORT")
if port == "" {
    port = "8080"
}
http.ListenAndServe(":"+port, handler)
```

```bash
portless run --name api go run ./cmd/server
```

## Docker Infrastructure via Aliases

Use `portless alias` for Docker services that expose fixed ports (databases, caches, etc.):

```bash
# Map Docker-exposed ports to named URLs
portless alias postgres 5432
portless alias redis 6379
portless alias minio 9000

# Now accessible as:
#   https://postgres.localhost
#   https://redis.localhost
#   https://minio.localhost
```

This is useful for consistency — all services (app and infra) use the same `*.localhost` URL pattern.

## Common Gotchas

### Cookie Domain

Never set `Domain=.localhost` on cookies. Per RFC 6761, browsers handle `.localhost` specially and will reject domain-scoped cookies. Use path-scoped cookies or omit the `Domain` attribute entirely (defaults to exact origin).

```js
// WRONG
res.cookie("session", token, { domain: ".localhost" });

// CORRECT — omit domain, browser scopes to exact origin
res.cookie("session", token, { path: "/" });
```

### Proxy 508 Loop

When proxying between two portless services (e.g., `web.localhost` → `api.localhost`), always set `changeOrigin: true` in your proxy config. Without it, the `Host` header retains the original domain, causing a redirect loop (HTTP 508).

### Mixed Port References

After adopting portless, grep your codebase for hardcoded `localhost:NNNN` references:

```bash
grep -rn 'localhost:[0-9]' --include='*.ts' --include='*.js' --include='*.env*' .
```

Replace with `PORTLESS_URL` or the named `*.localhost` URL.

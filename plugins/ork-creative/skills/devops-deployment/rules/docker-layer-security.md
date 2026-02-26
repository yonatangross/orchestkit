---
title: Secure Docker layers by running as non-root and excluding secrets from image builds
category: docker
impact: CRITICAL
impactDescription: "Containers run as root with secrets baked into image layers — a single container escape grants full host access and leaks credentials in any registry pull"
tags: [docker, security, container-hardening]
---

## Docker: Layer Security

Every Docker image layer is immutable and inspectable. Running as root or embedding secrets in layers creates critical security vulnerabilities that persist even if later layers attempt to remove them.

**Incorrect:**
```dockerfile
FROM node:20
WORKDIR /app

# BAD: Copies .env, .git, node_modules, and everything else
COPY . .
RUN npm install

# BAD: Secret baked into image layer (visible via docker history)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# BAD: Running as root (default)
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Correct:**
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app

# GOOD: Create and use non-root user (uid 1001)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# GOOD: Copy only what's needed with explicit ownership
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

# GOOD: Run as non-root
USER nodejs

# GOOD: Secrets injected at runtime, never in image
# Use: docker run -e DATABASE_URL=... or Kubernetes secrets
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD node healthcheck.js || exit 1
CMD ["node", "dist/main.js"]
```

**Required `.dockerignore`:**
```
.git
.env
.env.*
node_modules
*.md
tests/
.vscode/
```

**Key rules:**
- Never run containers as root — always create a non-root user with `USER` directive
- Never pass secrets via `ARG` or `ENV` in the Dockerfile — they are visible in `docker history`
- Always use a `.dockerignore` to exclude `.env`, `.git`, `node_modules`, and test files
- Use `COPY --chown` to set file ownership without a separate `chown` layer
- Prefer minimal base images (`-alpine`) to reduce the CVE surface area
- Enable read-only root filesystem in Kubernetes (`readOnlyRootFilesystem: true`)
- Add health checks so orchestrators can detect and restart unhealthy containers

Reference: `references/docker-patterns.md` (lines 52-85)

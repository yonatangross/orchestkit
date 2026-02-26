---
title: Use Docker multi-stage builds to exclude dev dependencies and reduce image size by 4-5x
category: docker
impact: HIGH
impactDescription: "Production images ship with build tools, dev dependencies, and source files — bloating images by 4-5x and expanding the attack surface"
tags: [docker, image-size, build-optimization]
---

## Docker: Multi-Stage Builds

Separate build-time concerns from runtime to produce minimal, secure production images. A well-structured multi-stage build can reduce image size by 78% or more.

**Incorrect:**
```dockerfile
# Single-stage: build tools and dev deps ship to production
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
# Result: ~850 MB image with dev dependencies, source files, build tools
```

**Correct:**
```dockerfile
# Stage 1: Install production dependencies only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build with dev dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run test

# Stage 3: Minimal production runtime
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./
USER nodejs
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=3s CMD node healthcheck.js || exit 1
CMD ["node", "dist/main.js"]
# Result: ~180 MB image with only production runtime
```

**Key rules:**
- Use separate stages for dependency installation, building, and runtime
- Copy only production `node_modules` and compiled artifacts into the final stage
- Use `-alpine` base images to minimize base layer size
- Run `npm ci` (not `npm install`) for reproducible, lockfile-exact installs
- Clean caches (`npm cache clean --force`) in the same layer as install to avoid bloating layers
- Always include a `HEALTHCHECK` in the production stage for orchestrator integration
- Run tests in the builder stage so test failures prevent image creation

Reference: `references/docker-patterns.md` (lines 7-50)

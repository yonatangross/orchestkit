# Docker Patterns

Best practices for Dockerfile optimization, multi-stage builds, and container security.

## Multi-Stage Build Example

```dockerfile
# ============================================================
# Stage 1: Dependencies (builder)
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ============================================================
# Stage 2: Build (with dev dependencies)
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci  # Include dev dependencies
COPY . .
RUN npm run build && npm run test

# ============================================================
# Stage 3: Production runtime (minimal)
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Security: Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy only production dependencies and built artifacts
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=3s CMD node healthcheck.js || exit 1
CMD ["node", "dist/main.js"]
```

**Image size comparison:**
- Single-stage: **850 MB** (includes dev dependencies, source files)
- Multi-stage: **180 MB** (only runtime + production deps)
- **78% reduction**

## Layer Caching Optimization

**Order matters for cache efficiency:**

```dockerfile
# BAD: Invalidates cache on any code change
COPY . .
RUN npm install

# GOOD: Cache package.json layer separately
COPY package*.json ./
RUN npm ci  # Cached unless package.json changes
COPY . .    # Source changes don't invalidate npm install
```

## Security Hardening

**Non-root user (uid 1001):**
```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
```

**Read-only filesystem where possible:**
```dockerfile
# In K8s deployment
securityContext:
  readOnlyRootFilesystem: true
```

**Health checks for orchestrator integration:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s CMD node healthcheck.js || exit 1
```

## Security Scanning with Trivy

```yaml
- name: Build Docker Image
  run: docker build -t myapp:${{ github.sha }} .

- name: Scan for Vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'myapp:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Scan Results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'

- name: Fail on Critical Vulnerabilities
  run: |
    trivy image --severity CRITICAL --exit-code 1 myapp:${{ github.sha }}
```

## Docker Compose Development Setup

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: skillforge
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: skillforge_dev
    ports:
      - "5437:5432"  # Avoid conflict with host postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skillforge"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8500:8500"
    environment:
      DATABASE_URL: postgresql://skillforge:dev_password@postgres:5432/skillforge_dev
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app  # Hot reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8500
    volumes:
      - ./frontend:/app
      - /app/node_modules  # Avoid overwriting node_modules

volumes:
  pgdata:
  redisdata:
```

**Key patterns:**
- Port mapping to avoid host conflicts (5437:5432)
- Health checks before dependent services start
- Volume mounts for hot reload during development
- Named volumes for data persistence

See `templates/Dockerfile` and `templates/docker-compose.yml` for complete examples.
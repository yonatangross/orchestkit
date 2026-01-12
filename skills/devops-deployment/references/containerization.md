# Docker Containerization

Docker best practices for production applications.

## Dockerfile Best Practices

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## Key Patterns

1. **Multi-stage builds** - smaller images
2. **Layer caching** - order matters (package.json before code)
3. **Alpine images** - 5MB vs 900MB
4. **Non-root user** - security
5. **.dockerignore** - exclude node_modules, .git

## Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:5432/db
    depends_on:
      - postgres
  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

See `templates/Dockerfile` and `templates/docker-compose.yml`.

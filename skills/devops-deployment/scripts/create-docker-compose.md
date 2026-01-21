---
name: create-docker-compose
description: Create Docker Compose configuration with auto-detected services. Use when setting up local development environment.
user-invocable: true
argument-hint: [project-name]
---

Create Docker Compose: $ARGUMENTS

## Services Context (Auto-Detected)

- **Project Name**: $ARGUMENTS
- **Database**: !`grep -r "postgres\|mysql\|mongodb" package.json pyproject.toml requirements.txt 2>/dev/null | head -1 | grep -oE 'postgres|mysql|mongodb' || echo "postgres (recommended)"`
- **Cache**: !`grep -r "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "redis" || echo "Not detected"`
- **App Port**: !`grep -r "PORT\|port" .env* package.json 2>/dev/null | head -1 | grep -oE '[0-9]{4}' || echo "3000"`
- **Database URL**: !`grep -r "DATABASE_URL" .env* 2>/dev/null | head -1 | cut -d'=' -f2 | grep -oE '[^@]+@[^:]+' || echo "postgres:postgres@db:5432"`

## Docker Compose Template

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "!`grep -r 'PORT\|port' .env* package.json 2>/dev/null | head -1 | grep -oE '[0-9]{4}' || echo \"3000\"`:!`grep -r 'PORT\|port' .env* package.json 2>/dev/null | head -1 | grep -oE '[0-9]{4}' || echo \"3000\"`"
    environment:
      - DATABASE_URL=!`grep -r "DATABASE_URL" .env* 2>/dev/null | head -1 | cut -d'=' -f2 || echo "postgresql://postgres:postgres@db:5432/$ARGUMENTS"`
!`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "      - REDIS_URL=redis://redis:6379" || echo "      # Add REDIS_URL if using Redis"`
    depends_on:
      db:
        condition: service_healthy
!`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "      redis:" || echo "      # Add redis dependency if needed"`
!`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "        condition: service_started" || echo ""`

  db:
    image: !`grep -r "postgres\|mysql\|mongodb" package.json pyproject.toml 2>/dev/null | head -1 | grep -oE 'postgres|mysql|mongodb' || echo "postgres"`:16-alpine
    environment:
      POSTGRES_DB: $ARGUMENTS
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

!`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "  redis:
    image: redis:7-alpine
    ports:
      - \"6379:6379\"
    volumes:
      - redis_data:/data" || echo "# Add Redis service if needed"`

volumes:
  postgres_data:
!`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "  redis_data:" || echo "# Add redis_data volume if using Redis"`
```

## Usage

1. Review detected services above
2. Save to: `docker-compose.yml`
3. Run: `docker-compose up -d`

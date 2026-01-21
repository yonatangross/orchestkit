---
name: create-docker-compose
description: Create Docker Compose configuration with auto-detected services. Use when setting up local development environment.
user-invocable: true
argument-hint: [project-name]
---

Create Docker Compose: $ARGUMENTS

## Services Context (Auto-Detected)

- **Project Name**: $ARGUMENTS
- **Database**: !`grep -r "postgres\|mysql\|mongodb" package.json pyproject.toml requirements.txt 2>/dev/null | head -1 | grep -oE 'postgres|mysql|mongodb' || echo "postgres"`
- **Cache**: !`grep -r "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "redis" || echo "none"`
- **App Port**: !`grep -r "PORT\|port" .env* package.json 2>/dev/null | head -1 | grep -oE '[0-9]{4}' || echo "3000"`
- **Has Redis**: !`grep -q "redis" package.json pyproject.toml requirements.txt 2>/dev/null && echo "Yes" || echo "No"`

## Your Task

Based on the detected context above, create a `docker-compose.yml` file.

Use the detected values to fill in the template below.

## Docker Compose Template (With Redis)

Use this if **Has Redis** is "Yes":

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${DETECTED_PORT}:${DETECTED_PORT}"  # Use detected App Port above
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/$ARGUMENTS
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Docker Compose Template (Without Redis)

Use this if **Has Redis** is "No":

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${DETECTED_PORT}:${DETECTED_PORT}"  # Use detected App Port above
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/$ARGUMENTS
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
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

volumes:
  postgres_data:
```

## Usage

1. Review detected services above
2. Choose template based on **Has Redis**
3. Replace `${DETECTED_PORT}` with detected App Port
4. Save to: `docker-compose.yml`
5. Run: `docker-compose up -d`

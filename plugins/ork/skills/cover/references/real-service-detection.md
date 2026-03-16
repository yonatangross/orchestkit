# Real-Service Detection

Detect and configure real-service infrastructure for integration tests. Real services catch bugs that mocks miss — mock/prod divergence caused silent failures in past incidents.

## Detection (Phase 1)

```python
# PARALLEL — scan for infrastructure:
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/docker-compose.test.yml")
Grep(pattern="testcontainers", glob="**/package.json", output_mode="content")
Grep(pattern="testcontainers", glob="**/requirements*.txt", output_mode="content")
Grep(pattern="testcontainers", glob="**/pyproject.toml", output_mode="content")
```

## Decision Matrix

| Found | Strategy | Test Speed |
|-------|----------|------------|
| `docker-compose.test.yml` | Start services via compose, run tests, tear down | ~30s startup |
| `docker-compose.yml` (no test variant) | Use with `--profile test` if available | ~30s startup |
| `testcontainers` in deps | Per-test isolated containers | ~5s per container |
| Neither + `--real-services` flag | Error: suggest installing testcontainers | N/A |
| Neither, no flag | Fall back to mocks (MSW/VCR) | ~0s |

## Docker-Compose Workflow

```bash
# Start services before tests
docker compose -f docker-compose.test.yml up -d --wait

# Run integration tests
npm run test:integration  # or pytest tests/integration/

# Tear down after tests
docker compose -f docker-compose.test.yml down -v
```

Services to look for in compose files:
- `postgres` / `mysql` / `mongodb` — database
- `redis` — cache/sessions
- `rabbitmq` / `kafka` — message queues
- `elasticsearch` / `opensearch` — search
- `minio` / `localstack` — S3-compatible storage

## Testcontainers Workflow

### TypeScript

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer()
    .withDatabase('test_db')
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
}, 30_000);

afterAll(async () => {
  await container.stop();
});
```

### Python

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url()
```

## Environment Variables

When real services are running, set connection strings:

| Service | Env Variable | Source |
|---------|-------------|--------|
| PostgreSQL | `DATABASE_URL` | `container.getConnectionUri()` |
| Redis | `REDIS_URL` | `redis://localhost:{mapped_port}` |
| MongoDB | `MONGODB_URI` | `container.getConnectionString()` |

## Cleanup

Always tear down services after tests:
- Docker-compose: `docker compose down -v` (removes volumes)
- Testcontainers: `container.stop()` in afterAll/fixture teardown
- Database state: transaction rollback or truncate between tests

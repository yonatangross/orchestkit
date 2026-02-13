# Migration Guide: v2 → v3 (Python) / v3 → v4 (JS)

## Python SDK: v2 → v3

### Import Changes

| v2 (Deprecated) | v3 (Current) |
|------------------|--------------|
| `from langfuse.decorators import observe` | `from langfuse import observe` |
| `from langfuse.decorators import langfuse_context` | `from langfuse import get_client` |
| `from langfuse import Langfuse` | `from langfuse import Langfuse` (unchanged) |
| `from langfuse.callback import CallbackHandler` | `from langfuse.callback import CallbackHandler` (unchanged) |

### API Changes

| v2 Pattern | v3 Pattern |
|------------|------------|
| `langfuse_context.update_current_observation(...)` | `get_client().update_current_observation(...)` |
| `langfuse_context.update_current_trace(...)` | `get_client().update_current_trace(...)` |
| `langfuse_context.flush()` | `get_client().flush()` |
| `langfuse.trace(name="foo")` (explicit) | Auto-created by first `@observe()` root span |
| `@observe()` (generation only) | `@observe(type="agent")` (7 new types) |

### Trace ID Format

| v2 | v3 |
|----|-----|
| UUID (`550e8400-e29b-41d4-a716-446655440000`) | W3C Trace Context (`4bf92f3577b34da6a3ce929d0e0e4736`) |

### Migration Example

```python
# ❌ v2 (DEPRECATED)
from langfuse.decorators import observe, langfuse_context

@observe()
async def analyze(content: str):
    langfuse_context.update_current_observation(
        metadata={"length": len(content)}
    )
    langfuse_context.update_current_trace(
        user_id="user_123",
        session_id="session_abc",
    )
    return await llm.generate(content)


# ✅ v3 (CURRENT)
from langfuse import observe, get_client

@observe()
async def analyze(content: str):
    get_client().update_current_observation(
        metadata={"length": len(content)}
    )
    get_client().update_current_trace(
        user_id="user_123",
        session_id="session_abc",
    )
    return await llm.generate(content)
```

### Explicit Trace Creation — Before/After

```python
# ❌ v2: Explicit trace creation
from langfuse import Langfuse
langfuse = Langfuse()
trace = langfuse.trace(
    name="analysis",
    user_id="user_123",
    session_id="session_abc",
)
generation = trace.generation(name="llm_call", model="claude-sonnet-4-5")


# ✅ v3: Auto-trace via @observe (preferred)
from langfuse import observe, get_client

@observe()  # First root @observe creates the trace automatically
async def analysis(content: str):
    get_client().update_current_trace(
        user_id="user_123",
        session_id="session_abc",
    )
    return await llm_call(content)

@observe(name="llm_call")
async def llm_call(content: str):
    get_client().update_current_observation(
        model="claude-sonnet-4-5-20250929",
    )
    return await llm.generate(content)
```

### Low-Level Client Still Works

```python
# Explicit Langfuse() client is still available for programmatic use
from langfuse import Langfuse

langfuse = Langfuse()

# Creating datasets, scoring, experiments — same API
dataset = langfuse.create_dataset(name="golden-v1")
langfuse.score(trace_id="...", name="quality", value=0.85)
```

## JavaScript/TypeScript SDK: v3 → v4

### Package Changes

| v3 (Deprecated) | v4 (Current) |
|------------------|--------------|
| `langfuse` (monolith) | `@langfuse/core` (base) |
| — | `@langfuse/tracing` (trace API) |
| — | `@langfuse/otel` (OTEL exporter) |
| `langfuse-langchain` | `@langfuse/langchain` |
| `langfuse-vercel` | `@langfuse/vercel` |

### Setup Changes

```typescript
// ❌ v3 (DEPRECATED)
import Langfuse from "langfuse";
const langfuse = new Langfuse({
  publicKey: "pk-...",
  secretKey: "sk-...",
});

// ✅ v4: Option A — Direct tracing
import { Langfuse } from "@langfuse/core";
const langfuse = new Langfuse({
  publicKey: "pk-...",
  secretKey: "sk-...",
});

// ✅ v4: Option B — OTEL-native (recommended)
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "@langfuse/otel";

const sdk = new NodeSDK({
  traceExporter: new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  }),
});
sdk.start();
```

### Tracing Changes

```typescript
// ❌ v3
const trace = langfuse.trace({ name: "analysis" });
const span = trace.span({ name: "retrieval" });
const generation = trace.generation({
  name: "llm_call",
  model: "claude-sonnet-4-5",
  input: messages,
});
generation.end({ output: response });
span.end();

// ✅ v4: OTEL spans
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-app");
await tracer.startActiveSpan("analysis", async (span) => {
  await tracer.startActiveSpan("retrieval", async (childSpan) => {
    // retrieval logic
    childSpan.end();
  });
  span.end();
});
```

## Self-Hosting v3 Architecture

Langfuse v3 self-hosting uses a new multi-service architecture:

```
┌─────────────────────────────────────────────────────────┐
│                  Langfuse v3 Architecture                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐     ┌──────────────┐                     │
│   │  Web UI  │────▶│  API Server  │                     │
│   └──────────┘     └──────┬───────┘                     │
│                           │                             │
│              ┌────────────┼────────────┐                │
│              ▼            ▼            ▼                │
│   ┌──────────────┐ ┌──────────┐ ┌──────────┐          │
│   │  ClickHouse  │ │  Redis   │ │ Postgres │          │
│   │  (analytics) │ │  (cache) │ │ (metadata)│          │
│   └──────────────┘ └──────────┘ └──────────┘          │
│              │                                          │
│              ▼                                          │
│   ┌──────────────┐                                     │
│   │  S3 / MinIO  │                                     │
│   │  (media/blob)│                                     │
│   └──────────────┘                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | Role | v2 Equivalent |
|-----------|------|---------------|
| **ClickHouse** | Analytics, traces, observations, scores | PostgreSQL (was single DB) |
| **PostgreSQL** | Metadata, users, projects, prompts | PostgreSQL |
| **Redis** | Caching, rate limiting, real-time features | Not required |
| **S3/MinIO** | Media storage, large payloads | Stored in PostgreSQL |

### Docker Compose (v3)

```yaml
# docker-compose.yml (Langfuse v3)
services:
  langfuse:
    image: langfuse/langfuse:3
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/langfuse
      CLICKHOUSE_URL: http://clickhouse:8123
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY_ID: minioadmin
      S3_SECRET_ACCESS_KEY: minioadmin
      S3_BUCKET_NAME: langfuse
    depends_on:
      - postgres
      - clickhouse
      - redis
      - minio

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: langfuse
      POSTGRES_PASSWORD: postgres

  clickhouse:
    image: clickhouse/clickhouse-server:24
    volumes:
      - clickhouse_data:/var/lib/clickhouse

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio
    command: server /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
```

### Helm Chart

```bash
# Kubernetes deployment
helm repo add langfuse https://langfuse.github.io/langfuse-helm
helm install langfuse langfuse/langfuse \
  --set clickhouse.enabled=true \
  --set redis.enabled=true \
  --set postgresql.enabled=true \
  --set s3.enabled=true
```

## ClickHouse Acquisition (Jan 16, 2026)

ClickHouse Inc. acquired Langfuse on January 16, 2026. Key implications:

- **Langfuse remains open-source** under the same license
- **ClickHouse becomes the default analytics backend** (was already used in v3)
- **Cloud offering** continues at cloud.langfuse.com, now backed by ClickHouse Cloud
- **Self-hosting** remains fully supported
- **No SDK breaking changes** from the acquisition — v3 Python and v4 JS SDKs unchanged
- **Performance improvements** expected from deeper ClickHouse integration

## Breaking Changes Checklist

### Python v2 → v3

- [ ] Replace `from langfuse.decorators import observe` → `from langfuse import observe`
- [ ] Replace `from langfuse.decorators import langfuse_context` → `from langfuse import get_client`
- [ ] Replace all `langfuse_context.update_current_observation()` → `get_client().update_current_observation()`
- [ ] Replace all `langfuse_context.update_current_trace()` → `get_client().update_current_trace()`
- [ ] Remove explicit `langfuse.trace()` calls where `@observe()` creates auto-traces
- [ ] Update trace ID handling if relying on UUID format (now W3C)
- [ ] Add `type=` parameter to `@observe()` for new observation types
- [ ] Update `requirements.txt`: `langfuse>=3.13.0`

### JavaScript v3 → v4

- [ ] Replace `langfuse` package with `@langfuse/core` + `@langfuse/otel`
- [ ] Update imports from `langfuse` → `@langfuse/core`
- [ ] Replace `langfuse-langchain` → `@langfuse/langchain`
- [ ] Set up OTEL exporter for automatic tracing
- [ ] Update `package.json` dependencies

## References

- [Python SDK v3 Migration](https://langfuse.com/docs/sdk/python/v3-migration)
- [JS SDK v4 Migration](https://langfuse.com/docs/sdk/typescript/v4-migration)
- [Self-Hosting Guide](https://langfuse.com/docs/deployment/self-host)
- [ClickHouse Acquisition](https://langfuse.com/blog/clickhouse-acquisition)

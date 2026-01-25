# Structured Logging

JSON logging best practices for production systems.

## Why Structured Logging?

- **Searchable** - query by fields (user_id, trace_id)
- **Machine-readable** - parse and aggregate easily
- **Contextual** - attach metadata to every log

## Python (structlog)

```python
import structlog

logger = structlog.get_logger()

logger.info("user_login", user_id="123", ip="192.168.1.1")
# Output: {"event": "user_login", "user_id": "123", "ip": "192.168.1.1", "timestamp": "2025-12-19T10:00:00Z"}
```

## Node.js (pino)

```typescript
import pino from 'pino';

const logger = pino();

logger.info({ userId: '123', action: 'login' }, 'User logged in');
// Output: {"level":30,"userId":"123","action":"login","msg":"User logged in","time":1702990800000}
```

## Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| **DEBUG** | Development only | Variable values, function calls |
| **INFO** | Normal operations | User actions, workflow steps |
| **WARN** | Recoverable issues | Retries, deprecated API usage |
| **ERROR** | Failures | Exceptions, failed requests |
| **CRITICAL** | System failure | Database down, out of memory |

## Best Practices

1. **Always include trace_id** - correlate across services
2. **Log at boundaries** - API requests/responses, DB queries
3. **Don't log secrets** - mask passwords, API keys
4. **Use correlation IDs** - track requests across microservices

See `scripts/structured-logging.ts` for implementation.

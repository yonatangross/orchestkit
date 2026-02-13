# FastAPI Production Checklist

## Application Setup

### Lifespan Management

- [ ] Use `asynccontextmanager` lifespan (not deprecated events)
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # startup
      yield
      # shutdown
  ```

- [ ] Initialize all connections in lifespan:
  - [ ] Database engine with connection pool
  - [ ] Redis client
  - [ ] Task queue (ARQ/Celery)
  - [ ] LLM clients

- [ ] Cleanup all resources on shutdown (reverse order)
- [ ] Verify connections on startup (ping/SELECT 1)
- [ ] Handle graceful shutdown with active connections

### Configuration

- [ ] Use Pydantic Settings for configuration:
  ```python
  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file=".env")
  ```

- [ ] Validate settings on startup
- [ ] Use `@lru_cache` for settings singleton
- [ ] Don't hardcode secrets

### Response Class

- [ ] Use ORJSONResponse for better performance:
  ```python
  app = FastAPI(default_response_class=ORJSONResponse)
  ```

## Middleware Stack

### Order (add in reverse)

- [ ] Rate Limiting (innermost)
- [ ] Authentication
- [ ] Logging
- [ ] Timing
- [ ] Request ID
- [ ] CORS (outermost)

### Required Middleware

- [ ] **CORS**: Configure for your domains
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

- [ ] **Request ID**: Generate unique ID per request
- [ ] **Timing**: Track response time
- [ ] **Logging**: Structured request logging

## Dependency Injection

### Database Session

- [ ] Use async session with proper transaction handling:
  ```python
  async def get_db(request: Request):
      async with AsyncSession(request.app.state.db_engine) as session:
          try:
              yield session
              await session.commit()
          except Exception:
              await session.rollback()
              raise
  ```

### Service Dependencies

- [ ] Inject dependencies, don't instantiate in routes
- [ ] Use factories for complex dependencies
- [ ] Consider dependency caching for expensive operations

## Error Handling

### Exception Handlers

- [ ] Register handler for custom exceptions
- [ ] Register handler for validation errors
- [ ] Register handler for database errors
- [ ] Register catch-all for unexpected errors

### RFC 9457 Problem Details

- [ ] Return `application/problem+json` for errors
- [ ] Include required fields: type, status
- [ ] Include trace ID in error responses
- [ ] Don't leak internal details in production

## Security

### Authentication

- [ ] Use HTTPBearer for JWT:
  ```python
  security = HTTPBearer()
  ```
- [ ] Validate tokens in dependency
- [ ] Set appropriate token expiry (15min access, 7d refresh)
- [ ] Use bcrypt for password hashing (cost >= 12)

### Input Validation

- [ ] Use Pydantic models for all request bodies
- [ ] Validate path/query parameters
- [ ] Sanitize user input
- [ ] Use `Field()` constraints

### Headers

- [ ] Add security headers:
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `Strict-Transport-Security`
- [ ] Use HTTPS in production

## Performance

### Async Best Practices

- [ ] Use async database driver (asyncpg)
- [ ] Use async Redis client
- [ ] Don't block event loop with sync operations
- [ ] Use `run_in_executor` for blocking I/O if needed

### Connection Pooling

- [ ] Configure database pool size:
  ```python
  create_async_engine(
      url,
      pool_size=5,
      max_overflow=10,
      pool_pre_ping=True,
  )
  ```

- [ ] Configure Redis max connections

### Caching

- [ ] Cache expensive computations
- [ ] Use proper TTLs
- [ ] Implement cache invalidation

## Observability

### Logging

- [ ] Use structured logging (structlog)
- [ ] Include request ID in all logs
- [ ] Log at appropriate levels
- [ ] Don't log sensitive data

### Metrics

- [ ] Track request latency
- [ ] Track error rates
- [ ] Track cache hit rates
- [ ] Track queue depth

### Health Checks

- [ ] Implement `/health` endpoint
- [ ] Check all dependencies
- [ ] Return proper status codes:
  - [ ] 200 for healthy
  - [ ] 503 for unhealthy

## Documentation

### OpenAPI

- [ ] Add descriptions to all routes
- [ ] Document all response codes
- [ ] Include request/response examples
- [ ] Tag routes appropriately

### API Info

- [ ] Set app title and description
- [ ] Set version
- [ ] Configure docs URL

## Testing

### Test Configuration

- [ ] Use test database
- [ ] Mock external services
- [ ] Use pytest-asyncio

### Test Coverage

- [ ] Unit tests for business logic
- [ ] Integration tests for routes
- [ ] Test error handling
- [ ] Test authentication

## Deployment

### Docker

- [ ] Multi-stage build
- [ ] Non-root user
- [ ] Health check in Dockerfile

### Kubernetes

- [ ] Readiness probe
- [ ] Liveness probe
- [ ] Resource limits
- [ ] Horizontal pod autoscaler

### Environment Variables

- [ ] All secrets from environment
- [ ] Different configs per environment
- [ ] Validate required variables on startup

## Quick Reference

| Concern | Solution |
|---------|----------|
| Startup/Shutdown | `asynccontextmanager` lifespan |
| Config | Pydantic Settings |
| DB Session | Dependency with context manager |
| Auth | HTTPBearer + JWT validation |
| Errors | RFC 9457 Problem Details |
| Logging | Structlog with request ID |
| Response | ORJSONResponse |
| Middleware | CORS → RequestID → Timing → Logging → Auth → RateLimit |

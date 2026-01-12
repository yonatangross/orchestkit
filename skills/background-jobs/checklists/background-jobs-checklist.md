# Background Jobs Implementation Checklist

## Planning

### Task Identification

- [ ] Identify operations that should be background tasks:
  - [ ] Email/notification sending
  - [ ] File processing/uploads
  - [ ] External API calls
  - [ ] Report generation
  - [ ] Data aggregation
  - [ ] Cleanup operations

- [ ] Categorize by type:
  - [ ] Fire-and-forget (no result needed)
  - [ ] Result-needed (async query for result)
  - [ ] Scheduled/periodic
  - [ ] Triggered by events

### Library Selection

- [ ] Choose task queue library:
  - [ ] **ARQ**: FastAPI, simple async tasks, Redis only
  - [ ] **Celery**: Complex workflows, multiple brokers
  - [ ] **Dramatiq**: Alternative to Celery, simpler

## Implementation

### Worker Setup

- [ ] Configure worker settings:
  ```python
  class WorkerSettings:
      redis_settings = RedisSettings(...)
      functions = [task1, task2]
      max_jobs = 10
      job_timeout = 300
  ```

- [ ] Implement lifecycle hooks:
  - [ ] `on_startup`: Initialize connections
  - [ ] `on_shutdown`: Cleanup resources

- [ ] Configure concurrency:
  - [ ] Max concurrent jobs
  - [ ] Job timeout
  - [ ] Queue priorities

### Task Definition

- [ ] Define tasks with proper signatures:
  ```python
  async def my_task(ctx: dict, arg1: str, arg2: int) -> dict:
      ...
  ```

- [ ] Add logging to all tasks:
  ```python
  logger.info("task_started", task="my_task", args={"arg1": arg1})
  ```

- [ ] Handle errors appropriately:
  - [ ] Catch transient errors and retry
  - [ ] Log failures with context
  - [ ] Update status on failure

### FastAPI Integration

- [ ] Initialize task queue in lifespan:
  ```python
  app.state.arq = await create_pool(settings)
  ```

- [ ] Create dependency for queue access:
  ```python
  async def get_queue(request: Request) -> ArqRedis:
      return request.app.state.arq
  ```

- [ ] Enqueue from routes:
  ```python
  job = await queue.enqueue_job("task_name", arg1=value)
  ```

## Reliability

### Retry Handling

- [ ] Configure retry settings:
  - [ ] `max_tries`: Maximum retry attempts
  - [ ] `retry_delay`: Delay between retries
  - [ ] Exponential backoff if needed

- [ ] Use `Retry` exception for explicit retries:
  ```python
  raise Retry(defer=60)  # Retry in 60 seconds
  ```

### Idempotency

- [ ] Make tasks idempotent (safe to run multiple times):
  ```python
  if await redis.get(f"processed:{id}"):
      return {"status": "already_processed"}
  ```

- [ ] Use idempotency keys for external calls
- [ ] Check state before modifying

### Error Handling

- [ ] Handle expected errors gracefully
- [ ] Log unexpected errors with full context
- [ ] Update job/entity status on failure
- [ ] Consider dead letter queue for failures

## Monitoring

### Metrics

- [ ] Track key metrics:
  - [ ] Queue depth (pending jobs)
  - [ ] Processing time (p50, p95, p99)
  - [ ] Success/failure rate
  - [ ] Retry rate

### Logging

- [ ] Log at key points:
  - [ ] Task started
  - [ ] Task completed (with duration)
  - [ ] Task failed (with error)
  - [ ] Task retrying

### Alerting

- [ ] Set up alerts for:
  - [ ] High queue depth (jobs backing up)
  - [ ] High failure rate
  - [ ] Long processing time
  - [ ] Worker crashes

## Operations

### Deployment

- [ ] Separate worker deployment from API
- [ ] Configure worker replicas (horizontal scaling)
- [ ] Health check endpoint for workers
- [ ] Graceful shutdown handling

### Docker/Kubernetes

```yaml
# Worker deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: worker
          command: ["arq", "app.tasks.worker.WorkerSettings"]
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
```

### Scaling

- [ ] Configure auto-scaling based on:
  - [ ] Queue depth
  - [ ] CPU usage
  - [ ] Custom metrics

## Testing

### Unit Tests

- [ ] Test task logic with mocked dependencies:
  ```python
  async def test_send_email(mock_ctx):
      result = await send_email(mock_ctx, "to@example.com", "Subject", "Body")
      assert result["status"] == "sent"
  ```

### Integration Tests

- [ ] Test with real Redis
- [ ] Test retry behavior
- [ ] Test timeout behavior
- [ ] Test scheduled tasks

### Load Tests

- [ ] Test worker under load
- [ ] Test queue depth limits
- [ ] Test recovery from failures

## Job Status API

- [ ] Implement job status endpoint:
  ```python
  @router.get("/jobs/{job_id}")
  async def get_job_status(job_id: str):
      ...
  ```

- [ ] Return useful status info:
  - [ ] Current status (pending, running, completed, failed)
  - [ ] Enqueue time
  - [ ] Start time
  - [ ] Finish time
  - [ ] Result (if completed)
  - [ ] Error (if failed)

## Scheduled Tasks

- [ ] Define cron schedules:
  ```python
  cron_jobs = [
      cron(cleanup_task, hour=3, minute=0),  # 3 AM daily
      cron(report_task, weekday=0, hour=9),  # Monday 9 AM
  ]
  ```

- [ ] Handle missed schedules (run immediately vs skip)
- [ ] Prevent duplicate runs (locking)
- [ ] Log scheduled task execution

## Quick Reference

| Pattern | Use Case | Example |
|---------|----------|---------|
| Fire & Forget | Notifications | Send email |
| Delayed | Reminders | Send after 1 hour |
| Scheduled | Cleanup | Daily at 3 AM |
| Chain | Workflows | Download → Process → Upload |
| Group | Batch | Process all items in parallel |

## Common Pitfalls

- [ ] **Not handling retries**: Always configure retry behavior
- [ ] **Long-running tasks**: Break into smaller tasks or use chunking
- [ ] **Missing idempotency**: Tasks may run multiple times
- [ ] **No monitoring**: Add logging and metrics from day one
- [ ] **Ignoring timeouts**: Configure appropriate timeouts
- [ ] **No graceful shutdown**: Handle SIGTERM properly

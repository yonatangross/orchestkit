# Result Backends

Task result storage, custom states, progress tracking, and rate limiting patterns.

## Redis Result Backend

```python
# celery_config.py
celery_app.conf.update(
    result_backend="redis://redis:6379/1",
    result_serializer="json",
    result_expires=86400,  # 24 hours
    result_backend_transport_options={
        "global_keyprefix": "celery_result:",
    },
)
```

## Custom Task States

```python
from celery import states

# Define custom states
VALIDATING = "VALIDATING"
PROCESSING = "PROCESSING"
UPLOADING = "UPLOADING"

@celery_app.task(bind=True)
def long_running_task(self, data: dict) -> dict:
    """Task with progress tracking via custom states."""
    self.update_state(
        state=VALIDATING,
        meta={"step": 1, "total": 3, "description": "Validating input"},
    )
    validated = validate(data)

    self.update_state(
        state=PROCESSING,
        meta={"step": 2, "total": 3, "description": "Processing data"},
    )
    result = process(validated)

    self.update_state(
        state=UPLOADING,
        meta={"step": 3, "total": 3, "description": "Uploading results"},
    )
    upload(result)

    return {"status": "complete", "url": result.url}
```

## Progress Tracking API

```python
from celery.result import AsyncResult

@router.get("/api/v1/jobs/{job_id}")
async def get_job_status(job_id: str) -> dict:
    """Query task progress and result."""
    result = AsyncResult(job_id, app=celery_app)

    response = {
        "job_id": job_id,
        "status": result.status,
    }

    if result.status == "PROGRESS" or result.status in (VALIDATING, PROCESSING, UPLOADING):
        response["progress"] = result.info
    elif result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)

    return response

# Batch status check
@router.post("/api/v1/jobs/batch-status")
async def batch_job_status(job_ids: list[str]) -> dict:
    """Check status of multiple jobs at once."""
    statuses = {}
    for job_id in job_ids:
        result = AsyncResult(job_id, app=celery_app)
        statuses[job_id] = {
            "status": result.status,
            "ready": result.ready(),
        }
    return {"jobs": statuses}
```

## Large Result Handling

```python
import boto3

@celery_app.task(bind=True)
def generate_report(self, report_id: str) -> dict:
    """Store large results in S3, return reference only."""
    self.update_state(state="PROCESSING", meta={"step": "generating"})

    # Generate large report
    pdf_bytes = render_pdf(report_id)

    # Store in S3 (NEVER store large data in Redis result backend)
    s3 = boto3.client("s3")
    s3_key = f"reports/{report_id}/{datetime.now().isoformat()}.pdf"
    s3.put_object(
        Bucket="reports-bucket",
        Key=s3_key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )

    # Return only the reference
    return {
        "report_id": report_id,
        "s3_key": s3_key,
        "size_bytes": len(pdf_bytes),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
```

## Job Status Lifecycle

```
PENDING → STARTED → SUCCESS
                  → FAILURE
                  → RETRY → STARTED → ...
                  → REVOKED

Custom states:
PENDING → STARTED → VALIDATING → PROCESSING → UPLOADING → SUCCESS
```

## Rate Limiting

### Static Rate Limits

```python
@celery_app.task(rate_limit="100/m")  # 100 per minute
def call_external_api(endpoint: str) -> dict:
    return requests.get(endpoint, timeout=30).json()

@celery_app.task(rate_limit="10/s")   # 10 per second
def send_push_notification(user_id: str, message: str):
    push_service.send(user_id, message)
```

### Dynamic Rate Limiting

```python
from celery import current_app

class RateLimitManager:
    def __init__(self, app):
        self.app = app
        self.defaults = {
            "tasks.call_external_api": "100/m",
            "tasks.send_notification": "10/s",
        }

    def adjust_rate(self, task_name: str, new_rate: str, workers=None):
        self.app.control.rate_limit(task_name, new_rate, destination=workers)

    def reduce_for_high_load(self, factor: float = 0.5):
        for task, rate in self.defaults.items():
            value, unit = int(rate.split("/")[0]), rate.split("/")[1]
            new_rate = f"{int(value * factor)}/{unit}"
            self.adjust_rate(task, new_rate)

    def restore_defaults(self):
        for task, rate in self.defaults.items():
            self.adjust_rate(task, rate)
```

### Token Bucket Rate Limiter

```python
from celery import Task
import time

class TokenBucketTask(Task):
    """Distributed token bucket rate limiting."""
    abstract = True
    rate_limit_key: str = None
    tokens_per_second: float = 10.0
    bucket_size: int = 100

    def acquire_token(self) -> bool:
        key = f"rate_limit:{self.rate_limit_key}"
        now = time.time()

        # Atomic Lua script for token bucket
        script = """
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local rate = tonumber(ARGV[2])
        local capacity = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
        local tokens = tonumber(bucket[1]) or capacity
        local last_update = tonumber(bucket[2]) or now

        local elapsed = now - last_update
        tokens = math.min(capacity, tokens + elapsed * rate)

        if tokens >= 1 then
            tokens = tokens - 1
            redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
            redis.call('EXPIRE', key, 3600)
            return 1
        end
        return 0
        """
        return bool(redis_client.eval(script, 1, key, now, self.tokens_per_second, self.bucket_size))

    def __call__(self, *args, **kwargs):
        if not self.acquire_token():
            countdown = 2 ** min(self.request.retries, 6)
            raise self.retry(countdown=countdown)
        return super().__call__(*args, **kwargs)

# Usage
@celery_app.task(
    base=TokenBucketTask,
    bind=True,
    rate_limit_key="stripe_api",
    tokens_per_second=25,
    bucket_size=100,
)
def charge_customer(self, customer_id: str, amount: int):
    return stripe.PaymentIntent.create(customer=customer_id, amount=amount, currency="usd")
```

## Rate Limit Patterns Summary

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Static | Simple API quotas | `@task(rate_limit="100/m")` |
| Dynamic | Adaptive to load | `app.control.rate_limit()` |
| Token bucket | Smooth burst handling | Custom Task base class |
| Per-user | Multi-tenant fairness | User-keyed counters |

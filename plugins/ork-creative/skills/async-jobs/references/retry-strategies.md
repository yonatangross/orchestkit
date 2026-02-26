# Retry Strategies

Exponential backoff, idempotency, dead letter queues, and task locking patterns.

## Exponential Backoff with Jitter

```python
from celery import shared_task

@shared_task(
    bind=True,
    max_retries=5,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,        # Exponential: 1s, 2s, 4s, 8s, 16s
    retry_backoff_max=600,     # Cap at 10 minutes
    retry_jitter=True,         # Randomize to prevent thundering herd
)
def call_external_api(self, endpoint: str) -> dict:
    """Task with automatic retry on transient failures."""
    response = requests.get(endpoint, timeout=30)
    response.raise_for_status()
    return response.json()
```

## Manual Retry with Custom Delay

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email(self, to: str, subject: str, body: str) -> dict:
    """Manual retry with explicit error handling."""
    try:
        response = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            json={"to": to, "subject": subject, "html": body},
            headers={"Authorization": f"Bearer {SENDGRID_KEY}"},
            timeout=30,
        )
        response.raise_for_status()
        return {"status": "sent", "to": to}
    except requests.ConnectionError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)
    except requests.HTTPError as exc:
        if exc.response.status_code >= 500:
            raise self.retry(exc=exc)  # Server error: retry
        raise  # Client error: fail immediately
```

## Base Task with Retry Configuration

```python
from celery import Task

class RetryableTask(Task):
    """Reusable base task with exponential backoff."""
    abstract = True
    autoretry_for = (ConnectionError, TimeoutError)
    max_retries = 5
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True

class DatabaseTask(Task):
    """Base task with database session management."""
    abstract = True
    _db = None

    @property
    def db(self):
        if self._db is None:
            self._db = create_session()
        return self._db

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        if self._db:
            self._db.close()
            self._db = None

# Usage
@celery_app.task(base=RetryableTask)
def call_flaky_api(endpoint: str):
    return requests.get(endpoint, timeout=30).json()

@celery_app.task(base=DatabaseTask)
def query_database(query: str):
    return query_database.db.execute(query)
```

## Idempotency Protection

```python
@shared_task(bind=True, max_retries=3, retry_backoff=True)
def process_payment(self, payment_id: str, amount: int) -> dict:
    """Idempotent task — safe to retry without duplicates."""
    idempotency_key = f"processed:payment:{payment_id}"

    # Check if already processed
    if redis_client.get(idempotency_key):
        return {"status": "already_processed", "payment_id": payment_id}

    try:
        # Process payment
        result = stripe.PaymentIntent.create(
            customer=get_customer(payment_id),
            amount=amount,
            currency="usd",
            idempotency_key=f"celery:{payment_id}",  # Stripe-level idempotency
        )

        # Mark as processed with 24h TTL
        redis_client.setex(idempotency_key, 86400, "1")

        return {"status": "success", "payment_id": payment_id, "intent_id": result.id}
    except stripe.error.RateLimitError as exc:
        raise self.retry(exc=exc, countdown=60)
    except stripe.error.InvalidRequestError:
        raise  # Non-retryable
```

## Dead Letter Queue

```python
from celery import signals

@shared_task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
)
def important_task(self, data: dict) -> dict:
    """Task that moves to DLQ after exhausting retries."""
    try:
        return do_processing(data)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            move_to_dlq(self, data, exc)
            raise  # Let Celery mark as failed
        raise self.retry(exc=exc)

def move_to_dlq(task, data: dict, error: Exception):
    """Move failed task to dead letter queue for manual review."""
    from datetime import datetime, timezone

    dlq_entry = {
        "task_name": task.name,
        "task_id": task.request.id,
        "args": data,
        "error": str(error),
        "retries": task.request.retries,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    redis_client.lpush(f"dlq:{task.name}", json.dumps(dlq_entry))

# DLQ processing
def process_dlq(task_name: str, limit: int = 10):
    """Process dead letter queue entries."""
    dlq_key = f"dlq:{task_name}"
    entries = []

    for _ in range(limit):
        raw = redis_client.rpop(dlq_key)
        if not raw:
            break
        entries.append(json.loads(raw))

    return entries
```

## Task Locking (Singleton Tasks)

```python
@shared_task(bind=True)
def singleton_task(self, resource_id: str) -> dict:
    """Only one instance runs per resource at a time."""
    lock_key = f"lock:{self.name}:{resource_id}"

    if not redis_client.set(lock_key, "1", nx=True, ex=300):
        return {"status": "already_running", "resource_id": resource_id}

    try:
        result = do_exclusive_work(resource_id)
        return {"status": "completed", "result": result}
    finally:
        redis_client.delete(lock_key)
```

## Retry Pattern Summary

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Auto retry | Transient errors | `autoretry_for` + `retry_backoff` |
| Manual retry | Conditional retry | `self.retry(exc=exc, countdown=N)` |
| Idempotency | Payment, creation | Redis key check before processing |
| DLQ | Failed after retries | Move to Redis list for review |
| Singleton | Exclusive tasks | Redis lock with TTL |
| Base class | Shared config | Custom Task subclass |

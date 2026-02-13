---
title: "Saga Recovery & Idempotency"
impact: HIGH
impactDescription: "Saga recovery handles stuck and failed transactions — without timeout recovery and idempotency, systems accumulate orphaned transactions"
tags: saga, recovery, timeout, retry, idempotency, backoff
---

# Saga Recovery & Idempotency

## Timeout and Recovery

```python
from datetime import timedelta
import asyncio

class SagaRecovery:
    def __init__(self, saga_repo, orchestrator):
        self.repo = saga_repo
        self.orchestrator = orchestrator

    async def recover_stuck_sagas(self, timeout: timedelta = timedelta(hours=1)):
        cutoff = datetime.now(timezone.utc) - timeout
        stuck_sagas = await self.repo.find_by_status_and_age(SagaStatus.RUNNING, cutoff)

        for saga in stuck_sagas:
            try:
                await self.orchestrator.resume(saga)
            except Exception:
                await self.orchestrator._compensate(saga, saga.current_step)

    async def retry_failed_step(self, saga_id: str, max_retries: int = 3):
        saga = await self.repo.get(saga_id)
        failed_step = saga.steps[saga.current_step]

        for attempt in range(max_retries):
            try:
                failed_step.result = await failed_step.action(saga.data)
                failed_step.status = SagaStatus.COMPLETED
                await self.orchestrator.resume(saga, from_step=saga.current_step + 1)
                return
            except Exception:
                await asyncio.sleep(2 ** attempt)

        await self.orchestrator._compensate(saga, saga.current_step)
```

## Idempotent Saga Steps

```python
class IdempotentSagaStep:
    def __init__(self, step_name: str, idempotency_store):
        self.step_name = step_name
        self.store = idempotency_store

    async def execute(self, saga_id: str, action: Callable, *args, **kwargs):
        idempotency_key = f"{saga_id}:{self.step_name}"
        existing = await self.store.get(idempotency_key)
        if existing:
            return existing["result"]

        result = await action(*args, **kwargs)
        await self.store.set(idempotency_key, {"result": result}, ttl=timedelta(days=7))
        return result
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| State storage | Persistent store (PostgreSQL) for saga state |
| Idempotency | Required for all saga steps |
| Timeouts | Per-step timeouts with recovery worker |
| Compensation | Always implement, test thoroughly |
| Observability | Trace saga ID across all services |
| Retry | Exponential backoff with max retries |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER ignore idempotency
async def _create_order(self, data: dict):
    return await self.db.insert(Order(**data))  # Duplicate on retry!

# NEVER use in-memory saga state
sagas = {}  # Lost on restart!

# ALWAYS persist saga state and test compensation paths
```

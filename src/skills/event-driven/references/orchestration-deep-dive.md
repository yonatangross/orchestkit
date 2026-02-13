# Saga Orchestration Deep Dive

Central coordinator pattern for distributed transactions with explicit control flow.

## When to Use Orchestration

- Complex, ordered workflows with dependencies between steps
- Need centralized visibility and monitoring
- Business logic requires conditional branching
- Team prefers explicit over implicit coordination
- Debugging and tracing are priorities

## Architecture (2026 Best Practices)

```
                    +------------------+
                    |   Orchestrator   |
                    |  (State Machine) |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
+---------------+    +---------------+    +---------------+
| Inventory Svc |    | Payment Svc   |    | Shipping Svc  |
+---------------+    +---------------+    +---------------+
        |                    |                    |
        v                    v                    v
+---------------+    +---------------+    +---------------+
|  Inventory DB |    |  Payment DB   |    |  Shipping DB  |
+---------------+    +---------------+    +---------------+
```

## Orchestrator State Persistence

**CRITICAL**: Always persist saga state to survive restarts.

```python
from sqlalchemy import Column, String, JSON, DateTime, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
import enum

class SagaStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    FAILED = "failed"

class SagaState(Base):
    """Persistent saga state - survives crashes and restarts."""
    __tablename__ = "saga_states"

    id = Column(UUID(as_uuid=True), primary_key=True)
    saga_type = Column(String(100), nullable=False, index=True)
    status = Column(Enum(SagaStatus), default=SagaStatus.PENDING)
    current_step = Column(Integer, default=0)
    data = Column(JSON, default=dict)
    step_results = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))
    timeout_at = Column(DateTime)  # For recovery
    version = Column(Integer, default=1)  # Optimistic locking
```

## Step Execution with Outbox Pattern

Combine saga steps with outbox for atomic state + event publishing:

```python
async def execute_step(
    self,
    saga: SagaState,
    step: SagaStep,
    db: AsyncSession,
) -> StepResult:
    """Execute step with atomic state update and event publishing."""
    async with db.begin():
        # 1. Execute step action
        result = await step.action(saga.data)

        # 2. Update saga state
        saga.current_step += 1
        saga.data.update(result.data)
        saga.step_results.append(result.to_dict())

        # 3. Write to outbox (same transaction!)
        outbox_event = OutboxMessage(
            aggregate_type="Saga",
            aggregate_id=saga.id,
            event_type=f"saga.{saga.saga_type}.step.{step.name}.completed",
            payload={"saga_id": str(saga.id), "step": step.name, "result": result.data},
        )
        db.add(outbox_event)

        # 4. Commit atomically
        await db.flush()

    return result
```

## Compensation Order

**ALWAYS compensate in reverse order** - later steps may depend on earlier ones:

```
Forward:  Step1 -> Step2 -> Step3 -> [FAILURE]
Reverse:  Step3 <- Step2 <- Step1  (compensation)
```

## Orchestrator Recovery

Handle orchestrator crashes mid-saga:

```python
class SagaRecoveryService:
    """Recover sagas stuck due to orchestrator failures."""

    async def recover_stuck_sagas(self, timeout_minutes: int = 30):
        """Find and recover sagas stuck in RUNNING state."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)

        stmt = (
            select(SagaState)
            .where(SagaState.status == SagaStatus.RUNNING)
            .where(SagaState.updated_at < cutoff)
            .with_for_update(skip_locked=True)
        )

        async with self.db.begin():
            result = await self.db.execute(stmt)
            stuck_sagas = result.scalars().all()

            for saga in stuck_sagas:
                await self._recover_saga(saga)

    async def _recover_saga(self, saga: SagaState):
        """Decide whether to resume or compensate."""
        last_step = saga.current_step
        step_def = self.get_step_definition(saga.saga_type, last_step)

        if step_def.is_idempotent:
            # Safe to retry
            await self.orchestrator.resume(saga)
        else:
            # Compensate from last completed step
            await self.orchestrator.compensate(saga, from_step=last_step - 1)
```

## Key Patterns

| Pattern | Description |
|---------|-------------|
| Outbox integration | Atomic state + events |
| Optimistic locking | Prevent concurrent modifications |
| Idempotent steps | Safe to retry |
| Step timeouts | Prevent infinite hangs |
| Recovery service | Handle orchestrator failures |

# Event Store Setup

Event store configuration for CQRS with PostgreSQL.

## Database Schema

### Core Event Store Table

```sql
-- Main event store with optimistic concurrency
CREATE TABLE event_store (
    -- Identity
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,

    -- Event data
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Versioning (critical for optimistic concurrency)
    version INT NOT NULL,

    -- Global ordering for projections
    sequence_number BIGSERIAL NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, version)
);

-- Essential indexes
CREATE INDEX idx_event_store_aggregate ON event_store (aggregate_id, version);
CREATE INDEX idx_event_store_type ON event_store (event_type);
CREATE INDEX idx_event_store_sequence ON event_store (sequence_number);
CREATE INDEX idx_event_store_created ON event_store (created_at);

-- Partial index for recent events (projection catch-up)
CREATE INDEX idx_event_store_recent ON event_store (sequence_number)
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Projection Checkpoints

```sql
CREATE TABLE projection_checkpoints (
    projection_name VARCHAR(100) PRIMARY KEY,
    last_sequence_number BIGINT NOT NULL DEFAULT 0,
    last_event_id UUID,
    last_processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    events_processed BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',  -- running, paused, rebuilding
    error_message TEXT
);
```

### Snapshots Table

```sql
CREATE TABLE snapshots (
    aggregate_id UUID PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_type ON snapshots (aggregate_type);
```

## SQLAlchemy Models

```python
from sqlalchemy import (
    Column, String, Integer, BigInteger, DateTime, Text,
    UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base
from datetime import datetime, timezone
import uuid

Base = declarative_base()

class EventStoreModel(Base):
    __tablename__ = "event_store"

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aggregate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    aggregate_type = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False, index=True)
    event_data = Column(JSONB, nullable=False)
    metadata = Column(JSONB, default={})
    version = Column(Integer, nullable=False)
    sequence_number = Column(BigInteger, autoincrement=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("aggregate_id", "version", name="unique_aggregate_version"),
        Index("idx_aggregate_version", "aggregate_id", "version"),
    )


class ProjectionCheckpointModel(Base):
    __tablename__ = "projection_checkpoints"

    projection_name = Column(String(100), primary_key=True)
    last_sequence_number = Column(BigInteger, default=0)
    last_event_id = Column(UUID(as_uuid=True))
    last_processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    events_processed = Column(BigInteger, default=0)
    status = Column(String(20), default="running")
    error_message = Column(Text)


class SnapshotModel(Base):
    __tablename__ = "snapshots"

    aggregate_id = Column(UUID(as_uuid=True), primary_key=True)
    aggregate_type = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False)
    state = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

## Event Store Implementation

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, func
from sqlalchemy.exc import IntegrityError

class PostgresEventStore:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def append(
        self,
        aggregate_id: UUID,
        events: list["DomainEvent"],
        expected_version: int,
    ) -> None:
        """Append events with optimistic concurrency."""
        async with self.session_factory() as session:
            async with session.begin():
                # Check current version
                current = await self._get_version(session, aggregate_id)
                if current != expected_version:
                    raise ConcurrencyError(
                        f"Expected version {expected_version}, got {current}"
                    )

                # Append events
                for i, event in enumerate(events):
                    session.add(EventStoreModel(
                        event_id=event.event_id,
                        aggregate_id=aggregate_id,
                        aggregate_type=event.aggregate_type,
                        event_type=event.event_type,
                        event_data=event.model_dump(mode="json"),
                        metadata=event.metadata,
                        version=expected_version + i + 1,
                    ))

    async def get_events(
        self,
        aggregate_id: UUID,
        after_version: int = 0,
    ) -> list["DomainEvent"]:
        """Load events for an aggregate."""
        async with self.session_factory() as session:
            result = await session.execute(
                select(EventStoreModel)
                .where(EventStoreModel.aggregate_id == aggregate_id)
                .where(EventStoreModel.version > after_version)
                .order_by(EventStoreModel.version)
            )
            rows = result.scalars().all()
            return [self._to_event(row) for row in rows]

    async def stream_all(
        self,
        after_sequence: int = 0,
        batch_size: int = 100,
    ) -> AsyncIterator["DomainEvent"]:
        """Stream all events for projections."""
        async with self.session_factory() as session:
            current = after_sequence
            while True:
                result = await session.execute(
                    select(EventStoreModel)
                    .where(EventStoreModel.sequence_number > current)
                    .order_by(EventStoreModel.sequence_number)
                    .limit(batch_size)
                )
                rows = result.scalars().all()
                if not rows:
                    break

                for row in rows:
                    yield self._to_event(row)
                    current = row.sequence_number

    async def _get_version(self, session: AsyncSession, aggregate_id: UUID) -> int:
        result = await session.execute(
            select(func.max(EventStoreModel.version))
            .where(EventStoreModel.aggregate_id == aggregate_id)
        )
        return result.scalar() or 0

    def _to_event(self, row: EventStoreModel) -> "DomainEvent":
        event_class = EVENT_REGISTRY.get(row.event_type)
        return event_class(
            event_id=row.event_id,
            aggregate_id=row.aggregate_id,
            version=row.version,
            **row.event_data,
        )


class ConcurrencyError(Exception):
    pass
```

## Configuration Best Practices

| Setting | Development | Production |
|---------|-------------|------------|
| Connection pool | 5 | 20-50 |
| Statement timeout | 30s | 10s |
| Event batch size | 50 | 100-500 |
| Checkpoint frequency | 10 events | 100 events |
| Snapshot threshold | 50 events | 100-500 events |

## Monitoring Queries

```sql
-- Projection lag (events behind)
SELECT
    p.projection_name,
    (SELECT MAX(sequence_number) FROM event_store) - p.last_sequence_number AS lag,
    p.last_processed_at,
    p.status
FROM projection_checkpoints p;

-- Events per day
SELECT
    DATE(created_at) AS day,
    COUNT(*) AS event_count,
    COUNT(DISTINCT aggregate_id) AS unique_aggregates
FROM event_store
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- Most active aggregates
SELECT
    aggregate_id,
    aggregate_type,
    COUNT(*) AS event_count
FROM event_store
GROUP BY aggregate_id, aggregate_type
ORDER BY event_count DESC
LIMIT 10;
```

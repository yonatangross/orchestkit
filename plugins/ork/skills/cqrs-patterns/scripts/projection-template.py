"""
CQRS Projection Runner Template

Async projection runner with:
- Checkpoint tracking
- Parallel projection processing
- Rebuild capability
- Error handling and recovery
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from contextlib import aclosing
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

logger = logging.getLogger(__name__)

# ============================================================
# PROJECTION BASE
# ============================================================


class Projection(ABC):
    """Base class for event projections."""

    projection_name: str  # Unique identifier for checkpoint tracking

    @abstractmethod
    async def handle(self, event: "DomainEvent") -> None:
        """
        Process a single event.
        MUST be idempotent - safe to replay events.
        """
        pass

    @abstractmethod
    async def reset(self) -> None:
        """Clear all projection data for rebuild."""
        pass


# ============================================================
# CHECKPOINT STORE
# ============================================================


@dataclass
class Checkpoint:
    """Projection checkpoint state."""

    projection_name: str
    last_sequence: int
    last_event_id: UUID | None
    last_processed_at: datetime
    events_processed: int
    status: str = "running"  # running, paused, rebuilding, error
    error_message: str | None = None


class CheckpointStore(Protocol):
    """Protocol for checkpoint persistence."""

    async def get(self, projection_name: str) -> Checkpoint | None:
        ...

    async def save(self, checkpoint: Checkpoint) -> None:
        ...

    async def reset(self, projection_name: str) -> None:
        ...


class InMemoryCheckpointStore:
    """In-memory checkpoint store for testing."""

    def __init__(self):
        self._checkpoints: dict[str, Checkpoint] = {}

    async def get(self, projection_name: str) -> Checkpoint | None:
        return self._checkpoints.get(projection_name)

    async def save(self, checkpoint: Checkpoint) -> None:
        self._checkpoints[checkpoint.projection_name] = checkpoint

    async def reset(self, projection_name: str) -> None:
        self._checkpoints.pop(projection_name, None)


# ============================================================
# EVENT STORE PROTOCOL
# ============================================================


class EventStore(Protocol):
    """Protocol for event store access."""

    async def stream_from(
        self,
        after_sequence: int,
        batch_size: int = 100,
    ) -> AsyncIterator["DomainEvent"]:
        """Stream events after a sequence number."""
        ...

    async def get_current_sequence(self) -> int:
        """Get the current (latest) sequence number."""
        ...


# ============================================================
# PROJECTION RUNNER
# ============================================================


class ProjectionRunner:
    """
    Runs projections from event stream with checkpointing.

    Usage:
        runner = ProjectionRunner(event_store, checkpoint_store)
        runner.add_projection(OrderSummaryProjection(db))
        runner.add_projection(OrderAnalyticsProjection(db))

        # Run continuously
        await runner.run_forever()

        # Or rebuild a specific projection
        await runner.rebuild("order_summary")
    """

    def __init__(
        self,
        event_store: EventStore,
        checkpoint_store: CheckpointStore,
        batch_size: int = 100,
        checkpoint_interval: int = 100,
    ):
        self.event_store = event_store
        self.checkpoints = checkpoint_store
        self.batch_size = batch_size
        self.checkpoint_interval = checkpoint_interval
        self._projections: dict[str, Projection] = {}
        self._running = False

    def add_projection(self, projection: Projection) -> None:
        """Register a projection."""
        self._projections[projection.projection_name] = projection

    async def run_forever(self, poll_interval: float = 0.1) -> None:
        """
        Continuously process new events.

        Polls the event store and processes events for all registered projections.
        Uses aclosing() for proper async generator cleanup.
        """
        self._running = True
        logger.info(
            f"Starting projection runner with {len(self._projections)} projections"
        )

        while self._running:
            processed = await self._process_batch()
            if processed == 0:
                await asyncio.sleep(poll_interval)

    def stop(self) -> None:
        """Stop the projection runner."""
        self._running = False

    async def _process_batch(self) -> int:
        """Process a batch of events for all projections."""
        total_processed = 0

        for name, projection in self._projections.items():
            try:
                processed = await self._process_projection(projection)
                total_processed += processed
            except Exception as e:
                logger.error(f"Projection {name} failed: {e}")
                await self._mark_error(name, str(e))

        return total_processed

    async def _process_projection(self, projection: Projection) -> int:
        """Process events for a single projection."""
        name = projection.projection_name
        checkpoint = await self.checkpoints.get(name)
        after_sequence = checkpoint.last_sequence if checkpoint else 0

        processed = 0
        last_event: DomainEvent | None = None

        # Use aclosing for proper async generator cleanup
        async with aclosing(
            self.event_store.stream_from(after_sequence, self.batch_size)
        ) as stream:
            async for event in stream:
                await projection.handle(event)
                processed += 1
                last_event = event

                # Periodic checkpoint
                if processed % self.checkpoint_interval == 0:
                    await self._save_checkpoint(
                        name, event, processed + (checkpoint.events_processed if checkpoint else 0)
                    )

        # Final checkpoint
        if last_event:
            total = processed + (checkpoint.events_processed if checkpoint else 0)
            await self._save_checkpoint(name, last_event, total)

        return processed

    async def _save_checkpoint(
        self,
        projection_name: str,
        event: "DomainEvent",
        events_processed: int,
    ) -> None:
        """Save projection checkpoint."""
        checkpoint = Checkpoint(
            projection_name=projection_name,
            last_sequence=event.sequence_number,
            last_event_id=event.event_id,
            last_processed_at=datetime.now(timezone.utc),
            events_processed=events_processed,
            status="running",
        )
        await self.checkpoints.save(checkpoint)

    async def _mark_error(self, projection_name: str, error: str) -> None:
        """Mark projection as errored."""
        checkpoint = await self.checkpoints.get(projection_name)
        if checkpoint:
            checkpoint.status = "error"
            checkpoint.error_message = error
            await self.checkpoints.save(checkpoint)

    async def rebuild(self, projection_name: str) -> int:
        """
        Rebuild a projection from scratch.

        Clears all projection data and replays all events.
        Returns the number of events processed.
        """
        projection = self._projections.get(projection_name)
        if not projection:
            raise ValueError(f"Unknown projection: {projection_name}")

        logger.info(f"Starting rebuild of projection: {projection_name}")

        # Mark as rebuilding
        await self.checkpoints.save(
            Checkpoint(
                projection_name=projection_name,
                last_sequence=0,
                last_event_id=None,
                last_processed_at=datetime.now(timezone.utc),
                events_processed=0,
                status="rebuilding",
            )
        )

        # Clear projection data
        await projection.reset()
        await self.checkpoints.reset(projection_name)

        # Replay all events
        processed = 0
        last_event: DomainEvent | None = None

        async with aclosing(self.event_store.stream_from(0, self.batch_size)) as stream:
            async for event in stream:
                await projection.handle(event)
                processed += 1
                last_event = event

                # Progress logging
                if processed % 1000 == 0:
                    logger.info(f"Rebuilt {processed} events for {projection_name}")
                    if last_event:
                        await self._save_checkpoint(projection_name, last_event, processed)

        # Final checkpoint
        if last_event:
            await self._save_checkpoint(projection_name, last_event, processed)

        logger.info(f"Rebuild complete: {projection_name} processed {processed} events")
        return processed

    async def get_lag(self, projection_name: str) -> int:
        """Get the number of events a projection is behind."""
        checkpoint = await self.checkpoints.get(projection_name)
        current = await self.event_store.get_current_sequence()
        last = checkpoint.last_sequence if checkpoint else 0
        return current - last


# ============================================================
# EXAMPLE PROJECTION
# ============================================================


class OrderSummaryProjection(Projection):
    """Example projection that maintains order summaries."""

    projection_name = "order_summary"

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def handle(self, event: "DomainEvent") -> None:
        """Handle events - dispatch to type-specific handlers."""
        handler_name = f"_on_{event.event_type}"
        handler = getattr(self, handler_name, None)
        if handler:
            async with self.session_factory() as session:
                await handler(session, event)
                await session.commit()

    async def _on_OrderCreated(self, session, event) -> None:
        """Handle OrderCreated event with idempotent upsert."""
        await session.execute(
            """
            INSERT INTO order_summary (id, customer_id, status, total_amount, created_at, event_version)
            VALUES (:id, :customer_id, 'pending', 0, :created_at, :version)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                event_version = EXCLUDED.event_version
            WHERE order_summary.event_version < EXCLUDED.event_version
            """,
            {
                "id": event.aggregate_id,
                "customer_id": event.data["customer_id"],
                "created_at": event.timestamp,
                "version": event.version,
            },
        )

    async def _on_OrderCompleted(self, session, event) -> None:
        """Handle OrderCompleted event."""
        await session.execute(
            """
            UPDATE order_summary
            SET status = 'completed', updated_at = :updated_at, event_version = :version
            WHERE id = :id AND event_version < :version
            """,
            {
                "id": event.aggregate_id,
                "updated_at": event.timestamp,
                "version": event.version,
            },
        )

    async def reset(self) -> None:
        """Clear projection data for rebuild."""
        async with self.session_factory() as session:
            await session.execute("TRUNCATE order_summary")
            await session.commit()


# ============================================================
# DOMAIN EVENT STUB
# ============================================================


@dataclass
class DomainEvent:
    """Domain event with sequence number for projection ordering."""

    event_id: UUID
    aggregate_id: UUID
    event_type: str
    version: int
    sequence_number: int  # Global ordering
    timestamp: datetime
    data: dict

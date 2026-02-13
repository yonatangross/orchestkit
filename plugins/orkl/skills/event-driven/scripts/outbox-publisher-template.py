"""
Outbox Pattern Publisher Template

Ready-to-use template for implementing the transactional outbox pattern.
Includes SQLAlchemy model, atomic write helper, and background publisher.

Usage:
    1. Copy this file to your project
    2. Adjust imports and configuration
    3. Integrate with your message broker (Kafka, RabbitMQ, etc.)
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Integer, String, delete, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================

class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


class OutboxMessage(Base):
    """Transactional outbox message model."""

    __tablename__ = "outbox"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    aggregate_type: str = Column(String(100), nullable=False, index=True)
    aggregate_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    event_type: str = Column(String(100), nullable=False)
    payload: dict = Column(JSONB, nullable=False)
    created_at: datetime = Column(DateTime, nullable=False, default=lambda: datetime.now(datetime.UTC))
    published_at: datetime | None = Column(DateTime, nullable=True)
    retry_count: int = Column(Integer, nullable=False, default=0)
    last_error: str | None = Column(String(500), nullable=True)

    def to_event_dict(self) -> dict[str, Any]:
        """Convert to event dictionary for publishing."""
        return {
            "id": str(self.id),
            "type": self.event_type,
            "aggregate_type": self.aggregate_type,
            "aggregate_id": str(self.aggregate_id),
            "timestamp": self.created_at.isoformat(),
            **self.payload,
        }


# =============================================================================
# Atomic Write Helper
# =============================================================================

async def write_with_outbox(
    session: AsyncSession,
    entity: Any,
    aggregate_type: str,
    event_type: str,
    payload: dict[str, Any],
) -> OutboxMessage:
    """
    Write entity and outbox message atomically.

    Args:
        session: SQLAlchemy async session
        entity: Business entity to persist (must have 'id' attribute)
        aggregate_type: Type name (e.g., "Order", "User")
        event_type: Event name (e.g., "OrderCreated", "UserUpdated")
        payload: Event payload dictionary

    Returns:
        Created OutboxMessage

    Example:
        async with session.begin():
            order = Order(customer_id=customer_id, total=100.0)
            await write_with_outbox(
                session,
                order,
                "Order",
                "OrderCreated",
                {"customer_id": customer_id, "total": 100.0}
            )
    """
    outbox_message = OutboxMessage(
        aggregate_type=aggregate_type,
        aggregate_id=entity.id,
        event_type=event_type,
        payload=payload,
    )

    session.add(entity)
    session.add(outbox_message)

    return outbox_message


# =============================================================================
# Background Publisher
# =============================================================================

class OutboxPublisher:
    """
    Background publisher for outbox messages.

    Polls the outbox table and publishes pending messages to a message broker.
    Uses row-level locking to support multiple publisher instances.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        publish_fn: Callable[[str, str, dict], Any],
        poll_interval: float = 1.0,
        batch_size: int = 100,
        max_retries: int = 5,
    ):
        """
        Initialize the publisher.

        Args:
            session_factory: SQLAlchemy async session factory
            publish_fn: Async function(topic, key, value) to publish messages
            poll_interval: Seconds between polls when queue is empty
            batch_size: Maximum messages to process per batch
            max_retries: Maximum retry attempts before giving up
        """
        self.session_factory = session_factory
        self.publish_fn = publish_fn
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the publisher background task."""
        if self._running:
            logger.warning("Publisher already running")
            return

        logger.info(
            f"Starting outbox publisher (interval={self.poll_interval}s, "
            f"batch={self.batch_size}, retries={self.max_retries})"
        )
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self, timeout: float = 10.0) -> None:
        """Stop the publisher gracefully."""
        if not self._running:
            return

        logger.info("Stopping outbox publisher...")
        self._running = False

        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=timeout)
            except TimeoutError:
                logger.warning("Publisher stop timed out, cancelling")
                self._task.cancel()

    async def _run_loop(self) -> None:
        """Main polling loop."""
        while self._running:
            try:
                published = await self._process_batch()
                if published == 0:
                    await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Error in publisher loop: {e}")
                await asyncio.sleep(self.poll_interval * 2)

        logger.info("Publisher loop stopped")

    async def _process_batch(self) -> int:
        """Process a batch of pending messages."""
        async with self.session_factory() as session:
            # Lock rows to prevent duplicate processing
            stmt = (
                select(OutboxMessage)
                .where(OutboxMessage.published_at.is_(None))
                .where(OutboxMessage.retry_count < self.max_retries)
                .order_by(OutboxMessage.created_at)
                .limit(self.batch_size)
                .with_for_update(skip_locked=True)
            )
            result = await session.execute(stmt)
            messages = result.scalars().all()

            if not messages:
                return 0

            published_count = 0
            for msg in messages:
                topic = f"{msg.aggregate_type.lower()}-events"
                key = str(msg.aggregate_id)

                try:
                    await self.publish_fn(topic, key, msg.to_event_dict())
                    msg.published_at = datetime.now(datetime.UTC)
                    published_count += 1
                except Exception as e:
                    msg.retry_count += 1
                    msg.last_error = str(e)[:500]
                    logger.warning(
                        f"Failed to publish {msg.id} "
                        f"(attempt {msg.retry_count}/{self.max_retries}): {e}"
                    )

            await session.commit()

            if published_count > 0:
                logger.info(f"Published {published_count}/{len(messages)} messages")

            return published_count


# =============================================================================
# Error Tracking
# =============================================================================

async def get_failed_messages(
    session: AsyncSession,
    limit: int = 100,
) -> list[OutboxMessage]:
    """Get messages that exceeded max retries."""
    stmt = (
        select(OutboxMessage)
        .where(OutboxMessage.published_at.is_(None))
        .where(OutboxMessage.retry_count >= 5)  # Adjust as needed
        .order_by(OutboxMessage.created_at)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def retry_failed_message(
    session: AsyncSession,
    message_id: UUID,
) -> bool:
    """Reset retry count to allow reprocessing."""
    msg = await session.get(OutboxMessage, message_id)
    if msg and msg.published_at is None:
        msg.retry_count = 0
        msg.last_error = None
        await session.commit()
        return True
    return False


async def cleanup_published(
    session: AsyncSession,
    older_than_days: int = 7,
    batch_size: int = 10000,
) -> int:
    """Delete published messages older than specified days."""
    from datetime import timedelta

    cutoff = datetime.now(datetime.UTC) - timedelta(days=older_than_days)
    total_deleted = 0

    while True:
        stmt = (
            delete(OutboxMessage)
            .where(OutboxMessage.published_at.isnot(None))
            .where(OutboxMessage.published_at < cutoff)
        )
        # Note: LIMIT on DELETE requires database-specific syntax
        # For PostgreSQL, use CTID-based deletion or a subquery

        result = await session.execute(stmt)
        await session.commit()

        deleted = result.rowcount
        total_deleted += deleted

        if deleted < batch_size:
            break

        await asyncio.sleep(0.1)

    return total_deleted


# =============================================================================
# Example Usage
# =============================================================================

if __name__ == "__main__":
    """
    Example: Run the publisher with a mock broker.

    In production, replace mock_publish with your actual broker client:
    - Kafka: aiokafka.AIOKafkaProducer
    - RabbitMQ: aio_pika
    - Redis Streams: redis.asyncio
    """

    async def mock_publish(topic: str, key: str, value: dict) -> None:
        """Mock publisher for testing."""
        print(f"Published to {topic}: {key} -> {value['type']}")

    async def main():
        from sqlalchemy.ext.asyncio import create_async_engine

        # Setup database
        engine = create_async_engine(
            "postgresql+asyncpg://user:pass@localhost/db",
            echo=True,
        )
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Start publisher
        publisher = OutboxPublisher(
            session_factory=session_factory,
            publish_fn=mock_publish,
            poll_interval=1.0,
            batch_size=100,
            max_retries=5,
        )

        try:
            await publisher.start()
            # Keep running until interrupted
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await publisher.stop()

    asyncio.run(main())

"""
Choreography Event Router Template (2026 Best Practices)

Event-driven saga coordination with:
- Typed event handlers with Pydantic validation
- Saga correlation tracking
- Idempotent event processing
- Dead letter handling
- Compensation event routing

Usage:
    router = SagaEventRouter(redis_client)

    @router.on(InventoryReserved)
    async def handle_inventory_reserved(event: InventoryReserved, ctx: EventContext):
        await payment_service.charge(event.order_id, event.amount)

    # In your event consumer:
    await router.route(raw_event)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Generic, TypeVar, get_type_hints
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
import asyncio
import json
import structlog

logger = structlog.get_logger()

T = TypeVar("T", bound="SagaEvent")


class SagaEvent(BaseModel):
    """Base class for all saga events."""

    event_id: UUID = Field(default_factory=uuid4)
    saga_id: UUID
    event_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = "1.0"
    correlation_id: UUID | None = None  # For tracing
    causation_id: UUID | None = None  # ID of event that caused this one

    class Config:
        frozen = True  # Events are immutable


@dataclass
class EventContext:
    """Context provided to event handlers."""

    saga_id: UUID
    event_id: UUID
    timestamp: datetime
    correlation_id: UUID | None
    metadata: dict = field(default_factory=dict)
    idempotency_checked: bool = False


class SagaCorrelationTracker:
    """Track saga progress across choreographed events."""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 86400 * 7  # 7 days

    async def start_saga(self, saga_id: UUID, saga_type: str, initial_data: dict) -> None:
        """Initialize saga tracking."""
        await self.redis.hset(
            f"saga:{saga_id}",
            mapping={
                "type": saga_type,
                "status": "started",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_steps": json.dumps([]),
                "data": json.dumps(initial_data, default=str),
            },
        )
        await self.redis.expire(f"saga:{saga_id}", self.ttl)

    async def record_event(
        self,
        saga_id: UUID,
        event_type: str,
        status: str,
        data: dict | None = None,
    ) -> None:
        """Record event in saga correlation."""
        steps = json.loads(await self.redis.hget(f"saga:{saga_id}", "completed_steps") or "[]")
        steps.append({
            "event_type": event_type,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        })
        await self.redis.hset(f"saga:{saga_id}", "completed_steps", json.dumps(steps))

        if data:
            current_data = json.loads(await self.redis.hget(f"saga:{saga_id}", "data") or "{}")
            current_data.update(data)
            await self.redis.hset(f"saga:{saga_id}", "data", json.dumps(current_data, default=str))

    async def is_event_processed(self, saga_id: UUID, event_type: str) -> bool:
        """Check if event type already processed (idempotency)."""
        steps = json.loads(await self.redis.hget(f"saga:{saga_id}", "completed_steps") or "[]")
        return any(s["event_type"] == event_type and s["status"] == "completed" for s in steps)

    async def get_saga_data(self, saga_id: UUID) -> dict:
        """Get accumulated saga data."""
        return json.loads(await self.redis.hget(f"saga:{saga_id}", "data") or "{}")

    async def complete_saga(self, saga_id: UUID) -> None:
        """Mark saga as completed."""
        await self.redis.hset(
            f"saga:{saga_id}",
            mapping={
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def fail_saga(self, saga_id: UUID, reason: str) -> None:
        """Mark saga as failed."""
        await self.redis.hset(
            f"saga:{saga_id}",
            mapping={
                "status": "failed",
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "failure_reason": reason,
            },
        )


class DeadLetterHandler:
    """Handle events that failed processing."""

    def __init__(self, db_session, alerting_service=None):
        self.db = db_session
        self.alerting = alerting_service

    async def handle_failed_event(
        self,
        event: dict,
        error: str,
        retry_count: int,
        handler_name: str,
    ) -> None:
        """Store failed event and optionally alert."""
        # Store in dead letter table
        await self.db.execute(
            """
            INSERT INTO saga_dead_letters
            (event_id, saga_id, event_type, payload, error, retry_count, handler_name, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            event.get("event_id"),
            event.get("saga_id"),
            event.get("event_type"),
            json.dumps(event),
            error,
            retry_count,
            handler_name,
            datetime.now(timezone.utc),
        )

        # Alert if max retries exceeded
        if retry_count >= 3 and self.alerting:
            await self.alerting.send(
                channel="saga-dlq",
                message=f"Event {event.get('event_type')} for saga {event.get('saga_id')} "
                        f"failed after {retry_count} retries: {error}",
                severity="warning",
            )


class SagaEventRouter:
    """
    Routes saga events to registered handlers.

    Features:
    - Type-safe event handling with Pydantic
    - Automatic idempotency checking
    - Compensation event routing
    - Dead letter handling
    - Correlation tracking
    """

    def __init__(
        self,
        correlation_tracker: SagaCorrelationTracker | None = None,
        dlq_handler: DeadLetterHandler | None = None,
    ):
        self.handlers: dict[str, list[tuple[type[SagaEvent], Callable]]] = {}
        self.compensation_handlers: dict[str, list[tuple[type[SagaEvent], Callable]]] = {}
        self.correlation = correlation_tracker
        self.dlq = dlq_handler

    def on(self, event_class: type[T]):
        """
        Decorator to register an event handler.

        Usage:
            @router.on(InventoryReserved)
            async def handle(event: InventoryReserved, ctx: EventContext):
                ...
        """
        def decorator(handler: Callable[[T, EventContext], Any]):
            event_type = event_class.__fields__["event_type"].default
            if event_type not in self.handlers:
                self.handlers[event_type] = []
            self.handlers[event_type].append((event_class, handler))
            return handler
        return decorator

    def on_compensation(self, event_class: type[T]):
        """
        Decorator to register a compensation handler.

        Usage:
            @router.on_compensation(PaymentFailed)
            async def compensate(event: PaymentFailed, ctx: EventContext):
                await inventory_service.release(event.reservation_id)
        """
        def decorator(handler: Callable[[T, EventContext], Any]):
            event_type = event_class.__fields__["event_type"].default
            if event_type not in self.compensation_handlers:
                self.compensation_handlers[event_type] = []
            self.compensation_handlers[event_type].append((event_class, handler))
            return handler
        return decorator

    async def route(self, raw_event: dict) -> bool:
        """
        Route an event to registered handlers.

        Args:
            raw_event: Raw event dictionary

        Returns:
            True if event was handled successfully
        """
        event_type = raw_event.get("event_type")
        saga_id = UUID(raw_event["saga_id"]) if raw_event.get("saga_id") else None

        logger.info(
            "event_routing",
            event_type=event_type,
            saga_id=str(saga_id),
        )

        # Check idempotency
        if self.correlation and saga_id:
            if await self.correlation.is_event_processed(saga_id, event_type):
                logger.info(
                    "event_already_processed",
                    event_type=event_type,
                    saga_id=str(saga_id),
                )
                return True

        # Find handlers
        handlers = self.handlers.get(event_type, [])
        compensation_handlers = self.compensation_handlers.get(event_type, [])
        all_handlers = handlers + compensation_handlers

        if not all_handlers:
            logger.warning("no_handler_registered", event_type=event_type)
            return False

        # Build context
        ctx = EventContext(
            saga_id=saga_id,
            event_id=UUID(raw_event.get("event_id", str(uuid4()))),
            timestamp=datetime.fromisoformat(raw_event.get("timestamp", datetime.now(timezone.utc).isoformat())),
            correlation_id=UUID(raw_event["correlation_id"]) if raw_event.get("correlation_id") else None,
        )

        # Execute handlers
        success = True
        for event_class, handler in all_handlers:
            try:
                # Parse event with Pydantic
                event = event_class(**raw_event)

                # Execute handler
                await handler(event, ctx)

                logger.info(
                    "handler_completed",
                    event_type=event_type,
                    handler=handler.__name__,
                    saga_id=str(saga_id),
                )

            except Exception as e:
                success = False
                logger.error(
                    "handler_failed",
                    event_type=event_type,
                    handler=handler.__name__,
                    saga_id=str(saga_id),
                    error=str(e),
                )

                if self.dlq:
                    await self.dlq.handle_failed_event(
                        raw_event,
                        str(e),
                        raw_event.get("_retry_count", 0),
                        handler.__name__,
                    )

        # Record in correlation tracker
        if self.correlation and saga_id and success:
            await self.correlation.record_event(
                saga_id,
                event_type,
                "completed",
                raw_event.get("data"),
            )

        return success

    async def emit(
        self,
        event: SagaEvent,
        publisher,  # EventPublisher protocol
    ) -> None:
        """
        Emit an event through the configured publisher.

        Args:
            event: Event to emit
            publisher: Event publisher instance
        """
        topic = f"saga.{event.event_type}"
        await publisher.publish(topic, event.model_dump(mode="json"))

        logger.info(
            "event_emitted",
            event_type=event.event_type,
            saga_id=str(event.saga_id),
            topic=topic,
        )


# Example event definitions:
#
# class InventoryReserved(SagaEvent):
#     event_type: str = "inventory.reserved"
#     order_id: UUID
#     reservation_id: UUID
#     items: list[dict]
#     expires_at: datetime
#
# class PaymentFailed(SagaEvent):
#     event_type: str = "payment.failed"
#     order_id: UUID
#     reservation_id: UUID
#     reason: str
#
# Example usage:
#
# router = SagaEventRouter(
#     correlation_tracker=SagaCorrelationTracker(redis_client),
#     dlq_handler=DeadLetterHandler(db_session),
# )
#
# @router.on(InventoryReserved)
# async def handle_inventory_reserved(event: InventoryReserved, ctx: EventContext):
#     saga_data = await router.correlation.get_saga_data(ctx.saga_id)
#     await payment_service.charge(
#         order_id=event.order_id,
#         amount=saga_data["total"],
#     )
#
# @router.on_compensation(PaymentFailed)
# async def compensate_inventory(event: PaymentFailed, ctx: EventContext):
#     await inventory_service.release(event.reservation_id)
#
# # In your Kafka/RabbitMQ consumer:
# async def consume_events():
#     async for raw_event in event_consumer:
#         await router.route(raw_event)

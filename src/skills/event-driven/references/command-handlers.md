# Command Handlers

Command bus and handler patterns for CQRS write operations.

## Command Bus Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   API/UI     │────>│ Command Bus │────>│   Handler    │────>│  Aggregate  │
└──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                           │                    │                    │
                           │                    │              ┌─────▼─────┐
                     ┌─────▼─────┐        ┌─────▼─────┐        │  Events   │
                     │ Middleware│        │ Validation│        └───────────┘
                     └───────────┘        └───────────┘
```

## Command Definition (2026 Best Practices)

```python
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import datetime, timezone

class Command(BaseModel):
    """Base command with metadata and idempotency support."""
    command_id: UUID = Field(default_factory=uuid4)
    correlation_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: UUID | None = None
    idempotency_key: str | None = None  # For retry safety

    class Config:
        frozen = True  # Commands should be immutable

class CreateOrder(Command):
    customer_id: UUID
    items: list["OrderItemData"]
    shipping_address: "Address"

class CancelOrder(Command):
    order_id: UUID
    reason: str
```

## Handler Pattern with Dependency Injection

```python
from abc import ABC, abstractmethod
from typing import Protocol

class CommandHandler(Protocol[C]):
    async def handle(self, command: C) -> list["DomainEvent"]: ...

class CreateOrderHandler:
    def __init__(
        self,
        order_repo: "OrderRepository",
        inventory_service: "InventoryService",
        event_publisher: "EventPublisher",
    ):
        self.order_repo = order_repo
        self.inventory = inventory_service
        self.publisher = event_publisher

    async def handle(self, command: CreateOrder) -> list[DomainEvent]:
        # 1. Validate preconditions
        for item in command.items:
            if not await self.inventory.check_availability(item.product_id, item.quantity):
                raise InsufficientInventoryError(item.product_id)

        # 2. Create aggregate (raises events internally)
        order = Order.create(
            customer_id=command.customer_id,
            items=command.items,
            shipping_address=command.shipping_address,
        )

        # 3. Save (with optimistic concurrency)
        await self.order_repo.save(order)

        # 4. Return events for the bus to publish
        return order.pending_events
```

## Command Bus Implementation

```python
class CommandBus:
    def __init__(self, event_publisher: "EventPublisher"):
        self._handlers: dict[type[Command], CommandHandler] = {}
        self._middlewares: list["Middleware"] = []
        self.publisher = event_publisher

    def register(self, command_type: type[Command], handler: CommandHandler) -> None:
        self._handlers[command_type] = handler

    def add_middleware(self, middleware: "Middleware") -> None:
        self._middlewares.append(middleware)

    async def dispatch(self, command: Command) -> list[DomainEvent]:
        handler = self._handlers.get(type(command))
        if not handler:
            raise NoHandlerError(f"No handler for {type(command).__name__}")

        # Run middlewares (validation, logging, metrics)
        for mw in self._middlewares:
            await mw.before(command)

        try:
            events = await handler.handle(command)

            # Publish events after successful command
            for event in events:
                await self.publisher.publish(event)

            for mw in self._middlewares:
                await mw.after(command, events)

            return events

        except Exception as e:
            for mw in self._middlewares:
                await mw.on_error(command, e)
            raise
```

## Middleware Examples

```python
class ValidationMiddleware:
    async def before(self, command: Command) -> None:
        # Pydantic validation happens at model instantiation
        # Add custom cross-field validation here
        if hasattr(command, "validate_business_rules"):
            command.validate_business_rules()

    async def after(self, command: Command, events: list[DomainEvent]) -> None:
        pass

    async def on_error(self, command: Command, error: Exception) -> None:
        pass


class LoggingMiddleware:
    def __init__(self, logger: "Logger"):
        self.logger = logger

    async def before(self, command: Command) -> None:
        self.logger.info(
            "command.started",
            command_type=type(command).__name__,
            command_id=str(command.command_id),
            correlation_id=str(command.correlation_id),
        )

    async def after(self, command: Command, events: list[DomainEvent]) -> None:
        self.logger.info(
            "command.completed",
            command_id=str(command.command_id),
            events_count=len(events),
        )


class IdempotencyMiddleware:
    def __init__(self, cache: "Redis"):
        self.cache = cache

    async def before(self, command: Command) -> None:
        if command.idempotency_key:
            cached = await self.cache.get(f"cmd:{command.idempotency_key}")
            if cached:
                raise CommandAlreadyProcessedError(command.idempotency_key)

    async def after(self, command: Command, events: list[DomainEvent]) -> None:
        if command.idempotency_key:
            await self.cache.setex(
                f"cmd:{command.idempotency_key}",
                86400,  # 24 hours
                "processed"
            )
```

## FastAPI Integration

```python
@router.post("/api/v1/orders", status_code=201)
async def create_order(
    request: CreateOrderRequest,
    command_bus: CommandBus = Depends(get_command_bus),
    current_user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    command = CreateOrder(
        customer_id=request.customer_id,
        items=request.items,
        shipping_address=request.shipping_address,
        user_id=current_user.id,
        idempotency_key=idempotency_key,
    )

    events = await command_bus.dispatch(command)
    order_id = events[0].aggregate_id  # OrderCreated event

    return {"order_id": str(order_id), "status": "created"}
```

## Key Patterns

| Pattern | Use When |
|---------|----------|
| Inline validation | Simple field checks |
| Middleware validation | Cross-cutting concerns |
| Domain validation | Business rules in aggregate |
| Idempotency keys | Retry-safe commands |
| Correlation IDs | Distributed tracing |

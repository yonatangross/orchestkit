---
title: "CQRS: Command Side"
impact: HIGH
impactDescription: "The command side enforces business rules and produces domain events — incorrect handler design leads to invalid state transitions"
tags: cqrs, command-bus, command-handler, write-model
---

# CQRS: Command Side

## Command and Handler

```python
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import datetime, timezone
from abc import ABC, abstractmethod

class Command(BaseModel):
    """Base command with metadata."""
    command_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: UUID | None = None

class CreateOrder(Command):
    customer_id: UUID
    items: list[OrderItem]
    shipping_address: Address

class CommandHandler(ABC):
    @abstractmethod
    async def handle(self, command: Command) -> list["DomainEvent"]:
        pass

class CreateOrderHandler(CommandHandler):
    def __init__(self, order_repo, inventory_service):
        self.order_repo = order_repo
        self.inventory = inventory_service

    async def handle(self, command: CreateOrder) -> list[DomainEvent]:
        for item in command.items:
            if not await self.inventory.check_availability(item.product_id, item.quantity):
                raise InsufficientInventoryError(item.product_id)

        order = Order.create(
            customer_id=command.customer_id,
            items=command.items,
            shipping_address=command.shipping_address,
        )
        await self.order_repo.save(order)
        return order.pending_events
```

## Command Bus

```python
class CommandBus:
    def __init__(self):
        self._handlers: dict[type, CommandHandler] = {}

    def register(self, command_type: type, handler: CommandHandler):
        self._handlers[command_type] = handler

    async def dispatch(self, command: Command) -> list[DomainEvent]:
        handler = self._handlers.get(type(command))
        if not handler:
            raise NoHandlerFoundError(type(command))
        events = await handler.handle(command)
        for event in events:
            await self.event_publisher.publish(event)
        return events
```

## Key Rules

- One handler per command type (no multi-dispatch)
- Handlers validate business rules before raising events
- Commands are named as imperatives (`CreateOrder`, `CancelOrder`)
- Handlers return domain events for downstream projection

## When NOT to Use CQRS

- Simple CRUD applications
- Strong consistency requirements everywhere
- Small datasets with simple queries

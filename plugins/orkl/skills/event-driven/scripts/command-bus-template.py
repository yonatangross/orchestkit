"""
CQRS Command Bus Template

Ready-to-use command bus with:
- Type-safe command registration
- Middleware pipeline (validation, logging, idempotency)
- Async command handling
- Event publishing integration
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol, TypeVar
from uuid import UUID, uuid4

# ============================================================
# COMMAND BASE
# ============================================================


@dataclass(frozen=True)
class Command:
    """Base command class with metadata."""

    command_id: UUID = field(default_factory=uuid4)
    correlation_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: UUID | None = None
    idempotency_key: str | None = None


C = TypeVar("C", bound=Command)


# ============================================================
# HANDLER PROTOCOL
# ============================================================


class CommandHandler(Protocol[C]):
    """Protocol for command handlers."""

    async def handle(self, command: C) -> list["DomainEvent"]:
        """Handle command and return domain events."""
        ...


# ============================================================
# MIDDLEWARE
# ============================================================


class Middleware(ABC):
    """Base middleware for command processing pipeline."""

    @abstractmethod
    async def before(self, command: Command) -> None:
        """Execute before command handling."""
        pass

    @abstractmethod
    async def after(self, command: Command, events: list["DomainEvent"]) -> None:
        """Execute after successful command handling."""
        pass

    @abstractmethod
    async def on_error(self, command: Command, error: Exception) -> None:
        """Execute on command handling error."""
        pass


class LoggingMiddleware(Middleware):
    """Logs command execution."""

    def __init__(self, logger: "Logger"):
        self.logger = logger

    async def before(self, command: Command) -> None:
        self.logger.info(
            "command.started",
            extra={
                "command_type": type(command).__name__,
                "command_id": str(command.command_id),
                "correlation_id": str(command.correlation_id),
            },
        )

    async def after(self, command: Command, events: list["DomainEvent"]) -> None:
        self.logger.info(
            "command.completed",
            extra={
                "command_id": str(command.command_id),
                "events_count": len(events),
            },
        )

    async def on_error(self, command: Command, error: Exception) -> None:
        self.logger.error(
            "command.failed",
            extra={
                "command_id": str(command.command_id),
                "error": str(error),
            },
        )


class ValidationMiddleware(Middleware):
    """Validates commands before processing."""

    async def before(self, command: Command) -> None:
        if hasattr(command, "validate"):
            command.validate()

    async def after(self, command: Command, events: list["DomainEvent"]) -> None:
        pass

    async def on_error(self, command: Command, error: Exception) -> None:
        pass


class IdempotencyMiddleware(Middleware):
    """Prevents duplicate command processing."""

    def __init__(self, cache: "Redis"):
        self.cache = cache
        self.ttl = 86400  # 24 hours

    async def before(self, command: Command) -> None:
        if command.idempotency_key:
            cached = await self.cache.get(f"cmd:{command.idempotency_key}")
            if cached:
                raise CommandAlreadyProcessedError(command.idempotency_key)

    async def after(self, command: Command, events: list["DomainEvent"]) -> None:
        if command.idempotency_key:
            await self.cache.setex(
                f"cmd:{command.idempotency_key}",
                self.ttl,
                "processed",
            )

    async def on_error(self, command: Command, error: Exception) -> None:
        pass


# ============================================================
# COMMAND BUS
# ============================================================


class NoHandlerError(Exception):
    """Raised when no handler is registered for a command."""

    pass


class CommandAlreadyProcessedError(Exception):
    """Raised when an idempotent command was already processed."""

    pass


class CommandBus:
    """
    Command bus for dispatching commands to handlers.

    Usage:
        bus = CommandBus(event_publisher)
        bus.add_middleware(LoggingMiddleware(logger))
        bus.register(CreateOrder, CreateOrderHandler(repo, service))

        events = await bus.dispatch(CreateOrder(...))
    """

    def __init__(self, event_publisher: "EventPublisher | None" = None):
        self._handlers: dict[type[Command], CommandHandler] = {}
        self._middlewares: list[Middleware] = []
        self.event_publisher = event_publisher

    def register(
        self,
        command_type: type[C],
        handler: CommandHandler[C],
    ) -> None:
        """Register a handler for a command type."""
        self._handlers[command_type] = handler

    def add_middleware(self, middleware: Middleware) -> None:
        """Add middleware to the processing pipeline."""
        self._middlewares.append(middleware)

    async def dispatch(self, command: Command) -> list["DomainEvent"]:
        """
        Dispatch a command to its handler.

        Returns list of domain events raised by the command.
        Raises NoHandlerError if no handler is registered.
        """
        handler = self._handlers.get(type(command))
        if not handler:
            raise NoHandlerError(f"No handler registered for {type(command).__name__}")

        # Pre-processing middleware
        for middleware in self._middlewares:
            await middleware.before(command)

        try:
            # Handle command
            events = await handler.handle(command)

            # Publish events
            if self.event_publisher:
                for event in events:
                    await self.event_publisher.publish(event)

            # Post-processing middleware
            for middleware in self._middlewares:
                await middleware.after(command, events)

            return events

        except Exception as e:
            # Error handling middleware
            for middleware in self._middlewares:
                await middleware.on_error(command, e)
            raise


# ============================================================
# EXAMPLE USAGE
# ============================================================


@dataclass(frozen=True)
class CreateOrder(Command):
    """Command to create a new order."""

    customer_id: UUID
    items: tuple["OrderItemData", ...]  # Use tuple for immutability
    shipping_address: "Address"


class CreateOrderHandler:
    """Handler for CreateOrder command."""

    def __init__(
        self,
        order_repo: "OrderRepository",
        inventory_service: "InventoryService",
    ):
        self.order_repo = order_repo
        self.inventory = inventory_service

    async def handle(self, command: CreateOrder) -> list["DomainEvent"]:
        # Validate preconditions
        for item in command.items:
            available = await self.inventory.check_availability(
                item.product_id, item.quantity
            )
            if not available:
                raise InsufficientInventoryError(item.product_id)

        # Create aggregate
        order = Order.create(
            customer_id=command.customer_id,
            items=list(command.items),
            shipping_address=command.shipping_address,
        )

        # Persist
        await self.order_repo.save(order)

        # Return events for publishing
        return order.uncommitted_events


# Type stubs for IDE support
class DomainEvent:
    pass


class EventPublisher(Protocol):
    async def publish(self, event: DomainEvent) -> None:
        ...


class Logger(Protocol):
    def info(self, msg: str, extra: dict | None = None) -> None:
        ...

    def error(self, msg: str, extra: dict | None = None) -> None:
        ...


class Redis(Protocol):
    async def get(self, key: str) -> str | None:
        ...

    async def setex(self, key: str, ttl: int, value: str) -> None:
        ...


class InsufficientInventoryError(Exception):
    pass


class OrderItemData:
    """Stub for order item data."""

    product_id: UUID
    quantity: int


class Address:
    """Stub for address value object."""

    pass


class OrderRepository(Protocol):
    """Stub for order repository."""

    async def save(self, order: "Order") -> None:
        ...


class InventoryService(Protocol):
    """Stub for inventory service."""

    async def check_availability(self, product_id: UUID, quantity: int) -> bool:
        ...


class Order:
    """Stub for order aggregate."""

    uncommitted_events: list[DomainEvent]

    @classmethod
    def create(
        cls,
        customer_id: UUID,
        items: list[OrderItemData],
        shipping_address: Address,
    ) -> "Order":
        ...

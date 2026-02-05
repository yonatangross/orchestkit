"""
Complete Inventory Management CQRS Example

A production-ready example demonstrating CQRS patterns for inventory management:
- Command side: InventoryItem aggregate with domain events
- Query side: Denormalized read models for different query patterns
- Projections: Event handlers updating read models
- FastAPI integration: REST endpoints for commands and queries

Run: uvicorn inventory-cqrs:app --reload
"""

from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Generic, TypeVar
from uuid import UUID
from uuid_utils import uuid7

from fastapi import FastAPI, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# Domain Events
# =============================================================================

class DomainEvent(BaseModel):
    """Base domain event."""
    event_id: UUID = Field(default_factory=uuid7)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    aggregate_id: UUID
    correlation_id: UUID | None = None

    class Config:
        frozen = True


class InventoryItemCreated(DomainEvent):
    """An inventory item was created."""
    sku: str
    name: str
    description: str
    initial_quantity: int
    reorder_level: int
    unit_cost: Decimal


class InventoryReceived(DomainEvent):
    """Inventory was received (added to stock)."""
    quantity: int
    source: str  # e.g., "purchase_order", "return", "adjustment"
    reference_id: str | None = None  # e.g., PO number


class InventoryReserved(DomainEvent):
    """Inventory was reserved for an order."""
    quantity: int
    order_id: UUID


class InventoryReservationReleased(DomainEvent):
    """A reservation was released (order cancelled)."""
    quantity: int
    order_id: UUID


class InventoryShipped(DomainEvent):
    """Reserved inventory was shipped (removed from stock)."""
    quantity: int
    order_id: UUID


class InventoryAdjusted(DomainEvent):
    """Manual inventory adjustment (correction)."""
    quantity_delta: int
    reason: str


class ReorderLevelChanged(DomainEvent):
    """Reorder level was updated."""
    old_level: int
    new_level: int


class ItemDeactivated(DomainEvent):
    """Item was deactivated (soft delete)."""
    reason: str


# =============================================================================
# Write Model (Aggregate)
# =============================================================================

class InventoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


@dataclass
class InventoryItem:
    """
    Inventory Item Aggregate.

    Enforces business rules:
    - Cannot have negative available quantity
    - Cannot ship more than reserved
    - Cannot reserve more than available
    """
    id: UUID
    sku: str
    name: str
    description: str
    quantity_on_hand: int  # Physical stock
    quantity_reserved: int  # Reserved for orders
    reorder_level: int
    unit_cost: Decimal
    status: InventoryStatus
    version: int
    _pending_events: list[DomainEvent] = field(default_factory=list)

    @property
    def quantity_available(self) -> int:
        """Quantity available for reservation."""
        return self.quantity_on_hand - self.quantity_reserved

    @classmethod
    def create(
        cls,
        sku: str,
        name: str,
        description: str,
        initial_quantity: int,
        reorder_level: int,
        unit_cost: Decimal,
    ) -> "InventoryItem":
        """Factory method to create a new inventory item."""
        item_id = uuid7()
        item = cls(
            id=item_id,
            sku=sku,
            name=name,
            description=description,
            quantity_on_hand=initial_quantity,
            quantity_reserved=0,
            reorder_level=reorder_level,
            unit_cost=unit_cost,
            status=InventoryStatus.ACTIVE,
            version=0,
        )
        item._raise_event(InventoryItemCreated(
            aggregate_id=item_id,
            sku=sku,
            name=name,
            description=description,
            initial_quantity=initial_quantity,
            reorder_level=reorder_level,
            unit_cost=unit_cost,
        ))
        return item

    def receive(self, quantity: int, source: str, reference_id: str | None = None) -> None:
        """Receive inventory (increase stock)."""
        self._ensure_active()
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        self.quantity_on_hand += quantity
        self._raise_event(InventoryReceived(
            aggregate_id=self.id,
            quantity=quantity,
            source=source,
            reference_id=reference_id,
        ))

    def reserve(self, quantity: int, order_id: UUID) -> None:
        """Reserve inventory for an order."""
        self._ensure_active()
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if quantity > self.quantity_available:
            raise ValueError(
                f"Insufficient inventory. Available: {self.quantity_available}, Requested: {quantity}"
            )

        self.quantity_reserved += quantity
        self._raise_event(InventoryReserved(
            aggregate_id=self.id,
            quantity=quantity,
            order_id=order_id,
        ))

    def release_reservation(self, quantity: int, order_id: UUID) -> None:
        """Release a reservation (order cancelled)."""
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if quantity > self.quantity_reserved:
            raise ValueError("Cannot release more than reserved")

        self.quantity_reserved -= quantity
        self._raise_event(InventoryReservationReleased(
            aggregate_id=self.id,
            quantity=quantity,
            order_id=order_id,
        ))

    def ship(self, quantity: int, order_id: UUID) -> None:
        """Ship reserved inventory (remove from stock)."""
        self._ensure_active()
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if quantity > self.quantity_reserved:
            raise ValueError("Cannot ship more than reserved")

        self.quantity_on_hand -= quantity
        self.quantity_reserved -= quantity
        self._raise_event(InventoryShipped(
            aggregate_id=self.id,
            quantity=quantity,
            order_id=order_id,
        ))

    def adjust(self, quantity_delta: int, reason: str) -> None:
        """Manual inventory adjustment."""
        self._ensure_active()
        new_quantity = self.quantity_on_hand + quantity_delta
        if new_quantity < self.quantity_reserved:
            raise ValueError("Adjustment would make available quantity negative")

        self.quantity_on_hand = new_quantity
        self._raise_event(InventoryAdjusted(
            aggregate_id=self.id,
            quantity_delta=quantity_delta,
            reason=reason,
        ))

    def set_reorder_level(self, new_level: int) -> None:
        """Update reorder level."""
        self._ensure_active()
        if new_level < 0:
            raise ValueError("Reorder level cannot be negative")

        old_level = self.reorder_level
        self.reorder_level = new_level
        self._raise_event(ReorderLevelChanged(
            aggregate_id=self.id,
            old_level=old_level,
            new_level=new_level,
        ))

    def deactivate(self, reason: str) -> None:
        """Deactivate the item (soft delete)."""
        if self.quantity_reserved > 0:
            raise ValueError("Cannot deactivate item with active reservations")

        self.status = InventoryStatus.INACTIVE
        self._raise_event(ItemDeactivated(
            aggregate_id=self.id,
            reason=reason,
        ))

    def _ensure_active(self) -> None:
        if self.status != InventoryStatus.ACTIVE:
            raise ValueError("Item is not active")

    def _raise_event(self, event: DomainEvent) -> None:
        self._pending_events.append(event)

    @property
    def pending_events(self) -> list[DomainEvent]:
        events = self._pending_events.copy()
        self._pending_events.clear()
        return events


# =============================================================================
# Commands
# =============================================================================

class Command(BaseModel):
    """Base command."""
    command_id: UUID = Field(default_factory=uuid7)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: UUID | None = None

    class Config:
        frozen = True


class CreateInventoryItem(Command):
    sku: str
    name: str
    description: str = ""
    initial_quantity: int = 0
    reorder_level: int = 10
    unit_cost: Decimal


class ReceiveInventory(Command):
    item_id: UUID
    quantity: int
    source: str = "purchase_order"
    reference_id: str | None = None


class ReserveInventory(Command):
    item_id: UUID
    quantity: int
    order_id: UUID


class ReleaseReservation(Command):
    item_id: UUID
    quantity: int
    order_id: UUID


class ShipInventory(Command):
    item_id: UUID
    quantity: int
    order_id: UUID


class AdjustInventory(Command):
    item_id: UUID
    quantity_delta: int
    reason: str


class DeactivateItem(Command):
    item_id: UUID
    reason: str


# =============================================================================
# Command Handlers
# =============================================================================

class CommandHandler(ABC):
    @abstractmethod
    async def handle(self, command: Command) -> list[DomainEvent]:
        pass


class InventoryCommandHandler(CommandHandler):
    """Handles all inventory commands."""

    def __init__(self, repository: "InventoryRepository"):
        self.repository = repository

    async def handle(self, command: Command) -> list[DomainEvent]:
        match command:
            case CreateInventoryItem():
                return await self._create(command)
            case ReceiveInventory():
                return await self._receive(command)
            case ReserveInventory():
                return await self._reserve(command)
            case ReleaseReservation():
                return await self._release(command)
            case ShipInventory():
                return await self._ship(command)
            case AdjustInventory():
                return await self._adjust(command)
            case DeactivateItem():
                return await self._deactivate(command)
            case _:
                raise ValueError(f"Unknown command: {type(command)}")

    async def _create(self, cmd: CreateInventoryItem) -> list[DomainEvent]:
        # Check for duplicate SKU
        existing = await self.repository.find_by_sku(cmd.sku)
        if existing:
            raise ValueError(f"SKU {cmd.sku} already exists")

        item = InventoryItem.create(
            sku=cmd.sku,
            name=cmd.name,
            description=cmd.description,
            initial_quantity=cmd.initial_quantity,
            reorder_level=cmd.reorder_level,
            unit_cost=cmd.unit_cost,
        )
        await self.repository.save(item)
        return item.pending_events

    async def _receive(self, cmd: ReceiveInventory) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.receive(cmd.quantity, cmd.source, cmd.reference_id)
        await self.repository.save(item)
        return item.pending_events

    async def _reserve(self, cmd: ReserveInventory) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.reserve(cmd.quantity, cmd.order_id)
        await self.repository.save(item)
        return item.pending_events

    async def _release(self, cmd: ReleaseReservation) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.release_reservation(cmd.quantity, cmd.order_id)
        await self.repository.save(item)
        return item.pending_events

    async def _ship(self, cmd: ShipInventory) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.ship(cmd.quantity, cmd.order_id)
        await self.repository.save(item)
        return item.pending_events

    async def _adjust(self, cmd: AdjustInventory) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.adjust(cmd.quantity_delta, cmd.reason)
        await self.repository.save(item)
        return item.pending_events

    async def _deactivate(self, cmd: DeactivateItem) -> list[DomainEvent]:
        item = await self.repository.get(cmd.item_id)
        if not item:
            raise ValueError(f"Item {cmd.item_id} not found")

        item.deactivate(cmd.reason)
        await self.repository.save(item)
        return item.pending_events


# =============================================================================
# Repository (Write Model Persistence)
# =============================================================================

class InventoryRepository:
    """Repository for InventoryItem aggregate."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, item_id: UUID) -> InventoryItem | None:
        result = await self.session.execute(
            text("""
                SELECT id, sku, name, description, quantity_on_hand,
                       quantity_reserved, reorder_level, unit_cost, status, version
                FROM inventory_items WHERE id = :id
            """),
            {"id": item_id},
        )
        row = result.mappings().first()
        if not row:
            return None

        return InventoryItem(
            id=row["id"],
            sku=row["sku"],
            name=row["name"],
            description=row["description"],
            quantity_on_hand=row["quantity_on_hand"],
            quantity_reserved=row["quantity_reserved"],
            reorder_level=row["reorder_level"],
            unit_cost=row["unit_cost"],
            status=InventoryStatus(row["status"]),
            version=row["version"],
        )

    async def find_by_sku(self, sku: str) -> InventoryItem | None:
        result = await self.session.execute(
            text("SELECT id FROM inventory_items WHERE sku = :sku"),
            {"sku": sku},
        )
        row = result.first()
        if not row:
            return None
        return await self.get(row[0])

    async def save(self, item: InventoryItem) -> None:
        await self.session.execute(
            text("""
                INSERT INTO inventory_items (
                    id, sku, name, description, quantity_on_hand,
                    quantity_reserved, reorder_level, unit_cost, status, version
                ) VALUES (
                    :id, :sku, :name, :description, :quantity_on_hand,
                    :quantity_reserved, :reorder_level, :unit_cost, :status, :version
                )
                ON CONFLICT (id) DO UPDATE SET
                    quantity_on_hand = :quantity_on_hand,
                    quantity_reserved = :quantity_reserved,
                    reorder_level = :reorder_level,
                    status = :status,
                    version = :version
            """),
            {
                "id": item.id,
                "sku": item.sku,
                "name": item.name,
                "description": item.description,
                "quantity_on_hand": item.quantity_on_hand,
                "quantity_reserved": item.quantity_reserved,
                "reorder_level": item.reorder_level,
                "unit_cost": item.unit_cost,
                "status": item.status.value,
                "version": item.version + 1,
            },
        )
        await self.session.commit()


# =============================================================================
# Query Side (Read Models)
# =============================================================================

class InventoryListView(BaseModel):
    """Read model optimized for listing."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sku: str
    name: str
    quantity_available: int
    quantity_reserved: int
    status: str
    needs_reorder: bool


class InventoryDetailView(BaseModel):
    """Read model with full details."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sku: str
    name: str
    description: str
    quantity_on_hand: int
    quantity_reserved: int
    quantity_available: int
    reorder_level: int
    unit_cost: Decimal
    status: str
    total_value: Decimal
    needs_reorder: bool
    recent_movements: list["InventoryMovementView"]


class InventoryMovementView(BaseModel):
    """Inventory movement history."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_id: UUID
    movement_type: str
    quantity: int
    reference: str | None
    created_at: datetime


class LowStockView(BaseModel):
    """Items below reorder level."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sku: str
    name: str
    quantity_available: int
    reorder_level: int
    shortfall: int


# =============================================================================
# Queries
# =============================================================================

class QueryBase(BaseModel):
    class Config:
        frozen = True


class GetInventoryItem(QueryBase):
    item_id: UUID


class ListInventory(QueryBase):
    status: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20


class GetLowStockItems(QueryBase):
    pass


class GetInventoryValue(QueryBase):
    pass


# =============================================================================
# Query Handlers
# =============================================================================

class InventoryQueryHandler:
    """Handles inventory queries against read models."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_item(self, query: GetInventoryItem) -> InventoryDetailView | None:
        # Get item details
        result = await self.session.execute(
            text("""
                SELECT id, sku, name, description, quantity_on_hand,
                       quantity_reserved, reorder_level, unit_cost, status
                FROM inventory_read_model WHERE id = :id
            """),
            {"id": query.item_id},
        )
        row = result.mappings().first()
        if not row:
            return None

        quantity_available = row["quantity_on_hand"] - row["quantity_reserved"]

        # Get recent movements
        movements_result = await self.session.execute(
            text("""
                SELECT id, item_id, movement_type, quantity, reference, created_at
                FROM inventory_movements
                WHERE item_id = :item_id
                ORDER BY created_at DESC
                LIMIT 10
            """),
            {"item_id": query.item_id},
        )
        movements = [
            InventoryMovementView(**m) for m in movements_result.mappings()
        ]

        return InventoryDetailView(
            id=row["id"],
            sku=row["sku"],
            name=row["name"],
            description=row["description"],
            quantity_on_hand=row["quantity_on_hand"],
            quantity_reserved=row["quantity_reserved"],
            quantity_available=quantity_available,
            reorder_level=row["reorder_level"],
            unit_cost=row["unit_cost"],
            status=row["status"],
            total_value=row["quantity_on_hand"] * row["unit_cost"],
            needs_reorder=quantity_available <= row["reorder_level"],
            recent_movements=movements,
        )

    async def list_inventory(self, query: ListInventory) -> dict:
        conditions = ["1=1"]
        params: dict[str, Any] = {}

        if query.status:
            conditions.append("status = :status")
            params["status"] = query.status

        if query.search:
            conditions.append("(sku ILIKE :search OR name ILIKE :search)")
            params["search"] = f"%{query.search}%"

        where_clause = " AND ".join(conditions)
        offset = (query.page - 1) * query.page_size
        params["limit"] = query.page_size
        params["offset"] = offset

        # Get total count
        count_result = await self.session.execute(
            text(f"SELECT COUNT(*) FROM inventory_read_model WHERE {where_clause}"),
            params,
        )
        total = count_result.scalar() or 0

        # Get items
        result = await self.session.execute(
            text(f"""
                SELECT id, sku, name, quantity_on_hand, quantity_reserved,
                       reorder_level, status
                FROM inventory_read_model
                WHERE {where_clause}
                ORDER BY name
                LIMIT :limit OFFSET :offset
            """),
            params,
        )

        items = []
        for row in result.mappings():
            quantity_available = row["quantity_on_hand"] - row["quantity_reserved"]
            items.append(InventoryListView(
                id=row["id"],
                sku=row["sku"],
                name=row["name"],
                quantity_available=quantity_available,
                quantity_reserved=row["quantity_reserved"],
                status=row["status"],
                needs_reorder=quantity_available <= row["reorder_level"],
            ))

        return {
            "items": items,
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
        }

    async def get_low_stock(self, query: GetLowStockItems) -> list[LowStockView]:
        result = await self.session.execute(
            text("""
                SELECT id, sku, name, quantity_on_hand, quantity_reserved, reorder_level
                FROM inventory_read_model
                WHERE status = 'active'
                  AND (quantity_on_hand - quantity_reserved) <= reorder_level
                ORDER BY (quantity_on_hand - quantity_reserved) - reorder_level
            """),
        )

        return [
            LowStockView(
                id=row["id"],
                sku=row["sku"],
                name=row["name"],
                quantity_available=row["quantity_on_hand"] - row["quantity_reserved"],
                reorder_level=row["reorder_level"],
                shortfall=row["reorder_level"] - (row["quantity_on_hand"] - row["quantity_reserved"]),
            )
            for row in result.mappings()
        ]


# =============================================================================
# Projection
# =============================================================================

class InventoryProjection:
    """Projects events to inventory read models."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def handle(self, event: DomainEvent) -> None:
        match event:
            case InventoryItemCreated():
                await self._on_created(event)
            case InventoryReceived():
                await self._on_received(event)
            case InventoryReserved():
                await self._on_reserved(event)
            case InventoryReservationReleased():
                await self._on_released(event)
            case InventoryShipped():
                await self._on_shipped(event)
            case InventoryAdjusted():
                await self._on_adjusted(event)
            case ItemDeactivated():
                await self._on_deactivated(event)

    async def _on_created(self, event: InventoryItemCreated) -> None:
        await self.session.execute(
            text("""
                INSERT INTO inventory_read_model (
                    id, sku, name, description, quantity_on_hand,
                    quantity_reserved, reorder_level, unit_cost, status
                ) VALUES (
                    :id, :sku, :name, :description, :quantity,
                    0, :reorder_level, :unit_cost, 'active'
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = :name, description = :description
            """),
            {
                "id": event.aggregate_id,
                "sku": event.sku,
                "name": event.name,
                "description": event.description,
                "quantity": event.initial_quantity,
                "reorder_level": event.reorder_level,
                "unit_cost": event.unit_cost,
            },
        )

        if event.initial_quantity > 0:
            await self._record_movement(
                event.aggregate_id, "initial", event.initial_quantity, "Initial stock"
            )

        await self.session.commit()

    async def _on_received(self, event: InventoryReceived) -> None:
        await self.session.execute(
            text("""
                UPDATE inventory_read_model
                SET quantity_on_hand = quantity_on_hand + :quantity
                WHERE id = :id
            """),
            {"id": event.aggregate_id, "quantity": event.quantity},
        )

        await self._record_movement(
            event.aggregate_id, "received", event.quantity,
            f"{event.source}: {event.reference_id or 'N/A'}",
        )
        await self.session.commit()

    async def _on_reserved(self, event: InventoryReserved) -> None:
        await self.session.execute(
            text("""
                UPDATE inventory_read_model
                SET quantity_reserved = quantity_reserved + :quantity
                WHERE id = :id
            """),
            {"id": event.aggregate_id, "quantity": event.quantity},
        )

        await self._record_movement(
            event.aggregate_id, "reserved", event.quantity,
            f"Order: {event.order_id}",
        )
        await self.session.commit()

    async def _on_released(self, event: InventoryReservationReleased) -> None:
        await self.session.execute(
            text("""
                UPDATE inventory_read_model
                SET quantity_reserved = quantity_reserved - :quantity
                WHERE id = :id
            """),
            {"id": event.aggregate_id, "quantity": event.quantity},
        )

        await self._record_movement(
            event.aggregate_id, "released", event.quantity,
            f"Order cancelled: {event.order_id}",
        )
        await self.session.commit()

    async def _on_shipped(self, event: InventoryShipped) -> None:
        await self.session.execute(
            text("""
                UPDATE inventory_read_model
                SET quantity_on_hand = quantity_on_hand - :quantity,
                    quantity_reserved = quantity_reserved - :quantity
                WHERE id = :id
            """),
            {"id": event.aggregate_id, "quantity": event.quantity},
        )

        await self._record_movement(
            event.aggregate_id, "shipped", -event.quantity,
            f"Order: {event.order_id}",
        )
        await self.session.commit()

    async def _on_adjusted(self, event: InventoryAdjusted) -> None:
        await self.session.execute(
            text("""
                UPDATE inventory_read_model
                SET quantity_on_hand = quantity_on_hand + :delta
                WHERE id = :id
            """),
            {"id": event.aggregate_id, "delta": event.quantity_delta},
        )

        await self._record_movement(
            event.aggregate_id, "adjustment", event.quantity_delta, event.reason,
        )
        await self.session.commit()

    async def _on_deactivated(self, event: ItemDeactivated) -> None:
        await self.session.execute(
            text("UPDATE inventory_read_model SET status = 'inactive' WHERE id = :id"),
            {"id": event.aggregate_id},
        )
        await self.session.commit()

    async def _record_movement(
        self, item_id: UUID, movement_type: str, quantity: int, reference: str
    ) -> None:
        await self.session.execute(
            text("""
                INSERT INTO inventory_movements (id, item_id, movement_type, quantity, reference)
                VALUES (:id, :item_id, :type, :quantity, :reference)
            """),
            {
                "id": uuid7(),
                "item_id": item_id,
                "type": movement_type,
                "quantity": quantity,
                "reference": reference,
            },
        )


# =============================================================================
# FastAPI Application
# =============================================================================

# Database setup
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/inventory_cqrs"
engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


# Event publisher (in-memory for demo, use message queue in production)
class EventPublisher:
    def __init__(self):
        self._subscribers: list = []

    def subscribe(self, handler):
        self._subscribers.append(handler)

    async def publish(self, event: DomainEvent):
        for handler in self._subscribers:
            await handler(event)


event_publisher = EventPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup projection
    async with async_session() as session:
        projection = InventoryProjection(session)
        event_publisher.subscribe(projection.handle)
    yield


app = FastAPI(title="Inventory CQRS API", lifespan=lifespan)


# Command endpoints
@app.post("/api/v1/inventory", status_code=201)
async def create_item(
    sku: str,
    name: str,
    description: str = "",
    initial_quantity: int = 0,
    reorder_level: int = 10,
    unit_cost: Decimal = Decimal("0"),
    session: AsyncSession = Depends(get_session),
):
    repository = InventoryRepository(session)
    handler = InventoryCommandHandler(repository)

    command = CreateInventoryItem(
        sku=sku,
        name=name,
        description=description,
        initial_quantity=initial_quantity,
        reorder_level=reorder_level,
        unit_cost=unit_cost,
    )

    try:
        events = await handler.handle(command)
        for event in events:
            await event_publisher.publish(event)
        return {"item_id": events[0].aggregate_id}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/v1/inventory/{item_id}/receive")
async def receive_inventory(
    item_id: UUID,
    quantity: int,
    source: str = "purchase_order",
    reference_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    repository = InventoryRepository(session)
    handler = InventoryCommandHandler(repository)

    command = ReceiveInventory(
        item_id=item_id,
        quantity=quantity,
        source=source,
        reference_id=reference_id,
    )

    try:
        events = await handler.handle(command)
        for event in events:
            await event_publisher.publish(event)
        return {"status": "received"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/v1/inventory/{item_id}/reserve")
async def reserve_inventory(
    item_id: UUID,
    quantity: int,
    order_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    repository = InventoryRepository(session)
    handler = InventoryCommandHandler(repository)

    command = ReserveInventory(
        item_id=item_id,
        quantity=quantity,
        order_id=order_id,
    )

    try:
        events = await handler.handle(command)
        for event in events:
            await event_publisher.publish(event)
        return {"status": "reserved"}
    except ValueError as e:
        raise HTTPException(400, str(e))


# Query endpoints
@app.get("/api/v1/inventory/{item_id}")
async def get_item(
    item_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    handler = InventoryQueryHandler(session)
    item = await handler.get_item(GetInventoryItem(item_id=item_id))
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@app.get("/api/v1/inventory")
async def list_inventory(
    status: str | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    handler = InventoryQueryHandler(session)
    return await handler.list_inventory(ListInventory(
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    ))


@app.get("/api/v1/inventory/low-stock")
async def get_low_stock(session: AsyncSession = Depends(get_session)):
    handler = InventoryQueryHandler(session)
    return await handler.get_low_stock(GetLowStockItems())


# =============================================================================
# Database Schema (Run once)
# =============================================================================

SCHEMA = """
-- Write model (aggregate storage)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    quantity_reserved INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Read model (denormalized for queries)
CREATE TABLE IF NOT EXISTS inventory_read_model (
    id UUID PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    quantity_reserved INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_inventory_read_status ON inventory_read_model(status);
CREATE INDEX IF NOT EXISTS idx_inventory_read_sku ON inventory_read_model(sku);

-- Movement history for audit trail
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id, created_at DESC);
"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Order Management CQRS Example

Complete order management system using CQRS with event sourcing.

## Domain Events

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass(frozen=True)
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass(frozen=True)
class OrderCreated(DomainEvent):
    aggregate_id: UUID
    customer_id: UUID
    shipping_address: dict
    version: int = 1

@dataclass(frozen=True)
class OrderItemAdded(DomainEvent):
    aggregate_id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: float
    version: int

@dataclass(frozen=True)
class OrderSubmitted(DomainEvent):
    aggregate_id: UUID
    total_amount: float
    version: int

@dataclass(frozen=True)
class OrderCancelled(DomainEvent):
    aggregate_id: UUID
    reason: str
    version: int
```

## Aggregate

```python
from dataclasses import dataclass, field
from enum import Enum

class OrderStatus(Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    CANCELLED = "cancelled"

@dataclass
class OrderItem:
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: float

    @property
    def subtotal(self) -> float:
        return self.quantity * self.unit_price

@dataclass
class Order:
    id: UUID
    customer_id: UUID
    status: OrderStatus = OrderStatus.DRAFT
    items: list[OrderItem] = field(default_factory=list)
    shipping_address: dict = field(default_factory=dict)
    _version: int = 0
    _changes: list[DomainEvent] = field(default_factory=list)

    @classmethod
    def create(cls, customer_id: UUID, shipping_address: dict) -> "Order":
        order = cls(id=uuid4(), customer_id=customer_id)
        order._raise(OrderCreated(
            aggregate_id=order.id,
            customer_id=customer_id,
            shipping_address=shipping_address,
            version=1,
        ))
        return order

    def add_item(self, product_id: UUID, name: str, qty: int, price: float) -> None:
        if self.status != OrderStatus.DRAFT:
            raise InvalidOperationError("Cannot add items to non-draft order")
        self._raise(OrderItemAdded(
            aggregate_id=self.id,
            product_id=product_id,
            product_name=name,
            quantity=qty,
            unit_price=price,
            version=self._next_version(),
        ))

    def submit(self) -> None:
        if self.status != OrderStatus.DRAFT:
            raise InvalidOperationError("Order already submitted")
        if not self.items:
            raise InvalidOperationError("Cannot submit empty order")
        self._raise(OrderSubmitted(
            aggregate_id=self.id,
            total_amount=self.total,
            version=self._next_version(),
        ))

    def cancel(self, reason: str) -> None:
        if self.status == OrderStatus.CANCELLED:
            raise InvalidOperationError("Order already cancelled")
        self._raise(OrderCancelled(
            aggregate_id=self.id,
            reason=reason,
            version=self._next_version(),
        ))

    @property
    def total(self) -> float:
        return sum(item.subtotal for item in self.items)

    def _apply(self, event: DomainEvent) -> None:
        match event:
            case OrderCreated():
                self.customer_id = event.customer_id
                self.shipping_address = event.shipping_address
                self.status = OrderStatus.DRAFT
            case OrderItemAdded():
                self.items.append(OrderItem(
                    product_id=event.product_id,
                    product_name=event.product_name,
                    quantity=event.quantity,
                    unit_price=event.unit_price,
                ))
            case OrderSubmitted():
                self.status = OrderStatus.SUBMITTED
            case OrderCancelled():
                self.status = OrderStatus.CANCELLED

    def _raise(self, event: DomainEvent) -> None:
        self._apply(event)
        self._changes.append(event)

    def _next_version(self) -> int:
        return self._version + len(self._changes) + 1

    def load_from_history(self, events: list[DomainEvent]) -> None:
        for event in events:
            self._apply(event)
            self._version = event.version
```

## Commands and Handlers

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class CreateOrder:
    customer_id: UUID
    shipping_address: dict
    command_id: UUID = field(default_factory=uuid4)
    idempotency_key: str | None = None

@dataclass(frozen=True)
class AddOrderItem:
    order_id: UUID
    product_id: UUID
    quantity: int
    command_id: UUID = field(default_factory=uuid4)

@dataclass(frozen=True)
class SubmitOrder:
    order_id: UUID
    command_id: UUID = field(default_factory=uuid4)

class CreateOrderHandler:
    def __init__(self, repo: "OrderRepository"):
        self.repo = repo

    async def handle(self, cmd: CreateOrder) -> list[DomainEvent]:
        order = Order.create(cmd.customer_id, cmd.shipping_address)
        await self.repo.save(order)
        return list(order._changes)

class AddOrderItemHandler:
    def __init__(self, repo: "OrderRepository", products: "ProductService"):
        self.repo = repo
        self.products = products

    async def handle(self, cmd: AddOrderItem) -> list[DomainEvent]:
        order = await self.repo.load(cmd.order_id)
        product = await self.products.get(cmd.product_id)
        order.add_item(cmd.product_id, product.name, cmd.quantity, product.price)
        await self.repo.save(order)
        return list(order._changes)

class SubmitOrderHandler:
    def __init__(self, repo: "OrderRepository"):
        self.repo = repo

    async def handle(self, cmd: SubmitOrder) -> list[DomainEvent]:
        order = await self.repo.load(cmd.order_id)
        order.submit()
        await self.repo.save(order)
        return list(order._changes)
```

## Queries and Handlers

```python
@dataclass
class GetOrderById:
    order_id: UUID

@dataclass
class GetCustomerOrders:
    customer_id: UUID
    status: str | None = None
    page_size: int = 20
    cursor: str | None = None

@dataclass
class OrderView:
    id: UUID
    customer_id: UUID
    customer_name: str
    status: str
    total_amount: float
    item_count: int
    items: list[dict]
    created_at: datetime

class GetOrderByIdHandler:
    def __init__(self, db: "AsyncSession"):
        self.db = db

    async def handle(self, query: GetOrderById) -> OrderView | None:
        result = await self.db.execute(
            select(OrderReadModel)
            .where(OrderReadModel.id == query.order_id)
            .options(selectinload(OrderReadModel.items))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return OrderView(
            id=row.id,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            status=row.status,
            total_amount=row.total_amount,
            item_count=len(row.items),
            items=[{"product": i.product_name, "qty": i.quantity} for i in row.items],
            created_at=row.created_at,
        )
```

## Projection

```python
class OrderProjection:
    projection_name = "order_summary"

    def __init__(self, db: "AsyncSession", customers: "CustomerService"):
        self.db = db
        self.customers = customers

    async def handle(self, event: DomainEvent) -> None:
        match event:
            case OrderCreated():
                await self._on_created(event)
            case OrderItemAdded():
                await self._on_item_added(event)
            case OrderSubmitted():
                await self._on_submitted(event)
            case OrderCancelled():
                await self._on_cancelled(event)

    async def _on_created(self, event: OrderCreated) -> None:
        customer = await self.customers.get(event.customer_id)
        await self.db.execute(
            insert(order_summary).values(
                id=event.aggregate_id,
                customer_id=event.customer_id,
                customer_name=customer.name,
                status="draft",
                total_amount=0,
                item_count=0,
                created_at=event.timestamp,
                event_version=event.version,
            ).on_conflict_do_update(
                index_elements=["id"],
                set_={"event_version": event.version},
                where=order_summary.c.event_version < event.version,
            )
        )

    async def _on_item_added(self, event: OrderItemAdded) -> None:
        # Insert item
        await self.db.execute(
            insert(order_items).values(
                order_id=event.aggregate_id,
                product_id=event.product_id,
                product_name=event.product_name,
                quantity=event.quantity,
                unit_price=event.unit_price,
            ).on_conflict_do_update(
                index_elements=["order_id", "product_id"],
                set_={"quantity": event.quantity},
            )
        )
        # Update totals
        subtotal = event.quantity * event.unit_price
        await self.db.execute(
            update(order_summary)
            .where(order_summary.c.id == event.aggregate_id)
            .where(order_summary.c.event_version < event.version)
            .values(
                total_amount=order_summary.c.total_amount + subtotal,
                item_count=order_summary.c.item_count + 1,
                event_version=event.version,
            )
        )

    async def _on_submitted(self, event: OrderSubmitted) -> None:
        await self.db.execute(
            update(order_summary)
            .where(order_summary.c.id == event.aggregate_id)
            .where(order_summary.c.event_version < event.version)
            .values(status="submitted", event_version=event.version)
        )

    async def _on_cancelled(self, event: OrderCancelled) -> None:
        await self.db.execute(
            update(order_summary)
            .where(order_summary.c.id == event.aggregate_id)
            .where(order_summary.c.event_version < event.version)
            .values(status="cancelled", event_version=event.version)
        )

    async def reset(self) -> None:
        await self.db.execute(delete(order_items))
        await self.db.execute(delete(order_summary))
```

## FastAPI Integration

```python
from fastapi import FastAPI, Depends, HTTPException

app = FastAPI()

@app.post("/api/v1/orders", status_code=201)
async def create_order(
    request: CreateOrderRequest,
    command_bus: CommandBus = Depends(get_command_bus),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    command = CreateOrder(
        customer_id=request.customer_id,
        shipping_address=request.shipping_address.model_dump(),
        idempotency_key=idempotency_key,
    )
    events = await command_bus.dispatch(command)
    return {"order_id": str(events[0].aggregate_id)}

@app.post("/api/v1/orders/{order_id}/items")
async def add_item(
    order_id: UUID,
    request: AddItemRequest,
    command_bus: CommandBus = Depends(get_command_bus),
):
    command = AddOrderItem(
        order_id=order_id,
        product_id=request.product_id,
        quantity=request.quantity,
    )
    await command_bus.dispatch(command)
    return {"status": "item_added"}

@app.post("/api/v1/orders/{order_id}/submit")
async def submit_order(
    order_id: UUID,
    command_bus: CommandBus = Depends(get_command_bus),
):
    await command_bus.dispatch(SubmitOrder(order_id=order_id))
    return {"status": "submitted"}

@app.get("/api/v1/orders/{order_id}")
async def get_order(
    order_id: UUID,
    query_bus: QueryBus = Depends(get_query_bus),
):
    order = await query_bus.dispatch(GetOrderById(order_id=order_id))
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@app.get("/api/v1/customers/{customer_id}/orders")
async def get_customer_orders(
    customer_id: UUID,
    status: str | None = None,
    cursor: str | None = None,
    query_bus: QueryBus = Depends(get_query_bus),
):
    return await query_bus.dispatch(GetCustomerOrders(
        customer_id=customer_id,
        status=status,
        cursor=cursor,
    ))
```

## Read Model Schema

```sql
CREATE TABLE order_summary (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    item_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ,
    event_version INT NOT NULL DEFAULT 0
);

CREATE TABLE order_items (
    order_id UUID NOT NULL REFERENCES order_summary(id),
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

CREATE INDEX idx_order_summary_customer ON order_summary(customer_id);
CREATE INDEX idx_order_summary_status ON order_summary(status);
CREATE INDEX idx_order_summary_created ON order_summary(created_at DESC);
```

## Key Patterns Demonstrated

| Pattern | Implementation |
|---------|----------------|
| Command immutability | Frozen dataclasses |
| Idempotency | Command idempotency_key + middleware |
| Event sourcing | Aggregate raises events, stores in event store |
| Projections | Idempotent upserts with version guards |
| Cursor pagination | Encode/decode cursor for efficient paging |
| Separation | Commands write, queries read from projections |

# Query Handlers

Query optimization and caching patterns for CQRS read operations.

## Query Bus Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   API/UI     │────>│  Query Bus  │────>│   Handler    │────>│ Read Model  │
└──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                     ┌─────▼─────┐        ┌─────▼─────┐
                     │   Cache   │        │   Index   │
                     └───────────┘        └───────────┘
```

## Query Definition

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Generic, TypeVar

T = TypeVar("T")

class Query(BaseModel):
    """Base query class."""
    include_deleted: bool = False

class PaginatedQuery(Query):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    cursor: str | None = None  # For cursor pagination

class GetOrderById(Query):
    order_id: UUID

class GetOrdersByCustomer(PaginatedQuery):
    customer_id: UUID
    status: "OrderStatus | None" = None
    from_date: datetime | None = None
    to_date: datetime | None = None

class SearchOrders(PaginatedQuery):
    query: str
    filters: dict[str, str] = Field(default_factory=dict)
    sort_by: str = "created_at"
    sort_order: str = "desc"
```

## Query Handler with Caching

```python
from functools import wraps
import hashlib
import json

class GetOrderByIdHandler:
    def __init__(self, read_db: "AsyncSession", cache: "Redis"):
        self.db = read_db
        self.cache = cache
        self.cache_ttl = 300  # 5 minutes

    async def handle(self, query: GetOrderById) -> "OrderView | None":
        # 1. Check cache first
        cache_key = f"order:{query.order_id}"
        cached = await self.cache.get(cache_key)
        if cached:
            return OrderView.model_validate_json(cached)

        # 2. Query read model
        result = await self.db.execute(
            select(OrderReadModel)
            .where(OrderReadModel.id == query.order_id)
            .options(selectinload(OrderReadModel.items))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None

        view = OrderView.model_validate(row)

        # 3. Cache result
        await self.cache.setex(
            cache_key,
            self.cache_ttl,
            view.model_dump_json()
        )

        return view


class GetOrdersByCustomerHandler:
    def __init__(self, read_db: "AsyncSession"):
        self.db = read_db

    async def handle(self, query: GetOrdersByCustomer) -> "PaginatedResult[OrderListView]":
        # Build dynamic query
        stmt = select(OrderReadModel).where(
            OrderReadModel.customer_id == query.customer_id
        )

        if query.status:
            stmt = stmt.where(OrderReadModel.status == query.status)
        if query.from_date:
            stmt = stmt.where(OrderReadModel.created_at >= query.from_date)
        if query.to_date:
            stmt = stmt.where(OrderReadModel.created_at <= query.to_date)

        # Cursor-based pagination (recommended for large datasets)
        if query.cursor:
            cursor_data = decode_cursor(query.cursor)
            stmt = stmt.where(
                OrderReadModel.created_at < cursor_data["created_at"]
            )

        stmt = stmt.order_by(OrderReadModel.created_at.desc())
        stmt = stmt.limit(query.page_size + 1)  # Fetch one extra to detect next page

        result = await self.db.execute(stmt)
        rows = result.scalars().all()

        has_next = len(rows) > query.page_size
        items = rows[:query.page_size]

        next_cursor = None
        if has_next and items:
            next_cursor = encode_cursor({"created_at": items[-1].created_at})

        return PaginatedResult(
            items=[OrderListView.model_validate(row) for row in items],
            next_cursor=next_cursor,
            has_next=has_next,
        )
```

## Query Bus with Caching Middleware

```python
class QueryBus:
    def __init__(self, cache: "Redis | None" = None):
        self._handlers: dict[type[Query], "QueryHandler"] = {}
        self.cache = cache

    def register(self, query_type: type[Query], handler: "QueryHandler") -> None:
        self._handlers[query_type] = handler

    async def dispatch(self, query: Query) -> any:
        handler = self._handlers.get(type(query))
        if not handler:
            raise NoHandlerError(f"No handler for {type(query).__name__}")
        return await handler.handle(query)


def cached_query(ttl_seconds: int = 300, key_prefix: str = "query"):
    """Decorator for caching query results."""
    def decorator(handler_method):
        @wraps(handler_method)
        async def wrapper(self, query: Query):
            if not hasattr(self, "cache") or not self.cache:
                return await handler_method(self, query)

            # Generate cache key from query params
            query_hash = hashlib.md5(
                query.model_dump_json().encode()
            ).hexdigest()[:16]
            cache_key = f"{key_prefix}:{type(query).__name__}:{query_hash}"

            # Check cache
            cached = await self.cache.get(cache_key)
            if cached:
                return json.loads(cached)

            # Execute query
            result = await handler_method(self, query)

            # Cache result
            await self.cache.setex(
                cache_key,
                ttl_seconds,
                json.dumps(result, default=str)
            )

            return result
        return wrapper
    return decorator
```

## Specialized Read Models

```python
# Different views for different query patterns

class OrderListView(BaseModel):
    """Lightweight view for listing."""
    id: UUID
    status: str
    total_amount: float
    item_count: int
    created_at: datetime

class OrderDetailView(BaseModel):
    """Full details for single order."""
    id: UUID
    customer: "CustomerSummary"
    items: list["OrderItemView"]
    status: str
    shipping_address: "AddressView"
    total_amount: float
    created_at: datetime
    updated_at: datetime
    status_history: list["StatusChange"]

class OrderAnalyticsView(BaseModel):
    """Aggregated view for reporting."""
    period: str
    total_orders: int
    total_revenue: float
    average_order_value: float
    orders_by_status: dict[str, int]
```

## Cache Invalidation Strategies

```python
class OrderCacheInvalidator:
    """Invalidate caches when events are processed."""

    def __init__(self, cache: "Redis"):
        self.cache = cache

    async def handle(self, event: "DomainEvent") -> None:
        match event:
            case OrderCreated() | OrderUpdated() | OrderCancelled():
                # Invalidate specific order
                await self.cache.delete(f"order:{event.aggregate_id}")
                # Invalidate customer's order list
                await self.cache.delete_pattern(
                    f"query:GetOrdersByCustomer:*{event.customer_id}*"
                )
            case OrderItemAdded() | OrderItemRemoved():
                await self.cache.delete(f"order:{event.order_id}")
```

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| Cache-aside | Single entity lookups |
| Cursor pagination | Large datasets, infinite scroll |
| Read replicas | High read throughput |
| Materialized views | Complex aggregations |
| Elasticsearch | Full-text search |
| Query projection | Different views per use case |

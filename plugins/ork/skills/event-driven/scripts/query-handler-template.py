"""
CQRS Query Bus Template

Ready-to-use query bus with:
- Type-safe query registration
- Caching middleware (Redis)
- Pagination support (cursor-based)
- Async query handling
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol, TypeVar
from uuid import UUID

# ============================================================
# QUERY BASE
# ============================================================


@dataclass
class Query:
    """Base query class."""

    include_deleted: bool = False


@dataclass
class PaginatedQuery(Query):
    """Query with pagination support."""

    page_size: int = 20
    cursor: str | None = None  # For cursor-based pagination


T = TypeVar("T")
Q = TypeVar("Q", bound=Query)


# ============================================================
# PAGINATED RESULT
# ============================================================


@dataclass
class PaginatedResult[T]:
    """Result container for paginated queries."""

    items: list[T]
    next_cursor: str | None = None
    has_next: bool = False
    total_count: int | None = None  # Optional, expensive to compute


# ============================================================
# HANDLER PROTOCOL
# ============================================================


class QueryHandler(Protocol[Q, T]):
    """Protocol for query handlers."""

    async def handle(self, query: Q) -> T:
        """Handle query and return result."""
        ...


# ============================================================
# CACHING
# ============================================================


class QueryCache(Protocol):
    """Protocol for query cache implementations."""

    async def get(self, key: str) -> str | None:
        ...

    async def setex(self, key: str, ttl: int, value: str) -> None:
        ...

    async def delete(self, key: str) -> None:
        ...

    async def delete_pattern(self, pattern: str) -> None:
        ...


class CachingMiddleware:
    """Middleware for caching query results."""

    def __init__(self, cache: QueryCache, default_ttl: int = 300):
        self.cache = cache
        self.default_ttl = default_ttl
        self._ttl_overrides: dict[type, int] = {}

    def set_ttl(self, query_type: type, ttl: int) -> None:
        """Set custom TTL for a query type."""
        self._ttl_overrides[query_type] = ttl

    def _get_cache_key(self, query: Query) -> str:
        """Generate deterministic cache key from query."""
        query_type = type(query).__name__
        # Convert query to dict and hash
        query_dict = {
            k: str(v) if isinstance(v, UUID) else v
            for k, v in query.__dict__.items()
        }
        query_hash = hashlib.md5(
            json.dumps(query_dict, sort_keys=True).encode()
        ).hexdigest()[:16]
        return f"query:{query_type}:{query_hash}"

    async def get_cached(self, query: Query) -> Any | None:
        """Get cached result for query."""
        key = self._get_cache_key(query)
        cached = await self.cache.get(key)
        if cached:
            return json.loads(cached)
        return None

    async def cache_result(self, query: Query, result: Any) -> None:
        """Cache query result."""
        key = self._get_cache_key(query)
        ttl = self._ttl_overrides.get(type(query), self.default_ttl)
        await self.cache.setex(key, ttl, json.dumps(result, default=str))

    async def invalidate(self, query_type: type, **filters) -> None:
        """Invalidate cached queries matching filters."""
        pattern = f"query:{query_type.__name__}:*"
        await self.cache.delete_pattern(pattern)


# ============================================================
# QUERY BUS
# ============================================================


class NoQueryHandlerError(Exception):
    """Raised when no handler is registered for a query."""

    pass


class QueryBus:
    """
    Query bus for dispatching queries to handlers.

    Usage:
        bus = QueryBus()
        bus.enable_caching(redis_client)
        bus.register(GetOrderById, GetOrderByIdHandler(db))

        result = await bus.dispatch(GetOrderById(order_id=uuid))
    """

    def __init__(self):
        self._handlers: dict[type[Query], QueryHandler] = {}
        self._caching: CachingMiddleware | None = None

    def register(
        self,
        query_type: type[Q],
        handler: QueryHandler[Q, T],
    ) -> None:
        """Register a handler for a query type."""
        self._handlers[query_type] = handler

    def enable_caching(
        self,
        cache: QueryCache,
        default_ttl: int = 300,
    ) -> CachingMiddleware:
        """Enable caching with the provided cache implementation."""
        self._caching = CachingMiddleware(cache, default_ttl)
        return self._caching

    async def dispatch(self, query: Query) -> Any:
        """
        Dispatch a query to its handler.

        Returns the query result.
        Raises NoQueryHandlerError if no handler is registered.
        """
        handler = self._handlers.get(type(query))
        if not handler:
            raise NoQueryHandlerError(
                f"No handler registered for {type(query).__name__}"
            )

        # Check cache first
        if self._caching:
            cached = await self._caching.get_cached(query)
            if cached is not None:
                return cached

        # Execute query
        result = await handler.handle(query)

        # Cache result
        if self._caching and result is not None:
            await self._caching.cache_result(query, result)

        return result


# ============================================================
# CURSOR PAGINATION UTILITIES
# ============================================================


def encode_cursor(data: dict) -> str:
    """Encode cursor data to string."""
    import base64

    json_str = json.dumps(data, default=str)
    return base64.urlsafe_b64encode(json_str.encode()).decode()


def decode_cursor(cursor: str) -> dict:
    """Decode cursor string to data."""
    import base64

    json_str = base64.urlsafe_b64decode(cursor.encode()).decode()
    return json.loads(json_str)


# ============================================================
# EXAMPLE USAGE
# ============================================================


@dataclass
class GetOrderById(Query):
    """Query to get a single order by ID."""

    order_id: UUID


@dataclass
class GetOrdersByCustomer(PaginatedQuery):
    """Query to get orders for a customer."""

    customer_id: UUID
    status: str | None = None
    from_date: datetime | None = None


@dataclass
class OrderView:
    """Read model for order display."""

    id: UUID
    customer_id: UUID
    customer_name: str
    status: str
    total_amount: float
    item_count: int
    created_at: datetime


class GetOrderByIdHandler:
    """Handler for GetOrderById query."""

    def __init__(self, read_db: "AsyncSession"):
        self.db = read_db

    async def handle(self, query: GetOrderById) -> OrderView | None:
        # Direct query against read model
        result = await self.db.execute(
            select(OrderReadModel).where(OrderReadModel.id == query.order_id)
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
            item_count=row.item_count,
            created_at=row.created_at,
        )


class GetOrdersByCustomerHandler:
    """Handler for GetOrdersByCustomer query with cursor pagination."""

    def __init__(self, read_db: "AsyncSession"):
        self.db = read_db

    async def handle(
        self, query: GetOrdersByCustomer
    ) -> PaginatedResult[OrderView]:
        # Build query
        stmt = select(OrderReadModel).where(
            OrderReadModel.customer_id == query.customer_id
        )

        if query.status:
            stmt = stmt.where(OrderReadModel.status == query.status)

        if query.from_date:
            stmt = stmt.where(OrderReadModel.created_at >= query.from_date)

        # Apply cursor
        if query.cursor:
            cursor_data = decode_cursor(query.cursor)
            stmt = stmt.where(
                OrderReadModel.created_at < cursor_data["created_at"]
            )

        # Order and limit (fetch one extra to detect next page)
        stmt = stmt.order_by(OrderReadModel.created_at.desc())
        stmt = stmt.limit(query.page_size + 1)

        result = await self.db.execute(stmt)
        rows = result.scalars().all()

        # Check if there's a next page
        has_next = len(rows) > query.page_size
        items = rows[: query.page_size]

        # Build next cursor
        next_cursor = None
        if has_next and items:
            next_cursor = encode_cursor(
                {"created_at": items[-1].created_at.isoformat()}
            )

        return PaginatedResult(
            items=[
                OrderView(
                    id=row.id,
                    customer_id=row.customer_id,
                    customer_name=row.customer_name,
                    status=row.status,
                    total_amount=row.total_amount,
                    item_count=row.item_count,
                    created_at=row.created_at,
                )
                for row in items
            ],
            next_cursor=next_cursor,
            has_next=has_next,
        )


# Type stubs
class AsyncSession(Protocol):
    async def execute(self, stmt: Any) -> Any:
        ...


class OrderReadModel:
    id: UUID
    customer_id: UUID
    customer_name: str
    status: str
    total_amount: float
    item_count: int
    created_at: datetime


def select(model: type) -> Any:
    ...

"""
Idempotency Middleware Template

Stripe-style idempotency implementation for FastAPI.
Supports both Redis (fast) and database (durable) backends.
"""

import hashlib
import json
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text, text
from sqlalchemy.ext.asyncio import AsyncSession

# =============================================================================
# CONFIGURATION
# =============================================================================

IDEMPOTENCY_TTL_SECONDS = 86400  # 24 hours
IDEMPOTENCY_LOCK_TIMEOUT = 60  # 1 minute


# =============================================================================
# DATABASE MODEL
# =============================================================================


class IdempotencyRecord:
    """SQLAlchemy model for idempotency tracking."""

    __tablename__ = "idempotency_records"

    idempotency_key = Column(String(64), primary_key=True)
    endpoint = Column(String(256), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_body = Column(Text, nullable=True)
    response_status = Column(Integer, default=200)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


# =============================================================================
# IDEMPOTENCY SERVICE
# =============================================================================


class IdempotencyService:
    """
    Idempotency service using database backend.

    For production with high throughput, consider adding Redis
    as a cache layer in front of the database.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    def _hash_request(self, body: dict) -> str:
        """Create deterministic hash of request body."""
        return hashlib.sha256(
            json.dumps(body, sort_keys=True, default=str).encode()
        ).hexdigest()

    async def check_idempotency(
        self,
        idempotency_key: str,
        endpoint: str,
        request_body: dict,
    ) -> dict | None:
        """
        Check if request was already processed.

        Returns:
            Cached response if exists, None otherwise.

        Raises:
            HTTPException: If key reused with different body.
        """
        result = await self.db.execute(
            text("""
                SELECT request_hash, response_body, response_status
                FROM idempotency_records
                WHERE idempotency_key = :key AND endpoint = :endpoint
            """),
            {"key": idempotency_key, "endpoint": endpoint},
        )
        row = result.fetchone()

        if not row:
            return None

        # Verify request body matches
        current_hash = self._hash_request(request_body)
        if row.request_hash != current_hash:
            raise HTTPException(
                status_code=422,
                detail="Idempotency key was already used with different request parameters",
            )

        return {
            "body": json.loads(row.response_body) if row.response_body else None,
            "status": row.response_status,
            "replayed": True,
        }

    async def save_response(
        self,
        idempotency_key: str,
        endpoint: str,
        request_body: dict,
        response_body: dict,
        status_code: int,
    ) -> None:
        """Save successful response for future replay."""
        request_hash = self._hash_request(request_body)
        expires_at = datetime.utcnow() + timedelta(seconds=IDEMPOTENCY_TTL_SECONDS)

        await self.db.execute(
            text("""
                INSERT INTO idempotency_records
                (idempotency_key, endpoint, request_hash, response_body, response_status, expires_at)
                VALUES (:key, :endpoint, :hash, :body, :status, :expires)
                ON CONFLICT (idempotency_key) DO NOTHING
            """),
            {
                "key": idempotency_key,
                "endpoint": endpoint,
                "hash": request_hash,
                "body": json.dumps(response_body),
                "status": status_code,
                "expires": expires_at,
            },
        )
        await self.db.commit()


# =============================================================================
# DEPENDENCY
# =============================================================================


async def get_idempotency_service(
    db: AsyncSession = Depends(),  # Replace with your get_db dependency
) -> IdempotencyService:
    """FastAPI dependency for idempotency service."""
    return IdempotencyService(db)


# =============================================================================
# DECORATOR FOR IDEMPOTENT ENDPOINTS
# =============================================================================


def idempotent(
    get_request_body: Callable[[Any], dict] | None = None,
):
    """
    Decorator to make an endpoint idempotent.

    Usage:
        @app.post("/orders")
        @idempotent()
        async def create_order(
            order: OrderCreate,
            idempotency_key: str = Header(...),
            idempotency: IdempotencyService = Depends(get_idempotency_service),
        ):
            ...
    """

    def decorator(
        func: Callable[..., Awaitable[Any]],
    ) -> Callable[..., Awaitable[Any]]:
        async def wrapper(
            *args,
            idempotency_key: str = Header(
                ...,
                alias="Idempotency-Key",
                description="Unique key for idempotent requests",
                min_length=1,
                max_length=64,
            ),
            idempotency: IdempotencyService = Depends(get_idempotency_service),
            request: Request = None,
            **kwargs,
        ) -> Any:
            # Extract request body
            if get_request_body:
                request_body = get_request_body(kwargs)
            elif request:
                request_body = await request.json()
            else:
                # Try to find Pydantic model in kwargs
                request_body = {}
                for value in kwargs.values():
                    if isinstance(value, BaseModel):
                        request_body = value.model_dump()
                        break

            endpoint = request.url.path if request else func.__name__

            # Check for existing response
            cached = await idempotency.check_idempotency(
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                request_body=request_body,
            )

            if cached:
                return JSONResponse(
                    content=cached["body"],
                    status_code=cached["status"],
                    headers={"Idempotent-Replayed": "true"},
                )

            # Process request
            result = await func(*args, **kwargs)

            # Determine response body and status
            if isinstance(result, JSONResponse):
                response_body = json.loads(result.body)
                status_code = result.status_code
            elif isinstance(result, dict):
                response_body = result
                status_code = 200
            elif isinstance(result, tuple) and len(result) == 2:
                response_body, status_code = result
            else:
                response_body = result
                status_code = 200

            # Save for replay (only success responses)
            if 200 <= status_code < 300:
                await idempotency.save_response(
                    idempotency_key=idempotency_key,
                    endpoint=endpoint,
                    request_body=request_body,
                    response_body=response_body,
                    status_code=status_code,
                )

            return result

        return wrapper

    return decorator


# =============================================================================
# CLEANUP JOB
# =============================================================================


async def cleanup_expired_records(db: AsyncSession, batch_size: int = 1000) -> int:
    """
    Delete expired idempotency records.

    Run as scheduled job (e.g., daily via APScheduler or Celery).
    """
    result = await db.execute(
        text("""
            DELETE FROM idempotency_records
            WHERE idempotency_key IN (
                SELECT idempotency_key FROM idempotency_records
                WHERE expires_at < NOW()
                LIMIT :batch_size
            )
        """),
        {"batch_size": batch_size},
    )
    await db.commit()
    return result.rowcount


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

app = FastAPI()


class OrderCreate(BaseModel):
    product_id: str
    quantity: int


class OrderResponse(BaseModel):
    order_id: str
    status: str


@app.post("/api/orders", response_model=OrderResponse, status_code=201)
@idempotent(get_request_body=lambda kwargs: kwargs["order"].model_dump())
async def create_order(
    order: OrderCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    idempotency: IdempotencyService = Depends(get_idempotency_service),
) -> OrderResponse:
    """
    Create a new order.

    This endpoint is idempotent - retrying with the same Idempotency-Key
    will return the same order without creating duplicates.
    """
    # Your order creation logic here
    new_order_id = "order_123"  # Replace with actual creation

    return OrderResponse(
        order_id=new_order_id,
        status="created",
    )


# =============================================================================
# MIGRATION SQL
# =============================================================================

MIGRATION_SQL = """
-- Create idempotency records table
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    endpoint VARCHAR(256) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_body TEXT,
    response_status INTEGER DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS ix_idempotency_expires
ON idempotency_records (expires_at);

-- Index for lookups
CREATE INDEX IF NOT EXISTS ix_idempotency_endpoint_key
ON idempotency_records (endpoint, idempotency_key);
"""

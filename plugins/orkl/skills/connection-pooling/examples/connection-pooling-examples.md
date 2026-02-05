# Connection Pooling Examples

## SQLAlchemy Async Pool with FastAPI

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool

# Configure engine with production settings
engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost:5432/db",

    # Pool sizing for medium-load service
    pool_size=20,
    max_overflow=10,

    # Connection health
    pool_pre_ping=True,
    pool_recycle=1800,  # 30 minutes

    # Timeouts
    pool_timeout=30,

    # Use queue pool (default for async)
    poolclass=AsyncAdaptedQueuePool,

    # Connection settings
    connect_args={
        "command_timeout": 60,
        "server_settings": {
            "statement_timeout": "60000",
            "lock_timeout": "10000",
        },
    },

    # Echo SQL in development
    echo=False,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage connection pool lifecycle."""
    # Startup: pool is lazy-initialized on first use
    yield
    # Shutdown: close all connections
    await engine.dispose()


app = FastAPI(lifespan=lifespan)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Connection checked out, used, returned automatically."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()
```

## Direct asyncpg Pool

```python
import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI

pool: asyncpg.Pool | None = None


async def setup_connection(conn: asyncpg.Connection):
    """Called for each new connection in pool."""
    await conn.execute("SET timezone TO 'UTC'")
    await conn.execute("SET statement_timeout TO '60s'")
    await conn.execute("SET lock_timeout TO '10s'")
    # Register custom type codecs
    await conn.set_type_codec(
        'json',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog'
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool

    # Create pool
    pool = await asyncpg.create_pool(
        "postgresql://user:pass@localhost:5432/db",

        # Pool sizing
        min_size=10,
        max_size=20,

        # Connection lifecycle
        max_inactive_connection_lifetime=300,  # 5 min idle timeout
        max_queries=50000,  # Recreate after N queries

        # Timeouts
        command_timeout=60,
        timeout=30,

        # Setup hook
        setup=setup_connection,
    )

    yield

    # Close pool
    await pool.close()


app = FastAPI(lifespan=lifespan)


@app.get("/data/{id}")
async def get_data(id: int):
    """Acquire connection from pool."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM data WHERE id = $1", id
        )
        return dict(row) if row else None


@app.post("/batch")
async def batch_operation(items: list[dict]):
    """Use transaction for batch operations."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                await conn.execute(
                    "INSERT INTO items (name, value) VALUES ($1, $2)",
                    item["name"], item["value"]
                )
    return {"inserted": len(items)}
```

## aiohttp Session with Connection Pool

```python
import aiohttp
from aiohttp import ClientTimeout, TCPConnector
from contextlib import asynccontextmanager
from fastapi import FastAPI

http_session: aiohttp.ClientSession | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_session

    # Configure connector
    connector = TCPConnector(
        # Connection limits
        limit=100,          # Total connections
        limit_per_host=20,  # Per-host limit

        # Keep-alive
        keepalive_timeout=30,
        enable_cleanup_closed=True,

        # DNS caching
        ttl_dns_cache=300,
        use_dns_cache=True,

        # SSL (for production, use proper SSL context)
        ssl=False,
    )

    # Configure timeouts
    timeout = ClientTimeout(
        total=30,       # Total request timeout
        connect=10,     # Connection timeout
        sock_read=20,   # Read timeout
        sock_connect=5, # Socket connect timeout
    )

    # Create session
    http_session = aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        headers={"User-Agent": "MyApp/1.0"},
    )

    yield

    # Close session (releases all connections)
    await http_session.close()


app = FastAPI(lifespan=lifespan)


@app.get("/external/{resource}")
async def fetch_external(resource: str):
    """Reuse connection from pool."""
    async with http_session.get(
        f"https://api.example.com/{resource}"
    ) as response:
        return await response.json()


@app.post("/webhook")
async def send_webhook(payload: dict):
    """POST with connection reuse."""
    async with http_session.post(
        "https://hooks.example.com/incoming",
        json=payload,
        headers={"X-Webhook-Token": "secret"},
    ) as response:
        return {"status": response.status}
```

## Pool Health Monitoring

```python
import asyncio
from prometheus_client import Gauge, Counter, Histogram
from sqlalchemy import event, text

# Prometheus metrics
pool_size_gauge = Gauge(
    "db_pool_size", "Current pool size"
)
pool_checked_out = Gauge(
    "db_pool_checked_out", "Connections in use"
)
pool_overflow = Gauge(
    "db_pool_overflow", "Overflow connections"
)
pool_checkout_time = Histogram(
    "db_pool_checkout_seconds",
    "Time to acquire connection",
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)
pool_errors = Counter(
    "db_pool_errors_total",
    "Pool errors",
    ["type"]
)


def setup_pool_monitoring(engine):
    """Register SQLAlchemy pool event listeners."""

    @event.listens_for(engine.sync_engine, "checkout")
    def on_checkout(dbapi_conn, connection_record, connection_proxy):
        connection_record.info["checkout_time"] = asyncio.get_event_loop().time()

    @event.listens_for(engine.sync_engine, "checkin")
    def on_checkin(dbapi_conn, connection_record):
        if "checkout_time" in connection_record.info:
            duration = asyncio.get_event_loop().time() - connection_record.info["checkout_time"]
            pool_checkout_time.observe(duration)

    @event.listens_for(engine.sync_engine, "connect")
    def on_connect(dbapi_conn, connection_record):
        pool_size_gauge.inc()

    @event.listens_for(engine.sync_engine, "close")
    def on_close(dbapi_conn, connection_record):
        pool_size_gauge.dec()


async def collect_pool_metrics(engine):
    """Collect pool metrics periodically."""
    while True:
        pool = engine.pool
        pool_size_gauge.set(pool.size())
        pool_checked_out.set(pool.checkedout())
        pool_overflow.set(pool.overflow())
        await asyncio.sleep(10)


# Health check endpoint
@app.get("/health/db")
async def db_health():
    """Check database connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "pool_size": engine.pool.size(),
            "checked_out": engine.pool.checkedout(),
            "overflow": engine.pool.overflow(),
        }
    except Exception as e:
        pool_errors.labels(type="health_check").inc()
        return {"status": "unhealthy", "error": str(e)}, 503
```

## Connection Retry with Backoff

```python
import asyncio
from functools import wraps
from sqlalchemy.exc import OperationalError, DisconnectionError

def with_db_retry(max_retries: int = 3, base_delay: float = 0.1):
    """Decorator for database operations with retry."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except (OperationalError, DisconnectionError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        await asyncio.sleep(delay)
                        continue
                    raise
            raise last_error
        return wrapper
    return decorator


@with_db_retry(max_retries=3)
async def get_user_with_retry(db: AsyncSession, user_id: int):
    """Database operation with automatic retry on connection errors."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()
```

## Multi-Database Pool Management

```python
from dataclasses import dataclass
from typing import Dict

@dataclass
class DatabaseConfig:
    url: str
    pool_size: int = 10
    max_overflow: int = 5


class MultiDatabaseManager:
    """Manage multiple database connection pools."""

    def __init__(self, configs: Dict[str, DatabaseConfig]):
        self.engines: Dict[str, AsyncEngine] = {}
        self.session_makers: Dict[str, async_sessionmaker] = {}

        for name, config in configs.items():
            engine = create_async_engine(
                config.url,
                pool_size=config.pool_size,
                max_overflow=config.max_overflow,
                pool_pre_ping=True,
            )
            self.engines[name] = engine
            self.session_makers[name] = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )

    def get_session(self, db_name: str) -> AsyncSession:
        """Get session for specific database."""
        return self.session_makers[db_name]()

    async def close_all(self):
        """Close all connection pools."""
        for engine in self.engines.values():
            await engine.dispose()


# Usage
db_manager = MultiDatabaseManager({
    "primary": DatabaseConfig(
        url="postgresql+asyncpg://user:pass@primary:5432/db",
        pool_size=20,
    ),
    "replica": DatabaseConfig(
        url="postgresql+asyncpg://user:pass@replica:5432/db",
        pool_size=30,  # More for read-heavy
    ),
    "analytics": DatabaseConfig(
        url="postgresql+asyncpg://user:pass@analytics:5432/db",
        pool_size=5,  # Less for batch jobs
    ),
})


@app.get("/users/{id}")
async def get_user(id: int):
    """Read from replica."""
    async with db_manager.get_session("replica") as session:
        result = await session.execute(
            select(User).where(User.id == id)
        )
        return result.scalar_one_or_none()


@app.post("/users")
async def create_user(user: UserCreate):
    """Write to primary."""
    async with db_manager.get_session("primary") as session:
        db_user = User(**user.model_dump())
        session.add(db_user)
        await session.commit()
        return db_user
```

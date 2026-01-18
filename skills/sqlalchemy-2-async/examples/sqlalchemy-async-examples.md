# SQLAlchemy 2.0 Async Examples

## Example 1: Complete FastAPI Setup

```python
# app/db/engine.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/db"

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# app/api/deps.py
from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# app/api/routes/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(selectinload(User.orders))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

## Example 2: Model with Proper Type Hints

```python
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )

    # Prevent accidental lazy loading
    orders: Mapped[list["Order"]] = relationship(
        back_populates="user",
        lazy="raise",
    )

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    total_cents: Mapped[int]
    status: Mapped[str] = mapped_column(String(20), default="pending")

    user: Mapped["User"] = relationship(back_populates="orders", lazy="raise")
    items: Mapped[list["OrderItem"]] = relationship(lazy="raise")
```

## Example 3: Repository Pattern

```python
from typing import Generic, TypeVar
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T", bound=Base)

class AsyncRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model: type[T]):
        self.session = session
        self.model = model

    async def get(self, id: UUID) -> T | None:
        return await self.session.get(self.model, id)

    async def get_by_ids(self, ids: list[UUID]) -> list[T]:
        if not ids:
            return []
        result = await self.session.execute(
            select(self.model).where(self.model.id.in_(ids))
        )
        return list(result.scalars().all())

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
    ) -> list[T]:
        result = await self.session.execute(
            select(self.model).offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, **kwargs) -> T:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, instance: T, **kwargs) -> T:
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def delete(self, instance: T) -> None:
        await self.session.delete(instance)
        await self.session.flush()


# Usage
class UserRepository(AsyncRepository[User]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, User)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_with_orders(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.orders))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
```

## Example 4: Bulk Operations

```python
async def bulk_create_users(
    db: AsyncSession,
    users_data: list[dict],
    chunk_size: int = 1000,
) -> int:
    """Efficiently insert many users in chunks."""
    total = 0

    for i in range(0, len(users_data), chunk_size):
        chunk = users_data[i:i + chunk_size]
        users = [User(**data) for data in chunk]
        db.add_all(users)
        await db.flush()  # Get IDs, manage memory
        total += len(chunk)

    return total


async def bulk_update_status(
    db: AsyncSession,
    order_ids: list[UUID],
    new_status: str,
) -> int:
    """Bulk update using UPDATE statement."""
    from sqlalchemy import update

    result = await db.execute(
        update(Order)
        .where(Order.id.in_(order_ids))
        .values(status=new_status)
    )
    return result.rowcount
```

## Example 5: Transaction Management

```python
from sqlalchemy.ext.asyncio import AsyncSession

async def transfer_funds(
    db: AsyncSession,
    from_account_id: UUID,
    to_account_id: UUID,
    amount: int,
) -> None:
    """Transfer with explicit transaction and row locking."""
    async with db.begin():  # Explicit transaction
        # Lock rows to prevent concurrent modification
        from_account = await db.get(
            Account,
            from_account_id,
            with_for_update=True,
        )
        to_account = await db.get(
            Account,
            to_account_id,
            with_for_update=True,
        )

        if not from_account or not to_account:
            raise ValueError("Account not found")

        if from_account.balance < amount:
            raise ValueError("Insufficient funds")

        from_account.balance -= amount
        to_account.balance += amount

        # Transaction commits on exit, rolls back on exception
```

## Example 6: Complex Queries with Joins

```python
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload, joinedload

async def get_user_order_summary(
    db: AsyncSession,
    user_id: UUID,
) -> dict:
    """Get user with order statistics."""
    # Get user with eager-loaded orders
    user_result = await db.execute(
        select(User)
        .options(selectinload(User.orders))
        .where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        return None

    # Get aggregate stats
    stats_result = await db.execute(
        select(
            func.count(Order.id).label("total_orders"),
            func.sum(Order.total_cents).label("total_spent"),
            func.avg(Order.total_cents).label("avg_order"),
        )
        .where(Order.user_id == user_id)
    )
    stats = stats_result.one()

    return {
        "user": user,
        "total_orders": stats.total_orders,
        "total_spent_cents": stats.total_spent or 0,
        "avg_order_cents": float(stats.avg_order or 0),
    }
```

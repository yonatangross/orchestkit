---
title: Implement repository pattern and bulk operations for maintainable SQLAlchemy data access
category: sqlalchemy
impact: HIGH
impactDescription: Repository pattern and bulk operations are essential for maintainable data access
tags: [sqlalchemy, repository, crud, bulk-insert, chunk, generic]
---

# Repository & Bulk Operations

## Generic Repository Pattern

```python
from typing import Generic, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T", bound=Base)

class AsyncRepository(Generic[T]):
    """Generic async repository for CRUD operations."""

    def __init__(self, session: AsyncSession, model: type[T]):
        self.session = session
        self.model = model

    async def get(self, id: UUID) -> T | None:
        return await self.session.get(self.model, id)

    async def get_many(self, ids: list[UUID]) -> list[T]:
        result = await self.session.execute(
            select(self.model).where(self.model.id.in_(ids))
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
```

## Bulk Operations

```python
async def bulk_insert_users(db: AsyncSession, users_data: list[dict]) -> int:
    """Efficient bulk insert."""
    users = [User(**data) for data in users_data]
    db.add_all(users)
    await db.flush()
    return len(users)

async def bulk_insert_chunked(
    db: AsyncSession, items: list[dict], chunk_size: int = 1000,
) -> int:
    """Insert large datasets in chunks to manage memory."""
    total = 0
    for i in range(0, len(items), chunk_size):
        chunk = items[i:i + chunk_size]
        db.add_all([Item(**data) for data in chunk])
        await db.flush()
        total += len(chunk)
    return total
```

## Key Principles

- Use `flush()` for ID generation without committing the transaction
- Chunk bulk inserts at 1000-10000 rows for memory management
- One repository per aggregate root
- Transaction boundary at the service layer, not repository

**Incorrect — Adding entities one-by-one in loop causes N round trips:**
```python
async def create_users(db: AsyncSession, users_data: list[dict]):
    for user_data in users_data:  # 1000 loop iterations
        user = User(**user_data)
        db.add(user)
        await db.flush()  # 1000 round trips to DB!
```

**Correct — Bulk operations reduce round trips and improve performance:**
```python
async def create_users(db: AsyncSession, users_data: list[dict]):
    users = [User(**data) for data in users_data]
    db.add_all(users)  # Single round trip
    await db.flush()
```

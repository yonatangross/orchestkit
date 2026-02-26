---
title: Configure eager loading for SQLAlchemy relationships to prevent N+1 query performance problems
category: sqlalchemy
impact: HIGH
impactDescription: Proper eager loading prevents N+1 query problems that destroy async performance
tags: [sqlalchemy, selectinload, joinedload, n-plus-one, eager-loading, relationships]
---

# Relationships & Eager Loading

## Eager Loading (Avoid N+1)

```python
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import select

async def get_user_with_orders(db: AsyncSession, user_id: UUID) -> User | None:
    """Load user with orders in single query - NO N+1."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.orders))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()

async def get_users_with_orders(db: AsyncSession, limit: int = 100) -> list[User]:
    """Load multiple users with orders efficiently."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.orders))
        .limit(limit)
    )
    return list(result.scalars().all())
```

## Concurrent Queries (Session Safety)

```python
async def get_dashboard_data(db: AsyncSession, user_id: UUID) -> dict:
    """Sequential queries with same session (safe)."""
    # WRONG: Don't share AsyncSession across tasks
    # async with asyncio.TaskGroup() as tg:
    #     tg.create_task(db.execute(...))  # NOT SAFE

    # CORRECT: Sequential queries with same session
    user = await db.get(User, user_id)
    orders_result = await db.execute(
        select(Order).where(Order.user_id == user_id).limit(10)
    )
    return {"user": user, "recent_orders": list(orders_result.scalars().all())}

async def get_data_from_multiple_users(user_ids: list[UUID]) -> list[dict]:
    """Concurrent queries - each task gets its own session."""
    async def fetch_user(user_id: UUID) -> dict:
        async with async_session_factory() as session:
            user = await session.get(User, user_id)
            return {"id": user_id, "email": user.email if user else None}

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_user(uid)) for uid in user_ids]
    return [t.result() for t in tasks]
```

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Lazy loading | `lazy="raise"` + explicit loads | Prevents accidental N+1 |
| Eager loading | `selectinload` for collections | Better than joinedload for async |
| Concurrent queries | Separate sessions per task | AsyncSession is NOT thread-safe |

**Incorrect — Lazy loading causes N+1 query problem (1 + 100 queries):**
```python
users = await db.execute(select(User).limit(100))
for user in users.scalars():
    print(user.orders)  # Separate query for EACH user's orders!
# Total queries: 1 (users) + 100 (orders) = 101 queries
```

**Correct — Eager loading with selectinload fetches all data in 2 queries:**
```python
users = await db.execute(
    select(User).options(selectinload(User.orders)).limit(100)
)
for user in users.scalars():
    print(user.orders)  # Already loaded, no extra query
# Total queries: 2 (users + orders in batch)
```

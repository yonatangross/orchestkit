# Eager Loading Patterns for Async SQLAlchemy

## The N+1 Problem in Async

```python
# BAD: N+1 queries - one for users, N for orders
async def get_users_bad(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User))
    users = result.scalars().all()
    for user in users:
        # This triggers N additional queries (or raises if lazy="raise")
        print(user.orders)
    return users

# GOOD: Single query with eager loading
async def get_users_good(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).options(selectinload(User.orders))
    )
    users = result.scalars().all()
    for user in users:
        print(user.orders)  # Already loaded
    return users
```

## Loading Strategies

### selectinload (Recommended for Collections)

```python
from sqlalchemy.orm import selectinload

# Loads orders in separate SELECT ... WHERE user_id IN (...)
result = await db.execute(
    select(User)
    .options(selectinload(User.orders))
    .limit(100)
)
```

### joinedload (Best for Single Relations)

```python
from sqlalchemy.orm import joinedload

# Uses LEFT JOIN - good for to-one relationships
result = await db.execute(
    select(Order)
    .options(joinedload(Order.user))
    .where(Order.status == "pending")
)
```

### Nested Eager Loading

```python
# Load user -> orders -> order_items
result = await db.execute(
    select(User)
    .options(
        selectinload(User.orders).selectinload(Order.items)
    )
)

# Load user -> orders and user -> addresses
result = await db.execute(
    select(User)
    .options(
        selectinload(User.orders),
        selectinload(User.addresses),
    )
)
```

## Configuring Models to Prevent Lazy Load

```python
from sqlalchemy.orm import relationship, Mapped

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True)

    # lazy="raise" prevents accidental lazy loading
    # Forces explicit eager loading
    orders: Mapped[list["Order"]] = relationship(
        back_populates="user",
        lazy="raise",  # Raises if accessed without eager load
    )

    # For optional relationships you might want loaded
    profile: Mapped["Profile"] = relationship(
        lazy="joined",  # Always joined (use sparingly)
    )
```

## Strategy Comparison

| Strategy | SQL | Best For | Async Safe |
|----------|-----|----------|------------|
| `selectinload` | Separate IN query | Collections | Yes |
| `joinedload` | LEFT JOIN | Single/to-one | Yes |
| `subqueryload` | Subquery | Large collections | Yes |
| `lazy="select"` | On access | Never in async | No |
| `lazy="raise"` | Raises error | Forcing explicit | Yes |

## Dynamic Loading for Large Collections

```python
class User(Base):
    # For very large collections, use dynamic loading
    orders: Mapped[list["Order"]] = relationship(
        lazy="dynamic",  # Returns query, not collection
    )

# Usage
async def get_recent_orders(db: AsyncSession, user_id: UUID) -> list[Order]:
    user = await db.get(User, user_id)
    # Dynamic relationship returns a query
    result = await db.execute(
        user.orders.limit(10).order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())
```

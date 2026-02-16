---
title: "SQLAlchemy: Sessions & Models"
category: sqlalchemy
impact: HIGH
impactDescription: Correct session and engine configuration prevents connection leaks and lazy load errors
tags: [sqlalchemy, async-session, engine, model, mapped-column, fastapi]
---

# SQLAlchemy Sessions & Models

## Engine and Session Factory

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Create async engine - ONE per application
engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent lazy load issues
    autoflush=False,
)
```

## FastAPI Dependency

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@router.get("/users/{user_id}")
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse.model_validate(user)
```

## Model Definition

```python
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    orders: Mapped[list["Order"]] = relationship(
        back_populates="user",
        lazy="raise",  # Prevent accidental lazy loads
    )
```

## Key Principles

- One `create_async_engine()` per application
- Set `expire_on_commit=False` to prevent lazy load errors after commit
- Set `pool_pre_ping=True` for production connection validation
- Use `lazy="raise"` on all relationships

**Incorrect — expire_on_commit=True causes lazy load errors after commit:**
```python
async_session_factory = async_sessionmaker(
    engine, expire_on_commit=True  # Default, causes issues
)
user = await session.execute(select(User).where(User.id == user_id))
await session.commit()
print(user.email)  # ERROR: Instance is not bound to a Session
```

**Correct — expire_on_commit=False allows access after commit:**
```python
async_session_factory = async_sessionmaker(
    engine, expire_on_commit=False  # Prevents lazy load errors
)
user = await session.execute(select(User).where(User.id == user_id))
await session.commit()
print(user.email)  # Works - object still accessible
```

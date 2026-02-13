# FastAPI + SQLAlchemy 2.0 Async Integration

## Complete Setup

```python
# app/db/session.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
```

## Dependency Injection

```python
# app/api/deps.py
from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide database session with automatic cleanup."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Route with Database Access

```python
# app/api/v1/routes/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserCreate

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        select(User)
        .options(selectinload(User.orders))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserResponse.model_validate(user)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = User(**user_in.model_dump())
    db.add(user)
    await db.flush()  # Get ID without committing
    await db.refresh(user)  # Load any defaults
    return UserResponse.model_validate(user)
```

## Service Layer Pattern

```python
# app/services/user_service.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def create(self, user_in: UserCreate) -> User:
        user = User(**user_in.model_dump())
        self.db.add(user)
        await self.db.flush()
        return user

    async def update(self, user: User, user_in: UserUpdate) -> User:
        for field, value in user_in.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        await self.db.flush()
        return user

# Usage in route
@router.post("/")
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    service = UserService(db)
    if await service.get_by_email(user_in.email):
        raise HTTPException(400, "Email already registered")
    return await service.create(user_in)
```

## Transaction Management

```python
# Explicit transaction control
@router.post("/transfer")
async def transfer_funds(
    transfer: TransferRequest,
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():  # Explicit transaction
        from_account = await db.get(Account, transfer.from_id, with_for_update=True)
        to_account = await db.get(Account, transfer.to_id, with_for_update=True)

        if from_account.balance < transfer.amount:
            raise HTTPException(400, "Insufficient funds")

        from_account.balance -= transfer.amount
        to_account.balance += transfer.amount
        # Commits automatically on exit, rolls back on exception
```

## Lifespan with Database

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify database connection
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    yield

    # Shutdown: dispose engine
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

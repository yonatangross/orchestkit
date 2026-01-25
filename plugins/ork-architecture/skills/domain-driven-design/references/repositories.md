# Repository Pattern

## Repository Protocol (Interface)

```python
from abc import abstractmethod
from typing import Protocol, TypeVar
from uuid import UUID

from app.domain.entities import Entity

T = TypeVar("T", bound=Entity)


class Repository(Protocol[T]):
    """Generic repository protocol for domain entities."""

    @abstractmethod
    async def get(self, id: UUID) -> T | None:
        """Get entity by ID, returns None if not found."""
        ...

    @abstractmethod
    async def get_or_raise(self, id: UUID) -> T:
        """Get entity by ID, raises if not found."""
        ...

    @abstractmethod
    async def add(self, entity: T) -> T:
        """Add new entity to repository."""
        ...

    @abstractmethod
    async def update(self, entity: T) -> T:
        """Update existing entity."""
        ...

    @abstractmethod
    async def delete(self, id: UUID) -> None:
        """Delete entity by ID."""
        ...


class UserRepository(Protocol):
    """User-specific repository with domain queries."""

    async def get(self, id: UUID) -> "User | None": ...
    async def get_or_raise(self, id: UUID) -> "User": ...
    async def add(self, user: "User") -> "User": ...
    async def update(self, user: "User") -> "User": ...
    async def delete(self, id: UUID) -> None: ...

    # Domain-specific queries
    async def find_by_email(self, email: str) -> "User | None": ...
    async def find_active_users(self, limit: int = 100) -> list["User"]: ...
    async def exists_by_email(self, email: str) -> bool: ...
```

## SQLAlchemy Implementation

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import User
from app.domain.repositories import UserRepository
from app.infrastructure.models import UserModel


class SQLAlchemyUserRepository(UserRepository):
    """SQLAlchemy implementation of UserRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(self, id: UUID) -> User | None:
        result = await self._session.get(UserModel, id)
        return self._to_entity(result) if result else None

    async def get_or_raise(self, id: UUID) -> User:
        user = await self.get(id)
        if not user:
            raise UserNotFoundError(f"User {id} not found")
        return user

    async def add(self, user: User) -> User:
        model = self._to_model(user)
        self._session.add(model)
        await self._session.flush()
        return user

    async def update(self, user: User) -> User:
        model = await self._session.get(UserModel, user.id)
        if not model:
            raise UserNotFoundError(f"User {user.id} not found")

        # Update model from entity
        model.email = user.email
        model.name = user.name
        model.status = user.status
        model.updated_at = user.updated_at

        await self._session.flush()
        return user

    async def delete(self, id: UUID) -> None:
        model = await self._session.get(UserModel, id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    async def find_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_active_users(self, limit: int = 100) -> list[User]:
        stmt = (
            select(UserModel)
            .where(UserModel.status == "active")
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars()]

    async def exists_by_email(self, email: str) -> bool:
        stmt = select(UserModel.id).where(UserModel.email == email).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _to_entity(self, model: UserModel) -> User:
        """Map database model to domain entity."""
        return User(
            id=model.id,
            email=model.email,
            name=model.name,
            status=model.status,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: User) -> UserModel:
        """Map domain entity to database model."""
        return UserModel(
            id=entity.id,
            email=entity.email,
            name=entity.name,
            status=entity.status,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )
```

## Unit of Work Pattern

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession


class UnitOfWork:
    """Coordinates repositories and transaction management."""

    def __init__(self, session: AsyncSession):
        self._session = session
        self.users = SQLAlchemyUserRepository(session)
        self.orders = SQLAlchemyOrderRepository(session)

    async def commit(self) -> None:
        """Commit transaction."""
        await self._session.commit()

    async def rollback(self) -> None:
        """Rollback transaction."""
        await self._session.rollback()


@asynccontextmanager
async def unit_of_work(
    session_factory,
) -> AsyncGenerator[UnitOfWork, None]:
    """Create unit of work context."""
    async with session_factory() as session:
        uow = UnitOfWork(session)
        try:
            yield uow
            await uow.commit()
        except Exception:
            await uow.rollback()
            raise
```

## Repository Best Practices

```python
# GOOD: Repository returns domain entities
async def get(self, id: UUID) -> User | None:
    model = await self._session.get(UserModel, id)
    return self._to_entity(model) if model else None

# BAD: Repository returns ORM models
async def get(self, id: UUID) -> UserModel | None:  # Leaks infrastructure!
    return await self._session.get(UserModel, id)

# GOOD: Domain-specific queries
async def find_eligible_for_discount(self) -> list[User]:
    """Find users eligible for loyalty discount."""
    ...

# BAD: Generic SQL queries in repository
async def find_by_query(self, query: str) -> list[User]:  # Too generic!
    ...

# GOOD: Repository handles mapping
def _to_entity(self, model: UserModel) -> User:
    return User(...)

# BAD: Caller handles mapping
user_dict = await repo.get_raw(id)  # Returns dict, caller maps
```

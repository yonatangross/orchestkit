"""
SQLAlchemy 2.0 Async Repository Template

Generic repository pattern for async database operations.
"""

from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models with common id field."""

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)


T = TypeVar("T", bound=Base)


class AsyncRepository(Generic[T]):  # noqa: UP046 - Support Python 3.11+
    """
    Generic async repository for CRUD operations.

    Usage:
        class UserRepository(AsyncRepository[User]):
            def __init__(self, session: AsyncSession):
                super().__init__(session, User)

            async def get_by_email(self, email: str) -> User | None:
                result = await self.session.execute(
                    select(User).where(User.email == email)
                )
                return result.scalar_one_or_none()
    """

    def __init__(self, session: AsyncSession, model: type[T]):
        self.session = session
        self.model = model

    async def get(self, entity_id: UUID) -> T | None:
        """Get entity by ID."""
        return await self.session.get(self.model, entity_id)

    async def get_by_ids(self, ids: list[UUID]) -> list[T]:
        """Get multiple entities by IDs."""
        if not ids:
            return []
        result = await self.session.execute(
            select(self.model).where(self.model.id.in_(ids))
        )
        return list(result.scalars().all())

    async def list_all(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
    ) -> list[T]:
        """List entities with pagination."""
        result = await self.session.execute(
            select(self.model).offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, **kwargs: object) -> T:
        """Create new entity."""
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def create_many(self, items: list[dict[str, object]]) -> list[T]:
        """Create multiple entities."""
        instances = [self.model(**item) for item in items]
        self.session.add_all(instances)
        await self.session.flush()
        return instances

    async def update(self, instance: T, **kwargs: object) -> T:
        """Update entity attributes."""
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: T) -> None:
        """Delete entity."""
        await self.session.delete(instance)
        await self.session.flush()

    async def exists(self, entity_id: UUID) -> bool:
        """Check if entity exists."""
        result = await self.session.execute(
            select(self.model.id).where(self.model.id == entity_id)
        )
        return result.scalar_one_or_none() is not None

    async def count(self) -> int:
        """Count all entities."""
        from sqlalchemy import func

        result = await self.session.execute(select(func.count(self.model.id)))
        return result.scalar_one()

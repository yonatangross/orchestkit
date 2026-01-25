"""
Domain Entity Template

Use this template for creating domain entities with:
- Identity equality
- Domain events
- Business logic encapsulation
- Aggregate root pattern
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Protocol
from uuid import UUID, uuid4

# ============================================================================
# Domain Events
# ============================================================================

class DomainEvent(Protocol):
    """Base protocol for domain events."""

    @property
    def occurred_at(self) -> datetime: ...


@dataclass(frozen=True)
class EntityCreated:
    """Event: Entity was created."""

    entity_id: UUID
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class EntityUpdated:
    """Event: Entity was updated."""

    entity_id: UUID
    field_name: str
    old_value: str
    new_value: str
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# Value Objects (Immutable)
# ============================================================================

@dataclass(frozen=True)
class EntityType:
    """
    Value object example.

    Characteristics:
    - Immutable (frozen=True)
    - Equality based on all fields (structural)
    - Validated in __post_init__
    """

    category: str
    priority: int

    def __post_init__(self):
        if not self.category:
            raise ValueError("Category cannot be empty")
        if self.priority < 1 or self.priority > 5:
            raise ValueError("Priority must be 1-5")

    @property
    def is_high_priority(self) -> bool:
        return self.priority >= 4


# ============================================================================
# Entity Status Enum
# ============================================================================

class EntityStatus(Enum):
    """Entity lifecycle states."""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"

    def can_transition_to(self, new_status: "EntityStatus") -> bool:
        """Define valid state transitions."""
        valid_transitions = {
            EntityStatus.DRAFT: {EntityStatus.ACTIVE, EntityStatus.DELETED},
            EntityStatus.ACTIVE: {EntityStatus.ARCHIVED, EntityStatus.DELETED},
            EntityStatus.ARCHIVED: {EntityStatus.ACTIVE, EntityStatus.DELETED},
            EntityStatus.DELETED: set(),  # Terminal state
        }
        return new_status in valid_transitions.get(self, set())


# ============================================================================
# Entity (Aggregate Root)
# ============================================================================

@dataclass
class Entity:
    """
    Domain Entity / Aggregate Root.

    Characteristics:
    - Identity equality (by ID, not fields)
    - Encapsulates business logic
    - Raises domain events
    - Guards invariants
    """

    # Required fields (no default)
    name: str
    entity_type: EntityType

    # Identity field
    id: UUID = field(default_factory=uuid4)

    # State fields with defaults
    status: EntityStatus = EntityStatus.DRAFT
    description: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Domain events (not persisted)
    _events: list[DomainEvent] = field(default_factory=list, repr=False)

    # -------------------------------------------------------------------------
    # Identity Equality
    # -------------------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        """Entities are equal by identity (ID), not by attributes."""
        if not isinstance(other, Entity):
            return False
        return self.id == other.id

    def __hash__(self) -> int:
        """Hash by identity for use in sets/dicts."""
        return hash(self.id)

    # -------------------------------------------------------------------------
    # Factory Methods
    # -------------------------------------------------------------------------

    @classmethod
    def create(
        cls,
        name: str,
        category: str,
        priority: int = 3,
        description: str | None = None,
    ) -> "Entity":
        """Factory method for creating new entities."""
        entity_type = EntityType(category=category, priority=priority)
        entity = cls(
            name=name,
            entity_type=entity_type,
            description=description,
        )
        entity._raise_event(EntityCreated(entity_id=entity.id))
        return entity

    # -------------------------------------------------------------------------
    # Business Logic (State Transitions)
    # -------------------------------------------------------------------------

    def activate(self) -> None:
        """Transition entity to ACTIVE status."""
        self._transition_to(EntityStatus.ACTIVE)

    def archive(self) -> None:
        """Transition entity to ARCHIVED status."""
        self._transition_to(EntityStatus.ARCHIVED)

    def delete(self) -> None:
        """Soft delete the entity."""
        self._transition_to(EntityStatus.DELETED)

    def _transition_to(self, new_status: EntityStatus) -> None:
        """
        Internal method for state transitions.

        Guards:
        - Validates transition is allowed
        - Records event
        - Updates timestamp
        """
        if not self.status.can_transition_to(new_status):
            raise ValueError(
                f"Cannot transition from {self.status.value} to {new_status.value}"
            )

        old_status = self.status
        self.status = new_status
        self.updated_at = datetime.now(timezone.utc)

        self._raise_event(
            EntityUpdated(
                entity_id=self.id,
                field_name="status",
                old_value=old_status.value,
                new_value=new_status.value,
            )
        )

    def update_description(self, description: str) -> None:
        """Update entity description."""
        if self.status == EntityStatus.DELETED:
            raise ValueError("Cannot modify deleted entity")

        old_description = self.description or ""
        self.description = description
        self.updated_at = datetime.now(timezone.utc)

        self._raise_event(
            EntityUpdated(
                entity_id=self.id,
                field_name="description",
                old_value=old_description,
                new_value=description,
            )
        )

    # -------------------------------------------------------------------------
    # Query Methods (No Side Effects)
    # -------------------------------------------------------------------------

    @property
    def is_active(self) -> bool:
        """Check if entity is active."""
        return self.status == EntityStatus.ACTIVE

    @property
    def is_deletable(self) -> bool:
        """Check if entity can be deleted."""
        return self.status.can_transition_to(EntityStatus.DELETED)

    @property
    def age_days(self) -> int:
        """Calculate entity age in days."""
        return (datetime.now(timezone.utc) - self.created_at).days

    # -------------------------------------------------------------------------
    # Domain Events
    # -------------------------------------------------------------------------

    def _raise_event(self, event: DomainEvent) -> None:
        """Record a domain event."""
        self._events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        """
        Collect and clear pending events.

        Called by repository after saving to publish events.
        """
        events = self._events.copy()
        self._events.clear()
        return events


# ============================================================================
# Repository Port (Protocol)
# ============================================================================

class IEntityRepository(Protocol):
    """Output port for entity persistence."""

    async def save(self, entity: Entity) -> Entity:
        """Persist entity (create or update)."""
        ...

    async def get_by_id(self, id: UUID) -> Entity | None:
        """Retrieve entity by ID."""
        ...

    async def find_active(self) -> list[Entity]:
        """Find all active entities."""
        ...

    async def delete(self, id: UUID) -> None:
        """Hard delete entity."""
        ...


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    # Create entity via factory
    entity = Entity.create(
        name="My Entity",
        category="important",
        priority=4,
        description="A sample entity",
    )

    print(f"Created: {entity.id}")
    print(f"Status: {entity.status.value}")
    print(f"High priority: {entity.entity_type.is_high_priority}")

    # Transition states
    entity.activate()
    print(f"After activate: {entity.status.value}")

    # Collect events
    events = entity.collect_events()
    for event in events:
        print(f"Event: {type(event).__name__} at {event.occurred_at}")

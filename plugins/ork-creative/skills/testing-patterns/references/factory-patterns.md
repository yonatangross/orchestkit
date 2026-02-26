# Factory Patterns for Test Data

Generate consistent, realistic test data with factory patterns.

## Implementation

```python
import factory
from factory import Faker, SubFactory, LazyAttribute, Sequence
from datetime import datetime, timedelta
from app.models import User, Organization, Project

class OrganizationFactory(factory.Factory):
    """Factory for Organization entities."""
    class Meta:
        model = Organization

    id = Sequence(lambda n: f"org-{n:04d}")
    name = Faker("company")
    slug = LazyAttribute(lambda o: o.name.lower().replace(" ", "-"))
    created_at = Faker("date_time_this_year")


class UserFactory(factory.Factory):
    """Factory for User entities with organization relationship."""
    class Meta:
        model = User

    id = Sequence(lambda n: f"user-{n:04d}")
    email = Faker("email")
    name = Faker("name")
    organization = SubFactory(OrganizationFactory)
    is_active = True
    created_at = Faker("date_time_this_month")

    @LazyAttribute
    def username(self):
        return self.email.split("@")[0]


class ProjectFactory(factory.Factory):
    """Factory with traits for different project states."""
    class Meta:
        model = Project

    id = Sequence(lambda n: f"proj-{n:04d}")
    name = Faker("catch_phrase")
    owner = SubFactory(UserFactory)
    status = "active"

    class Params:
        archived = factory.Trait(
            status="archived",
            archived_at=Faker("date_time_this_month")
        )
        completed = factory.Trait(
            status="completed",
            completed_at=Faker("date_time_this_week")
        )
```

## Usage Patterns

```python
# Basic creation
user = UserFactory()

# Override specific fields
admin = UserFactory(email="admin@company.com", is_active=True)

# Use traits
archived_project = ProjectFactory(archived=True)

# Batch creation
users = UserFactory.create_batch(10)

# Build without persistence (in-memory only)
temp_user = UserFactory.build()
```

## Checklist

- [ ] Use Sequence for unique identifiers
- [ ] Use SubFactory for related entities
- [ ] Use LazyAttribute for computed fields
- [ ] Use Traits for common variations (archived, deleted, premium)
- [ ] Keep factories close to model definitions
- [ ] Document factory-specific test data assumptions
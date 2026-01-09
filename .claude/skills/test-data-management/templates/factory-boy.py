# Template: Factory Boy Configuration
# Usage: Copy to tests/factories.py and customize for your models

import factory
from factory import Faker, SubFactory, LazyAttribute, Sequence, post_generation
from factory.fuzzy import FuzzyChoice, FuzzyInteger, FuzzyDecimal
from datetime import datetime, timedelta
import random

# TODO: Import your SQLAlchemy models
# from app.models import User, Team, Project, Task


# ============================================================================
# BASE FACTORY (for SQLAlchemy integration)
# ============================================================================

class BaseFactory(factory.Factory):
    """Base factory with common patterns for all entities."""

    class Meta:
        abstract = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """Override to add to session if using SQLAlchemy."""
        # TODO: Uncomment for SQLAlchemy integration
        # from tests.conftest import get_test_session
        # session = get_test_session()
        # obj = model_class(*args, **kwargs)
        # session.add(obj)
        # session.commit()
        # return obj
        return model_class(*args, **kwargs)


# ============================================================================
# ENTITY FACTORIES
# ============================================================================

class TeamFactory(BaseFactory):
    """Factory for Team entities."""

    class Meta:
        # TODO: model = Team
        model = dict

    id = Sequence(lambda n: f"team-{n:04d}")
    name = Faker("company")
    slug = LazyAttribute(lambda o: o["name"].lower().replace(" ", "-")[:20])
    plan = FuzzyChoice(["free", "pro", "enterprise"])
    created_at = Faker("date_time_between", start_date="-1y", end_date="now")


class UserFactory(BaseFactory):
    """Factory for User entities with relationships."""

    class Meta:
        # TODO: model = User
        model = dict

    id = Sequence(lambda n: f"user-{n:04d}")
    email = Faker("email")
    name = Faker("name")
    role = FuzzyChoice(["admin", "member", "viewer"])
    team = SubFactory(TeamFactory)
    is_active = True
    created_at = Faker("date_time_this_year")

    @LazyAttribute
    def username(obj):
        return obj["email"].split("@")[0]

    # Traits for common variations
    class Params:
        admin = factory.Trait(role="admin")
        inactive = factory.Trait(is_active=False)
        new_user = factory.Trait(
            created_at=factory.LazyFunction(
                lambda: datetime.now() - timedelta(days=random.randint(0, 7))
            )
        )


class ProjectFactory(BaseFactory):
    """Factory for Project entities with lifecycle states."""

    class Meta:
        # TODO: model = Project
        model = dict

    id = Sequence(lambda n: f"proj-{n:04d}")
    name = Faker("catch_phrase")
    description = Faker("paragraph", nb_sentences=2)
    owner = SubFactory(UserFactory)
    team = LazyAttribute(lambda o: o["owner"]["team"])
    status = "active"
    budget = FuzzyDecimal(1000, 100000, precision=2)
    created_at = Faker("date_time_this_month")

    class Params:
        archived = factory.Trait(
            status="archived",
            archived_at=Faker("date_time_this_month")
        )
        completed = factory.Trait(
            status="completed",
            completed_at=Faker("date_time_this_week")
        )
        over_budget = factory.Trait(
            budget=FuzzyDecimal(100, 500, precision=2)
        )


class TaskFactory(BaseFactory):
    """Factory for Task entities with project relationship."""

    class Meta:
        # TODO: model = Task
        model = dict

    id = Sequence(lambda n: f"task-{n:04d}")
    title = Faker("sentence", nb_words=6)
    description = Faker("paragraph")
    project = SubFactory(ProjectFactory)
    assignee = LazyAttribute(lambda o: o["project"]["owner"])
    priority = FuzzyChoice(["low", "medium", "high", "critical"])
    status = "pending"
    due_date = Faker("date_between", start_date="today", end_date="+30d")

    class Params:
        completed = factory.Trait(
            status="completed",
            completed_at=Faker("date_time_this_week")
        )
        overdue = factory.Trait(
            status="pending",
            due_date=Faker("date_between", start_date="-30d", end_date="-1d")
        )


# ============================================================================
# BATCH CREATION HELPERS
# ============================================================================

def create_team_with_members(member_count: int = 5) -> dict:
    """Create a team with multiple members."""
    team = TeamFactory()
    admin = UserFactory(team=team, admin=True)
    members = UserFactory.create_batch(member_count - 1, team=team)
    return {"team": team, "admin": admin, "members": members}


def create_project_with_tasks(task_count: int = 10) -> dict:
    """Create a project with multiple tasks."""
    project = ProjectFactory()
    tasks = TaskFactory.create_batch(task_count, project=project)
    return {"project": project, "tasks": tasks}


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

if __name__ == "__main__":
    # Basic creation
    user = UserFactory()
    print(f"Created user: {user}")

    # With overrides
    admin = UserFactory(email="admin@test.com", admin=True)
    print(f"Created admin: {admin}")

    # Using traits
    inactive_user = UserFactory(inactive=True)
    archived_project = ProjectFactory(archived=True)

    # Batch creation
    users = UserFactory.create_batch(5)
    print(f"Created {len(users)} users")

    # Complex scenario
    team_data = create_team_with_members(10)
    print(f"Team: {team_data['team']['name']} with {len(team_data['members'])} members")
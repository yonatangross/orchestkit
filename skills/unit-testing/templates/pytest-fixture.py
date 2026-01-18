# Template: Pytest Fixture Configuration
# Usage: Copy to tests/conftest.py and customize for your project

from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

# ============================================================================
# DATABASE FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
def db_engine():
    """Session-scoped database engine (shared across all tests)."""
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False}
    )
    # TODO: Import your Base from models
    # Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session]:
    """Function-scoped database session with automatic rollback."""
    connection = db_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ============================================================================
# ASYNC DATABASE FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
async def async_db_engine():
    """Async database engine for async tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False
    )
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def async_db_session(async_db_engine) -> AsyncGenerator[AsyncSession]:
    """Async session with transaction rollback."""
    async with async_db_engine.connect() as connection, connection.begin() as transaction:
        async_session = AsyncSession(bind=connection, expire_on_commit=False)
        yield async_session
        await transaction.rollback()


# ============================================================================
# MOCK FIXTURES
# ============================================================================

@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    mock = MagicMock()
    mock.get.return_value = None
    mock.set.return_value = True
    mock.delete.return_value = 1
    return mock


@pytest.fixture
def mock_http_client():
    """Mock async HTTP client."""
    mock = AsyncMock()
    mock.get.return_value.status_code = 200
    mock.get.return_value.json.return_value = {}
    mock.post.return_value.status_code = 201
    return mock


# ============================================================================
# FACTORY FIXTURES
# ============================================================================

@pytest.fixture
def user_factory(db_session):
    """Factory for creating test users."""
    def create_user(
        email: str = "test@example.com",
        name: str = "Test User",
        is_active: bool = True
    ):
        # TODO: Import your User model
        # user = User(email=email, name=name, is_active=is_active)
        # db_session.add(user)
        # db_session.commit()
        # return user
        return {"email": email, "name": name, "is_active": is_active}
    return create_user


# ============================================================================
# PARAMETERIZED FIXTURE EXAMPLE
# ============================================================================

@pytest.fixture(params=["admin", "moderator", "user"])
def user_role(request):
    """Parameterized fixture for testing different user roles."""
    return request.param


# ============================================================================
# CLEANUP FIXTURES
# ============================================================================

@pytest.fixture(autouse=True)
def reset_environment():
    """Automatically reset environment between tests."""
    import os
    original_env = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(original_env)
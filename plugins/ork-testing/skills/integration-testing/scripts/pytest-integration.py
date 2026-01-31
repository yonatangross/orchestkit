# Template: Pytest Integration Test Suite
# Usage: Copy to tests/integration/test_api.py and customize for your endpoints

from collections.abc import AsyncGenerator, Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# TODO: Import your FastAPI app and models
# from app.main import app
# from app.models import Base, User
# from app.database import get_db


# ============================================================================
# DATABASE FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
def db_engine():
    """Create test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    # TODO: Uncomment when you have models
    # Base.metadata.create_all(bind=engine)
    yield engine
    # Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator:
    """Create isolated database session with transaction rollback."""
    connection = db_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ============================================================================
# HTTP CLIENT FIXTURES
# ============================================================================

@pytest.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client for testing FastAPI endpoints."""
    # TODO: Import and use your actual app
    from fastapi import FastAPI
    app = FastAPI()

    # Override database dependency
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # TODO: Uncomment when you have dependencies
    # app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def authenticated_client(client: AsyncClient) -> AsyncClient:
    """Client with authentication token."""
    # Login and get token
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpassword"
    })

    if response.status_code == 200:
        token = response.json().get("access_token")
        client.headers["Authorization"] = f"Bearer {token}"

    return client


# ============================================================================
# TEST DATA FIXTURES
# ============================================================================

@pytest.fixture
def sample_user_data():
    """Sample user data for creation tests."""
    return {
        "email": "newuser@example.com",
        "name": "New User",
        "password": "securepassword123"
    }


@pytest.fixture
def sample_item_data():
    """Sample item data for CRUD tests."""
    return {
        "name": "Test Item",
        "description": "A test item for integration testing",
        "price": 29.99
    }


# ============================================================================
# INTEGRATION TESTS: CRUD OPERATIONS
# ============================================================================

class TestUserEndpoints:
    """Integration tests for user management endpoints."""

    @pytest.mark.asyncio
    async def test_create_user_returns_201_with_valid_data(
        self, client: AsyncClient, sample_user_data: dict
    ):
        # Arrange
        payload = sample_user_data

        # Act
        response = await client.post("/api/users", json=payload)

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"]
        assert data["name"] == payload["name"]
        assert "id" in data
        assert "password" not in data  # Password should not be returned

    @pytest.mark.asyncio
    async def test_create_user_returns_400_when_email_exists(
        self, client: AsyncClient, sample_user_data: dict
    ):
        # Arrange - Create first user
        await client.post("/api/users", json=sample_user_data)

        # Act - Try to create duplicate
        response = await client.post("/api/users", json=sample_user_data)

        # Assert
        assert response.status_code == 400
        assert "email" in response.json().get("detail", "").lower()

    @pytest.mark.asyncio
    async def test_get_user_returns_404_when_not_found(
        self, client: AsyncClient
    ):
        # Act
        response = await client.get("/api/users/nonexistent-id")

        # Assert
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_users_returns_paginated_results(
        self, authenticated_client: AsyncClient
    ):
        # Act
        response = await authenticated_client.get("/api/users?page=1&size=10")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data


class TestItemEndpoints:
    """Integration tests for item CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_item_requires_authentication(
        self, client: AsyncClient, sample_item_data: dict
    ):
        # Act - Request without auth header
        response = await client.post("/api/items", json=sample_item_data)

        # Assert
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_and_retrieve_item(
        self, authenticated_client: AsyncClient, sample_item_data: dict
    ):
        # Arrange & Act - Create
        create_response = await authenticated_client.post(
            "/api/items",
            json=sample_item_data
        )

        # Assert create
        assert create_response.status_code == 201
        item_id = create_response.json()["id"]

        # Act - Retrieve
        get_response = await authenticated_client.get(f"/api/items/{item_id}")

        # Assert retrieve
        assert get_response.status_code == 200
        assert get_response.json()["name"] == sample_item_data["name"]

    @pytest.mark.asyncio
    async def test_delete_item_returns_204(
        self, authenticated_client: AsyncClient, sample_item_data: dict
    ):
        # Arrange - Create item first
        create_response = await authenticated_client.post(
            "/api/items",
            json=sample_item_data
        )
        item_id = create_response.json()["id"]

        # Act
        delete_response = await authenticated_client.delete(f"/api/items/{item_id}")

        # Assert
        assert delete_response.status_code == 204

        # Verify deletion
        get_response = await authenticated_client.get(f"/api/items/{item_id}")
        assert get_response.status_code == 404


# ============================================================================
# INTEGRATION TESTS: ERROR HANDLING
# ============================================================================

class TestErrorHandling:
    """Integration tests for API error responses."""

    @pytest.mark.asyncio
    async def test_validation_error_returns_422(self, client: AsyncClient):
        # Act - Missing required fields
        response = await client.post("/api/users", json={})

        # Assert
        assert response.status_code == 422
        errors = response.json()
        assert "detail" in errors

    @pytest.mark.asyncio
    async def test_not_found_returns_proper_error_format(
        self, client: AsyncClient
    ):
        # Act
        response = await client.get("/api/nonexistent")

        # Assert
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


# ============================================================================
# USAGE
# ============================================================================

# Run all integration tests:
#   pytest tests/integration/ -v

# Run with coverage:
#   pytest tests/integration/ --cov=app --cov-report=html

# Run specific test class:
#   pytest tests/integration/test_api.py::TestUserEndpoints -v